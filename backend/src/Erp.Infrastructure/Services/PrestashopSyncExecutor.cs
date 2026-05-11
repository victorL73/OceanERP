using Erp.Domain.Customers;
using Erp.Domain.FutureModules;
using Erp.Domain.Products;
using Erp.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using System.Globalization;
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;

namespace Erp.Infrastructure.Services;

internal sealed class PrestashopSyncExecutor(ErpDbContext db, IConfiguration configuration, HttpClient httpClient)
{
    private const string Provider = "PrestaShop";
    private const string DefaultWarehouseName = "PrestaShop";

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
            log.Status = result.Status;
            log.Message = TrimMessage(result.Message);
        }
        catch (OperationCanceledException) when (!cancellationToken.IsCancellationRequested)
        {
            log.Status = "Failed";
            log.Message = "Synchronisation interrompue ou delai depasse.";
        }
        catch (Exception ex)
        {
            log.Status = "Failed";
            log.Message = ex.Message.Length > 1000 ? ex.Message[..1000] : ex.Message;
        }

        log.CompletedAt = DateTimeOffset.UtcNow;
        await db.SaveChangesAsync(cancellationToken);
    }

    private async Task<PrestashopProbeResult> ProbePrestashopAsync(PrestashopConnection connection, string apiKey, CancellationToken cancellationToken)
    {
        var apiBaseUrl = GetApiBaseUrl(connection.ShopUrl);
        httpClient.Timeout = TimeSpan.FromSeconds(20);
        httpClient.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue(
            "Basic",
            Convert.ToBase64String(Encoding.ASCII.GetBytes($"{apiKey}:")));

        var summaries = new List<ImportSummary>();
        summaries.Add(await RunImportAsync("products", () => ImportProductsAsync(apiBaseUrl, cancellationToken)));
        await db.SaveChangesAsync(cancellationToken);

        summaries.Add(await RunImportAsync("customers", () => ImportCustomersAsync(apiBaseUrl, cancellationToken)));
        await db.SaveChangesAsync(cancellationToken);

        summaries.Add(await RunImportAsync("stock_availables", () => ImportStockAsync(apiBaseUrl, cancellationToken)));
        summaries.Add(await RunImportAsync("orders", () => ImportOrdersAsync(apiBaseUrl, cancellationToken)));
        await db.SaveChangesAsync(cancellationToken);

        var successCount = summaries.Count(x => x.IsSuccess);
        if (successCount == 0)
        {
            return new PrestashopProbeResult("Failed", $"Aucune ressource PrestaShop importee. {string.Join("; ", summaries.Select(x => x.ToMessage()))}.");
        }

        var status = successCount == summaries.Count ? "Completed" : "CompletedWithWarnings";
        return new PrestashopProbeResult(status, $"Synchronisation PrestaShop: {string.Join("; ", summaries.Select(x => x.ToMessage()))}.");
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

    private async Task<ImportSummary> RunImportAsync(string resource, Func<Task<ImportSummary>> import)
    {
        try
        {
            return await import();
        }
        catch (OperationCanceledException)
        {
            throw;
        }
        catch (Exception ex)
        {
            return ImportSummary.Failed(resource, TrimDetail(ex.Message));
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

            var reference = Truncate(FirstNonEmpty(GetString(item, "reference"), $"PS-{externalId}"), 80);
            var product = await FindProductAsync(externalId, reference, cancellationToken);
            if (product is null)
            {
                product = new Product { Reference = reference };
                db.Products.Add(product);
                db.ExternalReferences.Add(new ExternalReference { Provider = Provider, ExternalId = ExternalKey("products", externalId), Module = "products", EntityId = product.Id });
                created += 1;
            }
            else
            {
                updated += 1;
            }

            product.Name = Truncate(FirstNonEmpty(GetLocalizedString(item, "name"), reference), 240);
            product.Description = FirstNonEmpty(StripHtml(GetLocalizedString(item, "description_short")), StripHtml(GetLocalizedString(item, "description")));
            product.SalePrice = GetDecimal(item, "price") ?? product.SalePrice;
            product.PurchasePrice = GetDecimal(item, "wholesale_price") ?? product.PurchasePrice;
            product.IsActive = GetBool(item, "active") ?? product.IsActive;
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
            if (customer is null)
            {
                customer = new Customer { Code = code };
                db.Customers.Add(customer);
                db.ExternalReferences.Add(new ExternalReference { Provider = Provider, ExternalId = ExternalKey("customers", externalId), Module = "customers", EntityId = customer.Id });
                created += 1;
            }
            else
            {
                updated += 1;
                await db.Entry(customer).Collection(x => x.Contacts).LoadAsync(cancellationToken);
            }

            var firstName = GetString(item, "firstname");
            var lastName = GetString(item, "lastname");
            var email = GetString(item, "email");
            customer.CompanyName = Truncate(FirstNonEmpty(GetString(item, "company"), $"{firstName} {lastName}".Trim(), email, code), 240);
            customer.IsActive = GetBool(item, "active") ?? customer.IsActive;

            foreach (var contact in customer.Contacts.Where(x => x.JobTitle == Provider).ToList())
            {
                db.CustomerContacts.Remove(contact);
            }

            if (!string.IsNullOrWhiteSpace(firstName) || !string.IsNullOrWhiteSpace(lastName) || !string.IsNullOrWhiteSpace(email))
            {
                customer.Contacts.Add(new CustomerContact
                {
                    FirstName = firstName ?? string.Empty,
                    LastName = lastName ?? string.Empty,
                    Email = email,
                    JobTitle = Provider,
                    IsPrimary = true
                });
            }
        }

        return ImportSummary.Ok("customers", created, updated);
    }

    private async Task<ImportSummary> ImportStockAsync(string apiBaseUrl, CancellationToken cancellationToken)
    {
        using var document = await GetJsonAsync($"{apiBaseUrl}/stock_availables?display=full&limit=100&output_format=JSON", "stock_availables", cancellationToken);
        var warehouse = await GetOrCreatePrestashopWarehouseAsync(cancellationToken);
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

            var stockItem = await db.StockItems.FirstOrDefaultAsync(x => x.ProductId == productRef.EntityId && x.WarehouseId == warehouse.Id, cancellationToken);
            if (stockItem is null)
            {
                stockItem = new StockItem { ProductId = productRef.EntityId, WarehouseId = warehouse.Id, QuantityOnHand = quantity };
                db.StockItems.Add(stockItem);
                created += 1;
            }
            else
            {
                var delta = quantity - stockItem.QuantityOnHand;
                stockItem.QuantityOnHand = quantity;
                updated += 1;
                if (delta != 0)
                {
                    db.StockMovements.Add(new StockMovement
                    {
                        ProductId = productRef.EntityId,
                        WarehouseId = warehouse.Id,
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
            SalesOrder? order = null;
            if (externalReference is not null)
            {
                order = await db.SalesOrders.FirstOrDefaultAsync(x => x.Id == externalReference.EntityId, cancellationToken);
            }

            var status = MapOrderStatus(GetString(item, "current_state"));
            if (order is null)
            {
                var customer = await ResolveOrderCustomerAsync(GetString(item, "id_customer"), cancellationToken);
                order = new SalesOrder { Number = orderNumber, CustomerId = customer.Id, Status = status };
                db.SalesOrders.Add(order);
                db.ExternalReferences.Add(new ExternalReference { Provider = Provider, ExternalId = ExternalKey("orders", externalId), Module = "orders", EntityId = order.Id });
                AddOrderLines(order, item);
                db.SalesOrderStatusHistories.Add(new SalesOrderStatusHistory { SalesOrderId = order.Id, Status = status });
                created += 1;
            }
            else
            {
                if (!string.Equals(order.Status, status, StringComparison.OrdinalIgnoreCase))
                {
                    order.Status = status;
                    db.SalesOrderStatusHistories.Add(new SalesOrderStatusHistory { SalesOrderId = order.Id, Status = status });
                }
                updated += 1;
            }
        }

        return ImportSummary.Ok("orders", created, updated);
    }

    private async Task<Product?> FindProductAsync(string externalId, string reference, CancellationToken cancellationToken)
    {
        var externalReference = await FindReferenceAsync("products", externalId, cancellationToken);
        if (externalReference is not null)
        {
            return await db.Products.FirstOrDefaultAsync(x => x.Id == externalReference.EntityId, cancellationToken);
        }

        var product = await db.Products.FirstOrDefaultAsync(x => x.Reference == reference, cancellationToken);
        if (product is not null)
        {
            db.ExternalReferences.Add(new ExternalReference { Provider = Provider, ExternalId = ExternalKey("products", externalId), Module = "products", EntityId = product.Id });
        }

        return product;
    }

    private async Task<Customer?> FindCustomerAsync(string externalId, string code, CancellationToken cancellationToken)
    {
        var externalReference = await FindReferenceAsync("customers", externalId, cancellationToken);
        if (externalReference is not null)
        {
            return await db.Customers.FirstOrDefaultAsync(x => x.Id == externalReference.EntityId, cancellationToken);
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

    private async Task<Warehouse> GetOrCreatePrestashopWarehouseAsync(CancellationToken cancellationToken)
    {
        var warehouse = await db.Warehouses.FirstOrDefaultAsync(x => x.Name == DefaultWarehouseName, cancellationToken);
        if (warehouse is not null)
        {
            return warehouse;
        }

        warehouse = new Warehouse { Name = DefaultWarehouseName };
        db.Warehouses.Add(warehouse);
        return warehouse;
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
        if (!orderItem.TryGetProperty("associations", out var associations) || associations.ValueKind != JsonValueKind.Object)
        {
            return [];
        }

        if (!associations.TryGetProperty("order_rows", out var rows))
        {
            return [];
        }

        return EnumerateElements(rows);
    }

    private static IEnumerable<JsonElement> EnumerateItems(JsonDocument document, string propertyName)
    {
        if (!document.RootElement.TryGetProperty(propertyName, out var property))
        {
            return [];
        }

        return EnumerateElements(property);
    }

    private static IEnumerable<JsonElement> EnumerateElements(JsonElement property)
    {
        if (property.ValueKind == JsonValueKind.Array)
        {
            return property.EnumerateArray().Where(x => x.ValueKind == JsonValueKind.Object).ToList();
        }

        if (property.ValueKind == JsonValueKind.Object)
        {
            return property.EnumerateObject().Select(x => x.Value).Where(x => x.ValueKind == JsonValueKind.Object).ToList();
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

    private static string TrimMessage(string message)
        => message.Length > 1000 ? message[..1000] : message;

    private static string TrimDetail(string detail)
        => detail.Length > 240 ? detail[..240] : detail;

    private static string? GetRequiredId(JsonElement item)
        => GetString(item, "id");

    private static string? GetString(JsonElement item, params string[] propertyNames)
    {
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
        => item.TryGetProperty(propertyName, out var property) ? ReadText(property) : null;

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

    private static string? StripHtml(string? value)
        => string.IsNullOrWhiteSpace(value) ? null : Regex.Replace(value, "<.*?>", " ").Replace("&nbsp;", " ").Trim();

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
    private sealed record ImportSummary(string Resource, bool IsSuccess, int Created, int Updated, string? Error)
    {
        public static ImportSummary Ok(string resource, int created, int updated) => new(resource, true, created, updated, null);
        public static ImportSummary Failed(string resource, string error) => new(resource, false, 0, 0, error);
        public string ToMessage() => IsSuccess ? $"{Resource}: {Created} cree(s), {Updated} maj" : $"{Resource}: echec {Error}";
    }
}
