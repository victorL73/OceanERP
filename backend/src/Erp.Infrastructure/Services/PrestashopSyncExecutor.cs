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
        summaries.Add(await RunImportAsync("stock_availables", () => ImportStockAsync(apiBaseUrl, cancellationToken), cancellationToken));
        summaries.Add(await RunImportAsync("orders", () => ImportOrdersAsync(apiBaseUrl, cancellationToken), cancellationToken));

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
            if (product is null)
            {
                var reference = await BuildUniqueProductReferenceAsync(FirstNonEmpty(GetString(item, "reference"), $"PS-{externalId}"), externalId, cancellationToken);
                product = new Product { Reference = reference };
                db.Products.Add(product);
                db.ExternalReferences.Add(new ExternalReference { Provider = Provider, ExternalId = ExternalKey("products", externalId), Module = "products", EntityId = product.Id });
                created += 1;
            }
            else
            {
                updated += 1;
            }

            product.Name = Truncate(FirstNonEmpty(GetLocalizedString(item, "name"), product.Reference), 240);
            product.Description = BuildProductDescription(item) ?? product.Description;
            product.ImageUrl = BuildPrestashopImageUrl(apiBaseUrl, item) ?? product.ImageUrl;
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
            }

            var firstName = GetString(item, "firstname");
            var lastName = GetString(item, "lastname");
            var email = GetString(item, "email");
            customer.CompanyName = Truncate(FirstNonEmpty(GetString(item, "company"), $"{firstName} {lastName}".Trim(), email, code), 240);
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
        => GetString(item, "id");

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
    private sealed record ImportSummary(string Resource, bool IsSuccess, int Created, int Updated, string? Error)
    {
        public static ImportSummary Ok(string resource, int created, int updated) => new(resource, true, created, updated, null);
        public static ImportSummary Failed(string resource, string error) => new(resource, false, 0, 0, error);
        public string ToMessage() => IsSuccess ? $"{Resource}: {Created} cree(s), {Updated} maj" : $"{Resource}: echec {Error}";
    }
}
