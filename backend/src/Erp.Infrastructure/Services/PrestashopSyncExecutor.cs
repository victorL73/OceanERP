using Erp.Domain.Customers;
using Erp.Domain.FutureModules;
using Erp.Application.Prestashop;
using Erp.Domain.Products;
using Erp.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using System.Globalization;
using System.Net;
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;

namespace Erp.Infrastructure.Services;

internal sealed class PrestashopSyncExecutor(ErpDbContext db, IConfiguration configuration, HttpClient httpClient, IPrestashopSyncNotifier notifier)
{
    private const string Provider = "PrestaShop";
    private const string DefaultWarehouseName = "Entrepot principal";
    private readonly Dictionary<string, ProductCategory?> categoryCache = new(StringComparer.OrdinalIgnoreCase);
    private readonly Dictionary<string, ProductBrand?> brandCache = new(StringComparer.OrdinalIgnoreCase);
    private readonly Dictionary<string, ProductSupplier?> supplierCache = new(StringComparer.OrdinalIgnoreCase);
    private static readonly HashSet<string> AllowedRichTextTags = new(StringComparer.OrdinalIgnoreCase)
    {
        "p", "br", "ul", "ol", "li", "strong", "b", "em", "i", "u", "h1", "h2", "h3", "h4", "blockquote"
    };

    public async Task ExecuteAsync(Guid syncLogId, CancellationToken cancellationToken)
    {
        var log = await db.PrestashopSyncLogs.FirstOrDefaultAsync(x => x.Id == syncLogId, cancellationToken);
        if (log is null || log.Status is not ("Queued" or "Running"))
        {
            return;
        }

        var connection = await db.PrestashopConnections.FirstOrDefaultAsync(x => x.Id == log.PrestashopConnectionId, cancellationToken);
        if (connection is null)
        {
            await FailAsync(log, "PrestaShop connection not found.", cancellationToken);
            return;
        }

        if (!connection.IsActive)
        {
            await FailAsync(log, "PrestaShop connection is inactive.", cancellationToken);
            return;
        }

        var apiKeyResult = PrestashopSecretProtector.ResolveApiKey(configuration, connection);
        if (!apiKeyResult.Succeeded)
        {
            await FailAsync(log, apiKeyResult.Error ?? "PrestaShop API key is not configured.", cancellationToken);
            return;
        }

        log.Status = "Running";
        log.Message = "Connexion a PrestaShop en cours.";
        log.StartedAt ??= DateTimeOffset.UtcNow;
        log.CompletedAt = null;
        await db.SaveChangesAsync(cancellationToken);

        try
        {
            var result = await ProbePrestashopAsync(connection, apiKeyResult.Value!, cancellationToken);
            db.ChangeTracker.Clear();
            var completedLog = await db.PrestashopSyncLogs.FirstAsync(x => x.Id == syncLogId, cancellationToken);
            completedLog.Status = result.Status;
            completedLog.Message = TrimMessage(result.Message);
            completedLog.CompletedAt = DateTimeOffset.UtcNow;
            await db.SaveChangesAsync(cancellationToken);
        }
        catch (OperationCanceledException) when (!cancellationToken.IsCancellationRequested)
        {
            await FailByIdAsync(syncLogId, "Synchronisation interrompue ou delai depasse.", cancellationToken);
        }
        catch (Exception ex)
        {
            await FailByIdAsync(syncLogId, TrimMessage(ex.Message), cancellationToken);
        }
    }

    public async Task<PrestashopSyncExecutionResult> ExecuteConnectionAsync(Guid connectionId, CancellationToken cancellationToken)
    {
        var connection = await db.PrestashopConnections.FirstOrDefaultAsync(x => x.Id == connectionId, cancellationToken);
        if (connection is null)
        {
            return new PrestashopSyncExecutionResult("Failed", "PrestaShop connection not found.");
        }

        if (!connection.IsActive)
        {
            return new PrestashopSyncExecutionResult("Skipped", "PrestaShop connection is inactive.");
        }

        var apiKeyResult = PrestashopSecretProtector.ResolveApiKey(configuration, connection);
        if (!apiKeyResult.Succeeded)
        {
            return new PrestashopSyncExecutionResult("Failed", apiKeyResult.Error ?? "PrestaShop API key is not configured.");
        }

        try
        {
            var result = await ProbePrestashopAsync(connection, apiKeyResult.Value!, cancellationToken);
            return new PrestashopSyncExecutionResult(result.Status, result.Message);
        }
        catch (OperationCanceledException)
        {
            throw;
        }
        catch (Exception ex)
        {
            return new PrestashopSyncExecutionResult("Failed", TrimMessage(ex.Message));
        }
    }

    private async Task<PrestashopProbeResult> ProbePrestashopAsync(PrestashopConnection connection, string apiKey, CancellationToken cancellationToken)
    {
        var apiBaseUrl = GetApiBaseUrl(connection.ShopUrl);
        httpClient.Timeout = TimeSpan.FromSeconds(20);
        httpClient.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue(
            "Basic",
            Convert.ToBase64String(Encoding.ASCII.GetBytes($"{apiKey}:")));

        var summaries = new List<ImportSummary>();
        summaries.Add(await RunImportAsync("products", () => ImportProductsAsync(apiBaseUrl, cancellationToken), cancellationToken));
        summaries.Add(await RunImportAsync("customers", () => ImportCustomersAsync(apiBaseUrl, cancellationToken), cancellationToken));
        summaries.Add(await RunImportAsync("stock_availables", () => ImportStockAsync(apiBaseUrl, connection, cancellationToken), cancellationToken));
        var ordersSummary = await RunImportAsync("orders", () => ImportOrdersAsync(apiBaseUrl, cancellationToken), cancellationToken);
        summaries.Add(ordersSummary);
        if (ordersSummary.CreatedOrders.Count > 0)
        {
            await notifier.NotifyNewOrdersAsync(connection.Id, connection.ShopUrl, ordersSummary.CreatedOrders, cancellationToken);
        }

        var serviceSummary = await RunImportAsync("customer_threads", () => ImportServiceTicketsAsync(apiBaseUrl, connection, cancellationToken), cancellationToken);
        summaries.Add(serviceSummary);
        if (serviceSummary.CreatedServiceTickets.Count > 0)
        {
            await notifier.NotifyNewServiceMessagesAsync(connection.Id, connection.ShopUrl, serviceSummary.CreatedServiceTickets, cancellationToken);
        }

        var successCount = summaries.Count(x => x.IsSuccess);
        if (successCount == 0)
        {
            return new PrestashopProbeResult("Failed", $"Aucune ressource PrestaShop importee. {string.Join("; ", summaries.Select(x => x.ToMessage()))}.");
        }

        var status = successCount == summaries.Count ? "Completed" : "CompletedWithWarnings";
        var message = $"Synchronisation PrestaShop: {string.Join("; ", summaries.Select(x => x.ToMessage()))}.";
        var resourceChanges = summaries
            .Where(x => x.IsSuccess && (x.Created > 0 || x.Updated > 0))
            .Select(x => new PrestashopSyncResourceChange(x.Resource, x.Created, x.Updated))
            .ToList();
        if (resourceChanges.Count > 0)
        {
            await notifier.NotifySyncCompletedAsync(new PrestashopSyncCompletedEvent(connection.Id, connection.ShopUrl, status, message, resourceChanges), cancellationToken);
        }

        return new PrestashopProbeResult(status, message);
    }

    private static string GetApiBaseUrl(string shopUrl)
    {
        var normalized = shopUrl.Trim().TrimEnd('/');
        return normalized.EndsWith("/api", StringComparison.OrdinalIgnoreCase)
            ? normalized
            : $"{normalized}/api";
    }

    private async Task<JsonDocument> GetJsonAsync(string url, string label, CancellationToken cancellationToken)
    {
        using var request = new HttpRequestMessage(HttpMethod.Get, url);
        request.Headers.Accept.Add(new MediaTypeWithQualityHeaderValue("application/json"));

        using var response = await httpClient.SendAsync(request, cancellationToken);
        var body = await response.Content.ReadAsStringAsync(cancellationToken);
        if (!response.IsSuccessStatusCode)
        {
            var detail = string.IsNullOrWhiteSpace(body) ? response.ReasonPhrase ?? response.StatusCode.ToString() : body.ReplaceLineEndings(" ");
            throw new InvalidOperationException($"{label}: HTTP {(int)response.StatusCode} {TrimDetail(detail)}");
        }

        return JsonDocument.Parse(body);
    }

    private async Task<ImportSummary> RunImportAsync(string resource, Func<Task<ImportSummary>> import, CancellationToken cancellationToken)
    {
        try
        {
            var summary = await import();
            await db.SaveChangesAsync(cancellationToken);
            db.ChangeTracker.Clear();
            return summary;
        }
        catch (OperationCanceledException)
        {
            throw;
        }
        catch (Exception ex)
        {
            db.ChangeTracker.Clear();
            return ImportSummary.Failed(resource, TrimDetail(FullExceptionMessage(ex)));
        }
    }

    private async Task<ImportSummary> ImportProductsAsync(string apiBaseUrl, CancellationToken cancellationToken)
    {
        using var document = await GetJsonAsync($"{apiBaseUrl}/products?display=full&limit=100&output_format=JSON", "products", cancellationToken);
        var created = 0;
        var updated = 0;

        foreach (var item in EnumerateItems(document, "products"))
        {
            var externalId = GetRequiredId(item);
            if (externalId is null)
            {
                continue;
            }

            var product = await FindProductByExternalIdAsync(externalId, cancellationToken);
            var isCreated = product is null;
            if (product is null)
            {
                var reference = await BuildUniqueProductReferenceAsync(FirstNonEmpty(GetString(item, "reference"), $"PS-{externalId}"), externalId, cancellationToken);
                product = new Product { Reference = reference };
                db.Products.Add(product);
                db.ExternalReferences.Add(new ExternalReference { Provider = Provider, ExternalId = ExternalKey("products", externalId), Module = "products", EntityId = product.Id });
                created += 1;
            }

            product.Name = Truncate(FirstNonEmpty(GetLocalizedString(item, "name"), product.Reference), 240);
            product.Description = BuildProductDescription(item) ?? product.Description;
            product.ImageUrl = BuildPrestashopImageUrl(apiBaseUrl, item) ?? product.ImageUrl;
            product.SalePrice = GetDecimal(item, "price") ?? product.SalePrice;
            product.PurchasePrice = GetDecimal(item, "wholesale_price") ?? product.PurchasePrice;
            product.IsActive = GetBool(item, "active") ?? product.IsActive;
            product.Category = await ResolveProductCategoryAsync(apiBaseUrl, item, cancellationToken);
            product.CategoryId = product.Category?.Id;
            product.Brand = await ResolveProductBrandAsync(apiBaseUrl, item, cancellationToken);
            product.BrandId = product.Brand?.Id;
            product.MainSupplier = await ResolveProductSupplierAsync(apiBaseUrl, item, externalId, cancellationToken);
            product.MainSupplierId = product.MainSupplier?.Id;
            if (!isCreated && HasTrackedChanges(product))
            {
                updated += 1;
            }
        }

        return ImportSummary.Ok("products", created, updated);
    }

    private async Task<ImportSummary> ImportCustomersAsync(string apiBaseUrl, CancellationToken cancellationToken)
    {
        using var document = await GetJsonAsync($"{apiBaseUrl}/customers?display=full&limit=100&output_format=JSON", "customers", cancellationToken);
        var created = 0;
        var updated = 0;

        foreach (var item in EnumerateItems(document, "customers"))
        {
            var externalId = GetRequiredId(item);
            if (externalId is null)
            {
                continue;
            }

            var code = Truncate($"PS-C-{externalId}", 60);
            var customer = await FindCustomerAsync(externalId, code, cancellationToken);
            var isCreated = customer is null;
            if (customer is null)
            {
                customer = new Customer { Code = code };
                db.Customers.Add(customer);
                db.ExternalReferences.Add(new ExternalReference { Provider = Provider, ExternalId = ExternalKey("customers", externalId), Module = "customers", EntityId = customer.Id });
                created += 1;
            }

            var firstName = GetString(item, "firstname");
            var lastName = GetString(item, "lastname");
            var email = GetString(item, "email");
            var company = GetString(item, "company");
            var siret = NormalizeIdentifier(GetString(item, "siret"));
            customer.CompanyName = Truncate(FirstNonEmpty(company, $"{firstName} {lastName}".Trim(), email, code), 240);
            customer.LegalName = TruncateOptional(company, 240);
            customer.TradeName ??= TruncateOptional(company, 240);
            customer.Email = TruncateOptional(email, 320);
            customer.SiretNumber = TruncateOptional(siret, 20);
            customer.SirenNumber = string.IsNullOrWhiteSpace(siret) ? customer.SirenNumber : Truncate(siret.Length >= 9 ? siret[..9] : siret, 20);
            customer.CustomerType ??= "PrestaShop";
            customer.Source = Provider;
            customer.IsActive = GetBool(item, "active") ?? customer.IsActive;

            if (!string.IsNullOrWhiteSpace(firstName) || !string.IsNullOrWhiteSpace(lastName) || !string.IsNullOrWhiteSpace(email))
            {
                var contact = customer.Contacts.FirstOrDefault(x => x.JobTitle == Provider)
                    ?? (!string.IsNullOrWhiteSpace(email) ? customer.Contacts.FirstOrDefault(x => x.Email == email) : null);

                if (contact is null)
                {
                    contact = new CustomerContact();
                    customer.Contacts.Add(contact);
                }

                contact.FirstName = firstName ?? string.Empty;
                contact.LastName = lastName ?? string.Empty;
                contact.Email = email;
                contact.JobTitle = Provider;
                contact.IsPrimary = true;
            }

            if (!isCreated && (HasTrackedChanges(customer) || customer.Contacts.Any(HasTrackedChanges)))
            {
                updated += 1;
            }
        }

        return ImportSummary.Ok("customers", created, updated);
    }

    private async Task<ImportSummary> ImportStockAsync(string apiBaseUrl, PrestashopConnection connection, CancellationToken cancellationToken)
    {
        using var document = await GetJsonAsync($"{apiBaseUrl}/stock_availables?display=full&limit=100&output_format=JSON", "stock_availables", cancellationToken);
        var defaultWarehouse = await GetOrCreatePrestashopWarehouseAsync(connection, cancellationToken);
        var quantitiesByProduct = new Dictionary<string, decimal>();

        foreach (var item in EnumerateItems(document, "stock_availables"))
        {
            var productExternalId = GetString(item, "id_product");
            if (string.IsNullOrWhiteSpace(productExternalId))
            {
                continue;
            }

            quantitiesByProduct[productExternalId] = quantitiesByProduct.GetValueOrDefault(productExternalId) + (GetDecimal(item, "quantity") ?? 0);
        }

        var created = 0;
        var updated = 0;
        foreach (var (productExternalId, quantity) in quantitiesByProduct)
        {
            var productRef = await FindReferenceAsync("products", productExternalId, cancellationToken);
            if (productRef is null)
            {
                continue;
            }

            var (stockItem, isCreated) = await ResolveStockItemForPrestashopProductAsync(productRef.EntityId, defaultWarehouse, cancellationToken);
            if (isCreated)
            {
                stockItem.QuantityOnHand = quantity;
                created += 1;
            }
            else
            {
                var delta = quantity - stockItem.QuantityOnHand;
                stockItem.QuantityOnHand = quantity;
                if (delta != 0)
                {
                    updated += 1;
                    db.StockMovements.Add(new StockMovement
                    {
                        ProductId = productRef.EntityId,
                        WarehouseId = stockItem.WarehouseId,
                        Quantity = delta,
                        Type = "PrestaShopSync",
                        Reason = "Synchronisation PrestaShop",
                        ReferenceModule = "prestashop"
                    });
                }
            }
        }

        return ImportSummary.Ok("stock_availables", created, updated);
    }

    private async Task<ImportSummary> ImportOrdersAsync(string apiBaseUrl, CancellationToken cancellationToken)
    {
        using var document = await GetJsonAsync($"{apiBaseUrl}/orders?display=full&limit=50&output_format=JSON", "orders", cancellationToken);
        var created = 0;
        var updated = 0;
        var createdOrders = new List<PrestashopImportedOrderNotification>();

        foreach (var item in EnumerateItems(document, "orders"))
        {
            var externalId = GetRequiredId(item);
            if (externalId is null)
            {
                continue;
            }

            var reference = FirstNonEmpty(GetString(item, "reference"), externalId);
            var orderNumber = Truncate($"PS-{reference}", 80);
            var externalReference = await FindReferenceAsync("orders", externalId, cancellationToken);
            if (externalReference is not null && string.Equals(externalReference.Module, "orders.deleted", StringComparison.OrdinalIgnoreCase))
            {
                continue;
            }

            SalesOrder? order = null;
            if (externalReference is not null)
            {
                order = await db.SalesOrders.FirstOrDefaultAsync(x => x.Id == externalReference.EntityId, cancellationToken);
            }

            var currentStateId = GetPrestashopResourceId(item, "current_state") ?? GetString(item, "current_state");
            var status = MapOrderStatus(currentStateId);
            var externalStatusName = await ResolveOrderStateNameAsync(apiBaseUrl, currentStateId, cancellationToken);
            var carrierName = await ResolveCarrierNameAsync(apiBaseUrl, GetPrestashopResourceId(item, "id_carrier") ?? GetString(item, "id_carrier"), cancellationToken);
            var shippingAddress = await ResolveDeliveryAddressAsync(apiBaseUrl, GetPrestashopResourceId(item, "id_address_delivery") ?? GetString(item, "id_address_delivery"), cancellationToken);
            if (order is null)
            {
                var customer = await ResolveOrderCustomerAsync(GetString(item, "id_customer"), cancellationToken);
                order = new SalesOrder { Number = orderNumber, CustomerId = customer.Id, Status = status };
                db.SalesOrders.Add(order);
                db.ExternalReferences.Add(new ExternalReference { Provider = Provider, ExternalId = ExternalKey("orders", externalId), Module = "orders", EntityId = order.Id });
                AddOrderLines(order, item);
                ApplyOrderDetails(order, item, externalStatusName);
                ApplyOrderShippingDetails(order, item, carrierName, shippingAddress);
                db.SalesOrderStatusHistories.Add(new SalesOrderStatusHistory { SalesOrderId = order.Id, Status = status });
                createdOrders.Add(new PrestashopImportedOrderNotification(order.Id, order.Number));
                created += 1;
            }
            else
            {
                if (!string.Equals(order.Status, status, StringComparison.OrdinalIgnoreCase))
                {
                    order.Status = status;
                    db.SalesOrderStatusHistories.Add(new SalesOrderStatusHistory { SalesOrderId = order.Id, Status = status });
                }

                ApplyOrderDetails(order, item, externalStatusName);
                ApplyOrderShippingDetails(order, item, carrierName, shippingAddress);
                if (HasTrackedChanges(order))
                {
                    updated += 1;
                }
            }
        }

        return ImportSummary.Ok("orders", created, updated, createdOrders);
    }

    private async Task<ImportSummary> ImportServiceTicketsAsync(string apiBaseUrl, PrestashopConnection connection, CancellationToken cancellationToken)
    {
        using var threadsDocument = await GetJsonAsync($"{apiBaseUrl}/customer_threads?display=full&sort=[date_upd_DESC]&limit=200&output_format=JSON", "customer_threads", cancellationToken);
        using var messagesDocument = await GetJsonAsync($"{apiBaseUrl}/customer_messages?display=full&sort=[date_add_DESC]&limit=200&output_format=JSON", "customer_messages", cancellationToken);

        var created = 0;
        var updated = 0;
        var ticketsByThread = new Dictionary<string, ServiceTicket>(StringComparer.OrdinalIgnoreCase);
        var newMessagesByTicket = new Dictionary<Guid, int>();

        foreach (var thread in EnumerateItems(threadsDocument, "customer_threads"))
        {
            var threadExternalId = GetRequiredId(thread);
            if (string.IsNullOrWhiteSpace(threadExternalId))
            {
                continue;
            }

            var upsert = await UpsertServiceTicketFromPrestashopThreadAsync(apiBaseUrl, thread, threadExternalId, cancellationToken);
            ticketsByThread[threadExternalId] = upsert.Ticket;
            if (upsert.Created)
            {
                created += 1;
            }
            else if (upsert.Updated)
            {
                updated += 1;
            }
        }

        foreach (var messageItem in EnumerateItems(messagesDocument, "customer_messages"))
        {
            var messageExternalId = GetRequiredId(messageItem);
            var threadExternalId = GetPrestashopResourceId(messageItem, "id_customer_thread") ?? GetString(messageItem, "id_customer_thread");
            if (string.IsNullOrWhiteSpace(messageExternalId) || string.IsNullOrWhiteSpace(threadExternalId))
            {
                continue;
            }

            if (await FindReferenceAsync("customer_messages", messageExternalId, cancellationToken) is not null)
            {
                continue;
            }

            if (!ticketsByThread.TryGetValue(threadExternalId, out var ticket))
            {
                var thread = await FetchPrestashopThreadAsync(apiBaseUrl, threadExternalId, cancellationToken);
                if (thread is null)
                {
                    continue;
                }

                var upsert = await UpsertServiceTicketFromPrestashopThreadAsync(apiBaseUrl, thread.Value, threadExternalId, cancellationToken);
                ticket = upsert.Ticket;
                ticketsByThread[threadExternalId] = ticket;
                if (upsert.Created)
                {
                    created += 1;
                }
                else if (upsert.Updated)
                {
                    updated += 1;
                }
            }

            var body = NormalizePrestashopMessageBody(GetString(messageItem, "message"));
            if (string.IsNullOrWhiteSpace(body))
            {
                continue;
            }

            var message = new ServiceTicketMessage
            {
                ServiceTicketId = ticket.Id,
                Body = body,
                IsInternal = IsPrestashopEmployeeMessage(messageItem),
                CreatedAt = GetDateTimeOffset(messageItem, "date_add", "date_upd") ?? DateTimeOffset.UtcNow
            };

            db.ServiceTicketMessages.Add(message);
            db.ExternalReferences.Add(new ExternalReference
            {
                Provider = Provider,
                ExternalId = ExternalKey("customer_messages", messageExternalId),
                Module = "customer_messages",
                EntityId = message.Id
            });

            if (string.IsNullOrWhiteSpace(ticket.Description))
            {
                ticket.Description = Truncate(body, 1000);
            }

            ticket.UpdatedAt = DateTimeOffset.UtcNow;
            newMessagesByTicket[ticket.Id] = newMessagesByTicket.GetValueOrDefault(ticket.Id) + 1;
        }

        var notifications = new List<PrestashopImportedServiceTicketNotification>();
        foreach (var (ticketId, messageCount) in newMessagesByTicket)
        {
            var ticket = ticketsByThread.Values.FirstOrDefault(x => x.Id == ticketId)
                ?? await db.ServiceTickets.FirstOrDefaultAsync(x => x.Id == ticketId, cancellationToken);
            if (ticket is not null)
            {
                notifications.Add(new PrestashopImportedServiceTicketNotification(ticket.Id, ticket.Number, ticket.Subject, messageCount));
            }
        }

        return ImportSummary.Ok("customer_threads", created, updated, null, notifications);
    }

    private async Task<(ServiceTicket Ticket, bool Created, bool Updated)> UpsertServiceTicketFromPrestashopThreadAsync(string apiBaseUrl, JsonElement thread, string threadExternalId, CancellationToken cancellationToken)
    {
        var existingReference = await FindReferenceAsync("customer_threads", threadExternalId, cancellationToken);
        ServiceTicket? ticket = null;
        if (existingReference is not null)
        {
            ticket = await db.ServiceTickets.FirstOrDefaultAsync(x => x.Id == existingReference.EntityId, cancellationToken);
        }

        var customer = await ResolveServiceTicketCustomerAsync(thread, threadExternalId, cancellationToken);
        var productId = await ResolveEntityIdByExternalIdAsync("products", GetPrestashopResourceId(thread, "id_product") ?? GetString(thread, "id_product"), cancellationToken);
        var orderId = await ResolveEntityIdByExternalIdAsync("orders", GetPrestashopResourceId(thread, "id_order") ?? GetString(thread, "id_order"), cancellationToken);
        var subject = await BuildPrestashopServiceTicketSubjectAsync(thread, threadExternalId, orderId, cancellationToken);
        var status = MapServiceTicketStatus(GetString(thread, "status"));
        var createdAt = GetDateTimeOffset(thread, "date_add", "date_upd") ?? DateTimeOffset.UtcNow;

        if (ticket is null)
        {
            ticket = new ServiceTicket
            {
                Number = await NextServiceTicketNumberAsync(cancellationToken),
                CustomerId = customer.Id,
                ProductId = productId,
                SalesOrderId = orderId,
                Subject = subject,
                Priority = "Normal",
                Status = status,
                CreatedAt = createdAt
            };

            db.ServiceTickets.Add(ticket);
            db.ExternalReferences.Add(new ExternalReference
            {
                Provider = Provider,
                ExternalId = ExternalKey("customer_threads", threadExternalId),
                Module = "customer_threads",
                EntityId = ticket.Id
            });
            db.ServiceTicketStatusHistories.Add(new ServiceTicketStatusHistory
            {
                ServiceTicketId = ticket.Id,
                Status = ticket.Status,
                Comment = "Ticket cree depuis PrestaShop",
                ChangedAt = createdAt
            });

            return (ticket, true, false);
        }

        var updated = false;
        if (ticket.CustomerId != customer.Id)
        {
            ticket.CustomerId = customer.Id;
            updated = true;
        }

        if (ticket.ProductId != productId)
        {
            ticket.ProductId = productId;
            updated = true;
        }

        if (ticket.SalesOrderId != orderId)
        {
            ticket.SalesOrderId = orderId;
            updated = true;
        }

        if (!string.Equals(ticket.Subject, subject, StringComparison.Ordinal))
        {
            ticket.Subject = subject;
            updated = true;
        }

        if (!string.Equals(ticket.Status, status, StringComparison.OrdinalIgnoreCase))
        {
            ticket.Status = status;
            updated = true;
            db.ServiceTicketStatusHistories.Add(new ServiceTicketStatusHistory
            {
                ServiceTicketId = ticket.Id,
                Status = ticket.Status,
                Comment = "Statut PrestaShop synchronise"
            });
        }

        if (updated)
        {
            ticket.UpdatedAt = DateTimeOffset.UtcNow;
        }

        return (ticket, false, updated);
    }

    private async Task<JsonElement?> FetchPrestashopThreadAsync(string apiBaseUrl, string threadExternalId, CancellationToken cancellationToken)
    {
        try
        {
            using var document = await GetJsonAsync($"{apiBaseUrl}/customer_threads/{threadExternalId}?display=full&output_format=JSON", "customer_threads", cancellationToken);
            return FindFirstItem(document, "customer_thread", "customer_threads")?.Clone();
        }
        catch
        {
            return null;
        }
    }

    private async Task<Customer> ResolveServiceTicketCustomerAsync(JsonElement thread, string threadExternalId, CancellationToken cancellationToken)
    {
        var customerExternalId = GetPrestashopResourceId(thread, "id_customer") ?? GetString(thread, "id_customer");
        if (!string.IsNullOrWhiteSpace(customerExternalId) && customerExternalId is not "0")
        {
            var externalReference = await FindReferenceAsync("customers", customerExternalId, cancellationToken);
            if (externalReference is not null)
            {
                var existing = await db.Customers.Include(x => x.Contacts).FirstOrDefaultAsync(x => x.Id == externalReference.EntityId, cancellationToken);
                if (existing is not null)
                {
                    return existing;
                }
            }

            var customerByCode = await db.Customers.Include(x => x.Contacts).FirstOrDefaultAsync(x => x.Code == $"PS-C-{customerExternalId}", cancellationToken);
            if (customerByCode is not null)
            {
                await UpsertExternalReferenceAsync("customers", customerExternalId, customerByCode.Id, cancellationToken);
                return customerByCode;
            }
        }

        var email = TruncateOptional(GetString(thread, "email"), 320);
        if (!string.IsNullOrWhiteSpace(email))
        {
            var existingByEmail = await db.Customers
                .Include(x => x.Contacts)
                .FirstOrDefaultAsync(x => x.Email == email || x.Contacts.Any(contact => contact.Email == email), cancellationToken);
            if (existingByEmail is not null)
            {
                if (!string.IsNullOrWhiteSpace(customerExternalId) && customerExternalId is not "0")
                {
                    await UpsertExternalReferenceAsync("customers", customerExternalId, existingByEmail.Id, cancellationToken);
                }

                return existingByEmail;
            }
        }

        var customer = new Customer
        {
            Code = Truncate(!string.IsNullOrWhiteSpace(customerExternalId) && customerExternalId is not "0" ? $"PS-C-{customerExternalId}" : $"PS-SAV-{threadExternalId}", 60),
            CompanyName = Truncate(FirstNonEmpty(email, $"Client PrestaShop SAV {threadExternalId}"), 240),
            Email = email,
            CustomerType = "PrestaShop",
            Source = Provider
        };
        if (!string.IsNullOrWhiteSpace(email))
        {
            customer.Contacts.Add(new CustomerContact
            {
                Email = email,
                JobTitle = "PrestaShop SAV",
                IsPrimary = true
            });
        }

        db.Customers.Add(customer);
        if (!string.IsNullOrWhiteSpace(customerExternalId) && customerExternalId is not "0")
        {
            db.ExternalReferences.Add(new ExternalReference { Provider = Provider, ExternalId = ExternalKey("customers", customerExternalId), Module = "customers", EntityId = customer.Id });
        }

        return customer;
    }

    private async Task<Guid?> ResolveEntityIdByExternalIdAsync(string module, string? externalId, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(externalId) || externalId is "0")
        {
            return null;
        }

        var reference = await FindReferenceAsync(module, externalId, cancellationToken);
        return reference?.EntityId;
    }

    private async Task<string> BuildPrestashopServiceTicketSubjectAsync(JsonElement thread, string threadExternalId, Guid? orderId, CancellationToken cancellationToken)
    {
        var email = GetString(thread, "email");
        string? orderNumber = null;
        if (orderId.HasValue)
        {
            orderNumber = await db.SalesOrders.Where(x => x.Id == orderId.Value).Select(x => x.Number).FirstOrDefaultAsync(cancellationToken);
        }

        var subject = FirstNonEmpty(
            GetString(thread, "subject"),
            !string.IsNullOrWhiteSpace(orderNumber) ? $"Message PrestaShop {orderNumber}" : null,
            !string.IsNullOrWhiteSpace(email) ? $"Message PrestaShop de {email}" : null,
            $"Message PrestaShop #{threadExternalId}");

        return Truncate(subject, 240);
    }

    private async Task<string> NextServiceTicketNumberAsync(CancellationToken cancellationToken)
    {
        var prefix = $"SAV-{DateTime.UtcNow:yyyy}-";
        var persistedCount = await db.ServiceTickets.CountAsync(x => x.Number.StartsWith(prefix), cancellationToken);
        var pendingCount = db.ServiceTickets.Local.Count(x => x.Number.StartsWith(prefix, StringComparison.OrdinalIgnoreCase));
        return $"{prefix}{persistedCount + pendingCount + 1:0000}";
    }

    private static string MapServiceTicketStatus(string? prestashopStatus)
        => prestashopStatus?.Trim().ToLowerInvariant() switch
        {
            "closed" => "Closed",
            "pending1" or "pending2" => "WaitingCustomer",
            _ => "Open"
        };

    private static bool IsPrestashopEmployeeMessage(JsonElement message)
    {
        var employeeId = GetPrestashopResourceId(message, "id_employee") ?? GetString(message, "id_employee");
        return !string.IsNullOrWhiteSpace(employeeId) && employeeId is not "0";
    }

    private static string NormalizePrestashopMessageBody(string? body)
    {
        if (string.IsNullOrWhiteSpace(body))
        {
            return string.Empty;
        }

        var decoded = WebUtility.HtmlDecode(body).Replace("\r\n", "\n").Replace('\r', '\n');
        decoded = Regex.Replace(decoded, @"<\s*br\s*/?\s*>", "\n", RegexOptions.IgnoreCase);
        decoded = Regex.Replace(decoded, @"</\s*p\s*>", "\n", RegexOptions.IgnoreCase);
        decoded = Regex.Replace(decoded, @"<[^>]+>", " ");
        decoded = Regex.Replace(decoded, @"[ \t]+", " ");
        decoded = Regex.Replace(decoded, @"\n{3,}", "\n\n");
        return decoded.Trim();
    }

    private async Task<Product?> FindProductByExternalIdAsync(string externalId, CancellationToken cancellationToken)
    {
        var externalReference = await FindReferenceAsync("products", externalId, cancellationToken);
        if (externalReference is not null)
        {
            return await db.Products.FirstOrDefaultAsync(x => x.Id == externalReference.EntityId, cancellationToken);
        }

        return null;
    }

    private async Task<Customer?> FindCustomerAsync(string externalId, string code, CancellationToken cancellationToken)
    {
        var externalReference = await FindReferenceAsync("customers", externalId, cancellationToken);
        if (externalReference is not null)
        {
            return await db.Customers.Include(x => x.Contacts).FirstOrDefaultAsync(x => x.Id == externalReference.EntityId, cancellationToken);
        }

        var customer = await db.Customers.Include(x => x.Contacts).FirstOrDefaultAsync(x => x.Code == code, cancellationToken);
        if (customer is not null)
        {
            db.ExternalReferences.Add(new ExternalReference { Provider = Provider, ExternalId = ExternalKey("customers", externalId), Module = "customers", EntityId = customer.Id });
        }

        return customer;
    }

    private async Task<ExternalReference?> FindReferenceAsync(string module, string externalId, CancellationToken cancellationToken)
        => await db.ExternalReferences.FirstOrDefaultAsync(x => x.Provider == Provider && x.ExternalId == ExternalKey(module, externalId), cancellationToken);

    private async Task<ProductCategory?> ResolveProductCategoryAsync(string apiBaseUrl, JsonElement product, CancellationToken cancellationToken)
    {
        var categoryExternalId = FirstNonEmpty(GetPrestashopResourceId(product, "id_category_default"), GetFirstAssociationId(product, "categories"));
        if (string.IsNullOrWhiteSpace(categoryExternalId) || categoryExternalId is "0")
        {
            return null;
        }

        if (categoryCache.TryGetValue(categoryExternalId, out var cachedCategory))
        {
            return cachedCategory;
        }

        var category = await FindCategoryByExternalIdAsync(categoryExternalId, cancellationToken);
        if (category is null)
        {
            var categoryName = await FetchPrestashopResourceNameAsync(apiBaseUrl, "categories", "category", categoryExternalId, cancellationToken)
                ?? $"Categorie PrestaShop {categoryExternalId}";
            categoryName = Truncate(categoryName, 160);
            category = db.ProductCategories.Local.FirstOrDefault(x => x.Name == categoryName)
                ?? await db.ProductCategories.FirstOrDefaultAsync(x => x.Name == categoryName, cancellationToken);
            if (category is null)
            {
                category = new ProductCategory { Name = categoryName };
                db.ProductCategories.Add(category);
            }

            await UpsertExternalReferenceAsync("categories", categoryExternalId, category.Id, cancellationToken);
        }

        categoryCache[categoryExternalId] = category;
        return category;
    }

    private async Task<ProductBrand?> ResolveProductBrandAsync(string apiBaseUrl, JsonElement product, CancellationToken cancellationToken)
    {
        var manufacturerExternalId = GetPrestashopResourceId(product, "id_manufacturer");
        var manufacturerNameFromProduct = GetString(product, "manufacturer_name");
        if (string.IsNullOrWhiteSpace(manufacturerExternalId) || manufacturerExternalId is "0")
        {
            return await ResolveBrandByNameAsync(manufacturerNameFromProduct, cancellationToken);
        }

        if (brandCache.TryGetValue(manufacturerExternalId, out var cachedBrand))
        {
            return cachedBrand;
        }

        var brand = await FindBrandByExternalIdAsync(manufacturerExternalId, cancellationToken);
        if (brand is null)
        {
            var brandName = await FetchPrestashopResourceNameAsync(apiBaseUrl, "manufacturers", "manufacturer", manufacturerExternalId, cancellationToken)
                ?? manufacturerNameFromProduct
                ?? $"Fabricant PrestaShop {manufacturerExternalId}";
            brand = await ResolveBrandByNameAsync(brandName, cancellationToken);
            if (brand is not null)
            {
                await UpsertExternalReferenceAsync("manufacturers", manufacturerExternalId, brand.Id, cancellationToken);
            }
        }

        brandCache[manufacturerExternalId] = brand;
        return brand;
    }

    private async Task<ProductSupplier?> ResolveProductSupplierAsync(string apiBaseUrl, JsonElement product, string productExternalId, CancellationToken cancellationToken)
    {
        var productSupplierExternalId = GetFirstAssociationId(product, "product_suppliers");
        var supplierExternalId = FirstNonEmpty(
            GetPrestashopResourceId(product, "id_supplier"),
            GetFirstAssociationValue(product, "product_suppliers", "id_supplier"),
            GetFirstAssociationId(product, "suppliers"));

        if ((string.IsNullOrWhiteSpace(supplierExternalId) || supplierExternalId is "0") && !string.IsNullOrWhiteSpace(productSupplierExternalId))
        {
            supplierExternalId = await FetchSupplierIdFromProductSupplierAsync(apiBaseUrl, productSupplierExternalId, cancellationToken);
        }

        if (string.IsNullOrWhiteSpace(supplierExternalId) || supplierExternalId is "0")
        {
            supplierExternalId = await FetchDefaultProductSupplierIdAsync(apiBaseUrl, productExternalId, cancellationToken);
        }

        if (string.IsNullOrWhiteSpace(supplierExternalId) || supplierExternalId is "0")
        {
            return null;
        }

        if (supplierCache.TryGetValue(supplierExternalId, out var cachedSupplier))
        {
            return cachedSupplier;
        }

        var supplier = await FindSupplierByExternalIdAsync(supplierExternalId, cancellationToken);
        if (supplier is null)
        {
            var supplierName = await FetchPrestashopResourceNameAsync(apiBaseUrl, "suppliers", "supplier", supplierExternalId, cancellationToken)
                ?? $"Fournisseur PrestaShop {supplierExternalId}";
            supplier = await ResolveSupplierByNameAsync(supplierName, cancellationToken);
            if (supplier is not null)
            {
                await UpsertExternalReferenceAsync("suppliers", supplierExternalId, supplier.Id, cancellationToken);
            }
        }

        supplierCache[supplierExternalId] = supplier;
        return supplier;
    }

    private async Task<string?> FetchSupplierIdFromProductSupplierAsync(string apiBaseUrl, string productSupplierExternalId, CancellationToken cancellationToken)
    {
        try
        {
            using var document = await GetJsonAsync($"{apiBaseUrl}/product_suppliers/{productSupplierExternalId}?display=full&output_format=JSON", "product_suppliers", cancellationToken);
            var productSupplier = FindFirstItem(document, "product_supplier", "product_suppliers");
            return productSupplier is null ? null : GetPrestashopResourceId(productSupplier.Value, "id_supplier") ?? GetString(productSupplier.Value, "id_supplier");
        }
        catch
        {
            return null;
        }
    }

    private async Task<string?> FetchDefaultProductSupplierIdAsync(string apiBaseUrl, string productExternalId, CancellationToken cancellationToken)
    {
        try
        {
            using var document = await GetJsonAsync($"{apiBaseUrl}/product_suppliers?display=full&filter[id_product]=[{productExternalId}]&output_format=JSON", "product_suppliers", cancellationToken);
            foreach (var productSupplier in EnumerateItems(document, "product_suppliers"))
            {
                var supplierExternalId = GetPrestashopResourceId(productSupplier, "id_supplier") ?? GetString(productSupplier, "id_supplier");
                if (!string.IsNullOrWhiteSpace(supplierExternalId) && supplierExternalId is not "0")
                {
                    return supplierExternalId;
                }
            }
        }
        catch
        {
            return null;
        }

        return null;
    }

    private async Task<ProductCategory?> FindCategoryByExternalIdAsync(string externalId, CancellationToken cancellationToken)
    {
        var reference = db.ExternalReferences.Local.FirstOrDefault(x => x.Provider == Provider && x.ExternalId == ExternalKey("categories", externalId))
            ?? await FindReferenceAsync("categories", externalId, cancellationToken);
        return reference is null
            ? null
            : db.ProductCategories.Local.FirstOrDefault(x => x.Id == reference.EntityId)
              ?? await db.ProductCategories.FirstOrDefaultAsync(x => x.Id == reference.EntityId, cancellationToken);
    }

    private async Task<ProductSupplier?> FindSupplierByExternalIdAsync(string externalId, CancellationToken cancellationToken)
    {
        var reference = db.ExternalReferences.Local.FirstOrDefault(x => x.Provider == Provider && x.ExternalId == ExternalKey("suppliers", externalId))
            ?? await FindReferenceAsync("suppliers", externalId, cancellationToken);
        return reference is null
            ? null
            : db.ProductSuppliers.Local.FirstOrDefault(x => x.Id == reference.EntityId)
              ?? await db.ProductSuppliers.FirstOrDefaultAsync(x => x.Id == reference.EntityId, cancellationToken);
    }

    private async Task<ProductBrand?> FindBrandByExternalIdAsync(string externalId, CancellationToken cancellationToken)
    {
        var reference = db.ExternalReferences.Local.FirstOrDefault(x => x.Provider == Provider && x.ExternalId == ExternalKey("manufacturers", externalId))
            ?? await FindReferenceAsync("manufacturers", externalId, cancellationToken);
        return reference is null
            ? null
            : db.ProductBrands.Local.FirstOrDefault(x => x.Id == reference.EntityId)
              ?? await db.ProductBrands.FirstOrDefaultAsync(x => x.Id == reference.EntityId, cancellationToken);
    }

    private async Task<ProductBrand?> ResolveBrandByNameAsync(string? brandName, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(brandName))
        {
            return null;
        }

        brandName = Truncate(brandName.Trim(), 200);
        var brand = db.ProductBrands.Local.FirstOrDefault(x => x.Name == brandName)
            ?? await db.ProductBrands.FirstOrDefaultAsync(x => x.Name == brandName, cancellationToken);
        if (brand is not null)
        {
            return brand;
        }

        brand = new ProductBrand { Name = brandName };
        db.ProductBrands.Add(brand);
        return brand;
    }

    private async Task<ProductSupplier?> ResolveSupplierByNameAsync(string? supplierName, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(supplierName))
        {
            return null;
        }

        supplierName = Truncate(supplierName.Trim(), 200);
        var supplier = db.ProductSuppliers.Local.FirstOrDefault(x => x.Name == supplierName)
            ?? await db.ProductSuppliers.FirstOrDefaultAsync(x => x.Name == supplierName, cancellationToken);
        if (supplier is not null)
        {
            return supplier;
        }

        supplier = new ProductSupplier { Name = supplierName };
        db.ProductSuppliers.Add(supplier);
        return supplier;
    }

    private async Task<string?> FetchPrestashopResourceNameAsync(string apiBaseUrl, string pluralResourceName, string singularResourceName, string externalId, CancellationToken cancellationToken)
    {
        try
        {
            using var document = await GetJsonAsync($"{apiBaseUrl}/{pluralResourceName}/{externalId}?display=full&output_format=JSON", pluralResourceName, cancellationToken);
            var resource = FindFirstItem(document, singularResourceName, pluralResourceName);
            return resource is null ? null : GetLocalizedString(resource.Value, "name");
        }
        catch
        {
            return null;
        }
    }

    private async Task<string?> ResolveCarrierNameAsync(string apiBaseUrl, string? carrierExternalId, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(carrierExternalId) || carrierExternalId is "0")
        {
            return null;
        }

        try
        {
            using var document = await GetJsonAsync($"{apiBaseUrl}/carriers/{carrierExternalId}?display=full&output_format=JSON", "carriers", cancellationToken);
            var carrier = FindFirstItem(document, "carrier", "carriers");
            return carrier is null ? null : TruncateOptional(FirstNonEmpty(GetLocalizedString(carrier.Value, "name"), GetString(carrier.Value, "name")), 160);
        }
        catch
        {
            return null;
        }
    }

    private async Task<string?> ResolveOrderStateNameAsync(string apiBaseUrl, string? stateExternalId, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(stateExternalId) || stateExternalId is "0")
        {
            return null;
        }

        return await FetchPrestashopResourceNameAsync(apiBaseUrl, "order_states", "order_state", stateExternalId, cancellationToken);
    }

    private async Task<PrestashopDeliveryAddress?> ResolveDeliveryAddressAsync(string apiBaseUrl, string? addressExternalId, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(addressExternalId) || addressExternalId is "0")
        {
            return null;
        }

        try
        {
            using var document = await GetJsonAsync($"{apiBaseUrl}/addresses/{addressExternalId}?display=full&output_format=JSON", "addresses", cancellationToken);
            var address = FindFirstItem(document, "address", "addresses");
            if (address is null)
            {
                return null;
            }

            var countryId = GetPrestashopResourceId(address.Value, "id_country") ?? GetString(address.Value, "id_country");
            var country = !string.IsNullOrWhiteSpace(countryId)
                ? await FetchPrestashopResourceNameAsync(apiBaseUrl, "countries", "country", countryId, cancellationToken)
                : null;

            return new PrestashopDeliveryAddress(
                TruncateOptional(FirstNonEmpty(GetString(address.Value, "company"), $"{GetString(address.Value, "firstname")} {GetString(address.Value, "lastname")}".Trim()), 220),
                TruncateOptional(GetString(address.Value, "address1"), 240),
                TruncateOptional(GetString(address.Value, "address2"), 240),
                TruncateOptional(GetString(address.Value, "postcode"), 40),
                TruncateOptional(GetString(address.Value, "city"), 160),
                TruncateOptional(FirstNonEmpty(country, countryId), 120),
                TruncateOptional(FirstNonEmpty(GetString(address.Value, "phone_mobile"), GetString(address.Value, "phone")), 80),
                TruncateOptional(GetString(address.Value, "email"), 220));
        }
        catch
        {
            return null;
        }
    }

    private static void ApplyOrderShippingDetails(SalesOrder order, JsonElement orderItem, string? carrierName, PrestashopDeliveryAddress? address)
    {
        order.ShippingServiceName = TruncateOptional(FirstNonEmpty(GetString(orderItem, "carrier_name"), carrierName, GetString(orderItem, "module"), order.ShippingServiceName), 180);
        order.ShippingCarrierName = TruncateOptional(FirstNonEmpty(carrierName, order.ShippingCarrierName, order.ShippingServiceName), 160);
        order.ShippingTrackingNumber = TruncateOptional(FirstNonEmpty(GetString(orderItem, "shipping_number", "delivery_number", "tracking_number"), order.ShippingTrackingNumber), 120);
        if (address is null)
        {
            return;
        }

        order.ShippingAddressName = FirstNonEmpty(address.Name, order.ShippingAddressName);
        order.ShippingAddressLine1 = FirstNonEmpty(address.Line1, order.ShippingAddressLine1);
        order.ShippingAddressLine2 = FirstNonEmpty(address.Line2, order.ShippingAddressLine2);
        order.ShippingPostalCode = FirstNonEmpty(address.PostalCode, order.ShippingPostalCode);
        order.ShippingCity = FirstNonEmpty(address.City, order.ShippingCity);
        order.ShippingCountry = FirstNonEmpty(address.Country, order.ShippingCountry);
        order.ShippingPhone = FirstNonEmpty(address.Phone, order.ShippingPhone);
        order.ShippingEmail = FirstNonEmpty(address.Email, order.ShippingEmail);
    }

    private static void ApplyOrderDetails(SalesOrder order, JsonElement orderItem, string? externalStatusName)
    {
        order.ExternalStatusName = TruncateOptional(FirstNonEmpty(externalStatusName, order.ExternalStatusName), 160);
        order.OrderedAt = GetDateTimeOffset(orderItem, "date_add", "date_upd") ?? order.OrderedAt;
        order.PaymentMethod = TruncateOptional(FirstNonEmpty(GetString(orderItem, "payment"), order.PaymentMethod), 160);
        order.PaymentModule = TruncateOptional(FirstNonEmpty(GetString(orderItem, "module"), order.PaymentModule), 120);
        order.PaidTotal = GetDecimal(orderItem, "total_paid_tax_incl", "total_paid") ?? order.PaidTotal;
        order.ProductsTotal = GetDecimal(orderItem, "total_products_wt", "total_products") ?? order.ProductsTotal;
        order.ShippingTotal = GetDecimal(orderItem, "total_shipping_tax_incl", "total_shipping") ?? order.ShippingTotal;
        order.ShippingWeightKg = GetDecimal(orderItem, "total_weight", "weight") ?? order.ShippingWeightKg;
        order.InvoiceReference = BuildInvoiceReference(GetString(orderItem, "invoice_number")) ?? order.InvoiceReference;
        order.CreatedAt = order.OrderedAt ?? order.CreatedAt;
    }

    private static string? BuildInvoiceReference(string? invoiceNumber)
    {
        if (string.IsNullOrWhiteSpace(invoiceNumber) || invoiceNumber is "0")
        {
            return null;
        }

        return invoiceNumber.StartsWith('#') ? Truncate(invoiceNumber, 80) : Truncate($"#{invoiceNumber}", 80);
    }

    private static JsonElement? FindFirstItem(JsonDocument document, params string[] propertyNames)
    {
        foreach (var propertyName in propertyNames)
        {
            var item = EnumerateItems(document, propertyName).FirstOrDefault();
            if (item.ValueKind != JsonValueKind.Undefined)
            {
                return item;
            }
        }

        return document.RootElement.ValueKind == JsonValueKind.Object && document.RootElement.TryGetProperty("id", out _)
            ? document.RootElement
            : null;
    }

    private async Task UpsertExternalReferenceAsync(string module, string externalId, Guid entityId, CancellationToken cancellationToken)
    {
        var key = ExternalKey(module, externalId);
        var reference = db.ExternalReferences.Local.FirstOrDefault(x => x.Provider == Provider && x.ExternalId == key)
            ?? await db.ExternalReferences.FirstOrDefaultAsync(x => x.Provider == Provider && x.ExternalId == key, cancellationToken);
        if (reference is null)
        {
            db.ExternalReferences.Add(new ExternalReference { Provider = Provider, ExternalId = key, Module = module, EntityId = entityId });
            return;
        }

        reference.Module = module;
        reference.EntityId = entityId;
    }

    private async Task<Warehouse> GetOrCreatePrestashopWarehouseAsync(PrestashopConnection connection, CancellationToken cancellationToken)
    {
        if (connection.WarehouseId.HasValue)
        {
            var assignedWarehouse = await db.Warehouses.FirstOrDefaultAsync(x => x.Id == connection.WarehouseId.Value, cancellationToken);
            if (assignedWarehouse is not null)
            {
                return assignedWarehouse;
            }
        }

        var warehouse = await db.Warehouses.FirstOrDefaultAsync(x => x.Name == DefaultWarehouseName, cancellationToken);
        if (warehouse is null)
        {
            warehouse = new Warehouse { Name = DefaultWarehouseName };
            db.Warehouses.Add(warehouse);
        }

        connection.WarehouseId = warehouse.Id;
        return warehouse;
    }

    private async Task<(StockItem Item, bool Created)> ResolveStockItemForPrestashopProductAsync(Guid productId, Warehouse defaultWarehouse, CancellationToken cancellationToken)
    {
        var stockItem = await db.StockItems
            .Where(x => x.ProductId == productId)
            .OrderByDescending(x => x.QuantityOnHand > 0)
            .ThenByDescending(x => x.UpdatedAt ?? x.CreatedAt)
            .FirstOrDefaultAsync(cancellationToken);
        if (stockItem is not null)
        {
            return (stockItem, false);
        }

        stockItem = new StockItem
        {
            ProductId = productId,
            WarehouseId = defaultWarehouse.Id
        };
        db.StockItems.Add(stockItem);
        return (stockItem, true);
    }

    private async Task<Customer> ResolveOrderCustomerAsync(string? customerExternalId, CancellationToken cancellationToken)
    {
        if (!string.IsNullOrWhiteSpace(customerExternalId))
        {
            var externalReference = await FindReferenceAsync("customers", customerExternalId, cancellationToken);
            if (externalReference is not null)
            {
                var existing = await db.Customers.FirstOrDefaultAsync(x => x.Id == externalReference.EntityId, cancellationToken);
                if (existing is not null)
                {
                    return existing;
                }
            }
        }

        var code = Truncate($"PS-C-{FirstNonEmpty(customerExternalId, "unknown")}", 60);
        var customer = await db.Customers.FirstOrDefaultAsync(x => x.Code == code, cancellationToken);
        if (customer is not null)
        {
            return customer;
        }

        customer = new Customer { Code = code, CompanyName = $"Client PrestaShop {FirstNonEmpty(customerExternalId, "inconnu")}" };
        db.Customers.Add(customer);
        if (!string.IsNullOrWhiteSpace(customerExternalId))
        {
            db.ExternalReferences.Add(new ExternalReference { Provider = Provider, ExternalId = ExternalKey("customers", customerExternalId), Module = "customers", EntityId = customer.Id });
        }

        return customer;
    }

    private void AddOrderLines(SalesOrder order, JsonElement orderItem)
    {
        var lines = EnumerateOrderRows(orderItem).ToList();
        if (lines.Count == 0)
        {
            db.SalesOrderLines.Add(new SalesOrderLine { SalesOrderId = order.Id, Description = $"Commande PrestaShop {order.Number}", Quantity = 1, UnitPrice = GetDecimal(orderItem, "total_paid") ?? 0 });
            return;
        }

        foreach (var line in lines)
        {
            var productExternalId = GetString(line, "product_id", "id_product");
            Guid? productId = null;
            if (!string.IsNullOrWhiteSpace(productExternalId))
            {
                productId = db.ExternalReferences.Local.FirstOrDefault(x => x.Provider == Provider && x.ExternalId == ExternalKey("products", productExternalId))?.EntityId
                    ?? db.ExternalReferences.FirstOrDefault(x => x.Provider == Provider && x.ExternalId == ExternalKey("products", productExternalId))?.EntityId;
            }

            db.SalesOrderLines.Add(new SalesOrderLine
            {
                SalesOrderId = order.Id,
                ProductId = productId,
                Description = Truncate(FirstNonEmpty(GetString(line, "product_name"), GetString(line, "product_reference"), $"Ligne PrestaShop {order.Number}"), 500),
                Quantity = GetDecimal(line, "product_quantity", "quantity") ?? 1,
                UnitPrice = GetDecimal(line, "product_price", "unit_price_tax_excl", "price") ?? 0
            });
        }
    }

    private static IEnumerable<JsonElement> EnumerateOrderRows(JsonElement orderItem)
    {
        if (orderItem.ValueKind != JsonValueKind.Object || !orderItem.TryGetProperty("associations", out var associations))
        {
            return [];
        }

        if (associations.ValueKind == JsonValueKind.Object && associations.TryGetProperty("order_rows", out var rows))
        {
            return EnumerateCollection(rows, IsOrderRow);
        }

        return EnumerateCollection(associations, IsOrderRow);
    }

    private static IEnumerable<JsonElement> EnumerateItems(JsonDocument document, string propertyName)
    {
        var isItem = (JsonElement item) => item.ValueKind == JsonValueKind.Object && item.TryGetProperty("id", out _);
        if (document.RootElement.ValueKind == JsonValueKind.Object && document.RootElement.TryGetProperty(propertyName, out var property))
        {
            return EnumerateCollection(property, isItem);
        }

        return EnumerateCollection(document.RootElement, isItem);
    }

    private static IEnumerable<JsonElement> EnumerateCollection(JsonElement property, Func<JsonElement, bool> isItem)
    {
        if (property.ValueKind == JsonValueKind.Object && isItem(property))
        {
            return [property];
        }

        if (property.ValueKind == JsonValueKind.Array)
        {
            return property.EnumerateArray().SelectMany(x => EnumerateCollection(x, isItem)).ToList();
        }

        if (property.ValueKind == JsonValueKind.Object)
        {
            return property.EnumerateObject().SelectMany(x => EnumerateCollection(x.Value, isItem)).ToList();
        }

        return [];
    }

    private async Task FailAsync(PrestashopSyncLog log, string message, CancellationToken cancellationToken)
    {
        log.Status = "Failed";
        log.Message = message;
        log.StartedAt ??= DateTimeOffset.UtcNow;
        log.CompletedAt = DateTimeOffset.UtcNow;
        await db.SaveChangesAsync(cancellationToken);
    }

    private async Task FailByIdAsync(Guid syncLogId, string message, CancellationToken cancellationToken)
    {
        db.ChangeTracker.Clear();
        var log = await db.PrestashopSyncLogs.FirstOrDefaultAsync(x => x.Id == syncLogId, cancellationToken);
        if (log is null)
        {
            return;
        }

        log.Status = "Failed";
        log.Message = TrimMessage(message);
        log.StartedAt ??= DateTimeOffset.UtcNow;
        log.CompletedAt = DateTimeOffset.UtcNow;
        await db.SaveChangesAsync(cancellationToken);
    }

    private static string TrimMessage(string message)
        => message.Length > 1000 ? message[..1000] : message;

    private static string TrimDetail(string detail)
        => detail.Length > 240 ? detail[..240] : detail;

    private static string? GetRequiredId(JsonElement item)
        => GetPrestashopResourceId(item, "id") ?? GetString(item, "id");

    private static string? GetPrestashopResourceId(JsonElement item, string propertyName)
    {
        if (item.ValueKind != JsonValueKind.Object || !item.TryGetProperty(propertyName, out var property))
        {
            return null;
        }

        return ReadPrestashopId(property);
    }

    private static string? GetString(JsonElement item, params string[] propertyNames)
    {
        if (item.ValueKind != JsonValueKind.Object)
        {
            return null;
        }

        foreach (var propertyName in propertyNames)
        {
            if (item.TryGetProperty(propertyName, out var property))
            {
                var value = ReadText(property);
                if (!string.IsNullOrWhiteSpace(value))
                {
                    return value.Trim();
                }
            }
        }

        return null;
    }

    private static string? GetLocalizedString(JsonElement item, string propertyName)
        => item.ValueKind == JsonValueKind.Object && item.TryGetProperty(propertyName, out var property) ? ReadText(property) : null;

    private static string? ReadText(JsonElement element)
    {
        if (element.ValueKind == JsonValueKind.String)
        {
            return element.GetString();
        }

        if (element.ValueKind == JsonValueKind.Number || element.ValueKind is JsonValueKind.True or JsonValueKind.False)
        {
            return element.ToString();
        }

        if (element.ValueKind == JsonValueKind.Array)
        {
            foreach (var child in element.EnumerateArray())
            {
                var value = ReadText(child);
                if (!string.IsNullOrWhiteSpace(value))
                {
                    return value;
                }
            }
        }

        if (element.ValueKind == JsonValueKind.Object)
        {
            if (element.TryGetProperty("value", out var value))
            {
                return ReadText(value);
            }

            if (element.TryGetProperty("language", out var language))
            {
                return ReadText(language);
            }

            foreach (var property in element.EnumerateObject())
            {
                var text = ReadText(property.Value);
                if (!string.IsNullOrWhiteSpace(text))
                {
                    return text;
                }
            }
        }

        return null;
    }

    private static decimal? GetDecimal(JsonElement item, params string[] propertyNames)
    {
        var value = GetString(item, propertyNames);
        return decimal.TryParse(value, NumberStyles.Any, CultureInfo.InvariantCulture, out var parsed) ? parsed : null;
    }

    private static DateTimeOffset? GetDateTimeOffset(JsonElement item, params string[] propertyNames)
    {
        var value = GetString(item, propertyNames);
        if (string.IsNullOrWhiteSpace(value))
        {
            return null;
        }

        if (DateTimeOffset.TryParse(value, CultureInfo.InvariantCulture, DateTimeStyles.AssumeLocal, out var parsedOffset))
        {
            return parsedOffset;
        }

        return DateTime.TryParseExact(value, "yyyy-MM-dd HH:mm:ss", CultureInfo.InvariantCulture, DateTimeStyles.AssumeLocal, out var parsedDate)
            ? new DateTimeOffset(parsedDate)
            : null;
    }

    private static bool? GetBool(JsonElement item, string propertyName)
    {
        var value = GetString(item, propertyName);
        if (string.IsNullOrWhiteSpace(value))
        {
            return null;
        }

        return value is "1" || value.Equals("true", StringComparison.OrdinalIgnoreCase);
    }

    private static string FirstNonEmpty(params string?[] values)
        => values.FirstOrDefault(x => !string.IsNullOrWhiteSpace(x))?.Trim() ?? string.Empty;

    private static string Truncate(string value, int maxLength)
        => value.Length <= maxLength ? value : value[..maxLength];

    private static string? TruncateOptional(string? value, int maxLength)
        => string.IsNullOrWhiteSpace(value) ? null : Truncate(value.Trim(), maxLength);

    private static string? NormalizeIdentifier(string? value)
        => string.IsNullOrWhiteSpace(value) ? null : new string(value.Where(char.IsLetterOrDigit).ToArray());

    private static string? BuildProductDescription(JsonElement product)
    {
        var description = FirstNonEmpty(GetLocalizedString(product, "description_short"), GetLocalizedString(product, "description"));
        return string.IsNullOrWhiteSpace(description) ? null : SanitizeRichText(description);
    }

    private static string SanitizeRichText(string value)
    {
        var withoutDangerousBlocks = Regex.Replace(value, @"<\s*(script|style)[^>]*>.*?<\s*/\s*\1\s*>", " ", RegexOptions.IgnoreCase | RegexOptions.Singleline);
        var sanitized = Regex.Replace(
            withoutDangerousBlocks,
            @"<\s*(/?)\s*([a-zA-Z0-9]+)(?:\s+[^>]*)?\s*/?\s*>",
            match =>
            {
                var tag = match.Groups[2].Value.ToLowerInvariant();
                if (!AllowedRichTextTags.Contains(tag))
                {
                    return " ";
                }

                if (tag == "br")
                {
                    return "<br>";
                }

                var closing = match.Groups[1].Value == "/" ? "/" : string.Empty;
                return $"<{closing}{tag}>";
            },
            RegexOptions.IgnoreCase);

        return sanitized.Replace("&nbsp;", " ").Trim();
    }

    private static string? BuildPrestashopImageUrl(string apiBaseUrl, JsonElement product)
    {
        var imageId = FirstNonEmpty(GetDefaultImageId(product), GetFirstAssociationId(product, "images"));
        if (string.IsNullOrWhiteSpace(imageId) || imageId is "0")
        {
            return null;
        }

        var numericImageId = Regex.Replace(imageId, @"\D", string.Empty);
        if (string.IsNullOrWhiteSpace(numericImageId))
        {
            return null;
        }

        var shopRoot = apiBaseUrl.TrimEnd('/');
        if (shopRoot.EndsWith("/api", StringComparison.OrdinalIgnoreCase))
        {
            shopRoot = shopRoot[..^4];
        }

        var imagePath = string.Join("/", numericImageId.ToCharArray());
        return $"{shopRoot}/img/p/{imagePath}/{numericImageId}.jpg";
    }

    private static string? GetDefaultImageId(JsonElement product)
    {
        if (product.ValueKind != JsonValueKind.Object || !product.TryGetProperty("id_default_image", out var image))
        {
            return null;
        }

        return ReadPrestashopId(image);
    }

    private static string? ReadPrestashopId(JsonElement element)
    {
        if (element.ValueKind is JsonValueKind.String or JsonValueKind.Number)
        {
            return ExtractLastNumericValue(element.ToString());
        }

        if (element.ValueKind == JsonValueKind.Array)
        {
            foreach (var child in element.EnumerateArray())
            {
                var id = ReadPrestashopId(child);
                if (!string.IsNullOrWhiteSpace(id))
                {
                    return id;
                }
            }
        }

        if (element.ValueKind == JsonValueKind.Object)
        {
            foreach (var preferredProperty in new[] { "#text", "value", "id" })
            {
                if (element.TryGetProperty(preferredProperty, out var preferred))
                {
                    var id = ReadPrestashopId(preferred);
                    if (!string.IsNullOrWhiteSpace(id))
                    {
                        return id;
                    }
                }
            }

            if (element.TryGetProperty("@attributes", out var attributes))
            {
                foreach (var hrefProperty in new[] { "xlink:href", "href" })
                {
                    if (attributes.ValueKind == JsonValueKind.Object && attributes.TryGetProperty(hrefProperty, out var href))
                    {
                        var id = ReadPrestashopId(href);
                        if (!string.IsNullOrWhiteSpace(id))
                        {
                            return id;
                        }
                    }
                }
            }

            foreach (var property in element.EnumerateObject())
            {
                var id = ReadPrestashopId(property.Value);
                if (!string.IsNullOrWhiteSpace(id))
                {
                    return id;
                }
            }
        }

        return null;
    }

    private static string? ExtractLastNumericValue(string? value)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            return null;
        }

        var matches = Regex.Matches(value, @"\d+");
        return matches.Count == 0 ? null : matches[^1].Value;
    }

    private static string? GetFirstAssociationId(JsonElement item, string associationName)
    {
        if (item.ValueKind != JsonValueKind.Object
            || !item.TryGetProperty("associations", out var associations)
            || associations.ValueKind != JsonValueKind.Object
            || !associations.TryGetProperty(associationName, out var association))
        {
            return null;
        }

        foreach (var associationItem in EnumerateCollection(association, x => x.ValueKind == JsonValueKind.Object && x.TryGetProperty("id", out _)))
        {
            var id = associationItem.TryGetProperty("id", out var idElement) ? ReadPrestashopId(idElement) : ReadPrestashopId(associationItem);
            if (!string.IsNullOrWhiteSpace(id))
            {
                return id;
            }
        }

        return null;
    }

    private static string? GetFirstAssociationValue(JsonElement item, string associationName, string propertyName)
    {
        if (item.ValueKind != JsonValueKind.Object
            || !item.TryGetProperty("associations", out var associations)
            || associations.ValueKind != JsonValueKind.Object
            || !associations.TryGetProperty(associationName, out var association))
        {
            return null;
        }

        foreach (var associationItem in EnumerateCollection(association, x => x.ValueKind == JsonValueKind.Object && x.TryGetProperty(propertyName, out _)))
        {
            var value = GetPrestashopResourceId(associationItem, propertyName) ?? GetString(associationItem, propertyName);
            if (!string.IsNullOrWhiteSpace(value))
            {
                return value;
            }
        }

        return null;
    }

    private sealed record PrestashopDeliveryAddress(string? Name, string? Line1, string? Line2, string? PostalCode, string? City, string? Country, string? Phone, string? Email);

    private async Task<string> BuildUniqueProductReferenceAsync(string requestedReference, string externalId, CancellationToken cancellationToken)
    {
        var baseReference = Truncate(FirstNonEmpty(requestedReference, $"PS-{externalId}"), 80);
        if (!await ProductReferenceExistsAsync(baseReference, cancellationToken))
        {
            return baseReference;
        }

        var suffix = Truncate($"-PS{externalId}", 24);
        var prefixLength = Math.Max(1, 80 - suffix.Length);
        var candidate = $"{Truncate(baseReference, prefixLength)}{suffix}";
        if (!await ProductReferenceExistsAsync(candidate, cancellationToken))
        {
            return candidate;
        }

        for (var index = 2; index < 1000; index += 1)
        {
            var indexedSuffix = Truncate($"{suffix}-{index}", 30);
            candidate = $"{Truncate(baseReference, Math.Max(1, 80 - indexedSuffix.Length))}{indexedSuffix}";
            if (!await ProductReferenceExistsAsync(candidate, cancellationToken))
            {
                return candidate;
            }
        }

        return Truncate($"{Guid.NewGuid():N}", 80);
    }

    private async Task<bool> ProductReferenceExistsAsync(string reference, CancellationToken cancellationToken)
        => db.Products.Local.Any(x => x.Reference == reference)
           || await db.Products.AnyAsync(x => x.Reference == reference, cancellationToken);

    private bool HasTrackedChanges(object entity)
    {
        db.ChangeTracker.DetectChanges();
        var state = db.Entry(entity).State;
        return state is EntityState.Added or EntityState.Modified or EntityState.Deleted;
    }

    private static bool IsOrderRow(JsonElement item)
        => item.ValueKind == JsonValueKind.Object
           && (item.TryGetProperty("product_id", out _)
               || item.TryGetProperty("id_product", out _)
               || item.TryGetProperty("product_name", out _)
               || item.TryGetProperty("product_reference", out _));

    private static string FullExceptionMessage(Exception exception)
    {
        var messages = new List<string>();
        for (var current = exception; current is not null; current = current.InnerException)
        {
            if (!string.IsNullOrWhiteSpace(current.Message))
            {
                messages.Add(current.Message);
            }
        }

        return string.Join(" | ", messages.Distinct());
    }

    private static string ExternalKey(string module, string externalId)
        => $"{module}:{externalId}";

    private static string MapOrderStatus(string? currentState)
        => currentState switch
        {
            "3" => "Preparing",
            "4" => "Shipped",
            "5" => "Completed",
            "6" => "Cancelled",
            _ => "Confirmed"
        };

    private sealed record PrestashopProbeResult(string Status, string Message);
    private sealed record ImportSummary(
        string Resource,
        bool IsSuccess,
        int Created,
        int Updated,
        string? Error,
        IReadOnlyList<PrestashopImportedOrderNotification> CreatedOrders,
        IReadOnlyList<PrestashopImportedServiceTicketNotification> CreatedServiceTickets)
    {
        public static ImportSummary Ok(
            string resource,
            int created,
            int updated,
            IReadOnlyList<PrestashopImportedOrderNotification>? createdOrders = null,
            IReadOnlyList<PrestashopImportedServiceTicketNotification>? createdServiceTickets = null)
            => new(resource, true, created, updated, null, createdOrders ?? [], createdServiceTickets ?? []);

        public static ImportSummary Failed(string resource, string error) => new(resource, false, 0, 0, error, [], []);
        public string ToMessage() => IsSuccess ? $"{Resource}: {Created} cree(s), {Updated} maj" : $"{Resource}: echec {Error}";
    }
}

internal sealed record PrestashopSyncExecutionResult(string Status, string Message);
