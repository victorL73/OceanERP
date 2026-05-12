using Erp.Application.Common;
using Erp.Application.Stock;
using Erp.Domain.FutureModules;
using Erp.Domain.Notifications;
using Erp.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using System.Globalization;
using System.Net.Http.Headers;
using System.Text;
using System.Xml.Linq;

namespace Erp.Infrastructure.Services;

public sealed class StockService(ErpDbContext db, IConfiguration configuration, IHttpClientFactory httpClientFactory) : IStockService
{
    private const string PrestashopProvider = "PrestaShop";
    private const string PrestashopProductModule = "products";

    public async Task<IReadOnlyList<WarehouseDto>> GetWarehousesAsync(CancellationToken cancellationToken)
        => await db.Warehouses.OrderBy(x => x.Name).Select(x => new WarehouseDto(x.Id, x.Name)).ToListAsync(cancellationToken);

    public async Task<Result<WarehouseDto>> CreateWarehouseAsync(CreateWarehouseRequest request, CancellationToken cancellationToken)
    {
        var name = request.Name?.Trim();
        if (string.IsNullOrWhiteSpace(name))
        {
            return Result<WarehouseDto>.Failure("Le nom de l'entrepot est obligatoire.");
        }

        if (await db.Warehouses.AnyAsync(x => x.Name == name, cancellationToken))
        {
            return Result<WarehouseDto>.Failure("Un entrepot porte deja ce nom.");
        }

        var warehouse = new Warehouse { Name = name };
        db.Warehouses.Add(warehouse);
        await db.SaveChangesAsync(cancellationToken);
        return Result<WarehouseDto>.Success(new WarehouseDto(warehouse.Id, warehouse.Name));
    }

    public async Task<Result<WarehouseDto>> UpdateWarehouseAsync(Guid warehouseId, UpdateWarehouseRequest request, CancellationToken cancellationToken)
    {
        var warehouse = await db.Warehouses.FirstOrDefaultAsync(x => x.Id == warehouseId, cancellationToken);
        if (warehouse is null)
        {
            return Result<WarehouseDto>.Failure("Entrepot introuvable.");
        }

        var name = request.Name?.Trim();
        if (string.IsNullOrWhiteSpace(name))
        {
            return Result<WarehouseDto>.Failure("Le nom de l'entrepot est obligatoire.");
        }

        if (await db.Warehouses.AnyAsync(x => x.Id != warehouseId && x.Name == name, cancellationToken))
        {
            return Result<WarehouseDto>.Failure("Un entrepot porte deja ce nom.");
        }

        warehouse.Name = name;
        await db.SaveChangesAsync(cancellationToken);
        return Result<WarehouseDto>.Success(new WarehouseDto(warehouse.Id, warehouse.Name));
    }

    public async Task<Result> DeleteWarehouseAsync(Guid warehouseId, CancellationToken cancellationToken)
    {
        var warehouse = await db.Warehouses.FirstOrDefaultAsync(x => x.Id == warehouseId, cancellationToken);
        if (warehouse is null)
        {
            return Result.Failure("Entrepot introuvable.");
        }

        if (await db.StockItems.AnyAsync(x => x.WarehouseId == warehouseId, cancellationToken))
        {
            return Result.Failure("Impossible de supprimer cet entrepot car il contient du stock.");
        }

        if (await db.StockMovements.AnyAsync(x => x.WarehouseId == warehouseId, cancellationToken))
        {
            return Result.Failure("Impossible de supprimer cet entrepot car il possede un historique de mouvements.");
        }

        if (await db.SalesOrders.AnyAsync(x => x.WarehouseId == warehouseId, cancellationToken))
        {
            return Result.Failure("Impossible de supprimer cet entrepot car il est utilise par des commandes.");
        }

        if (await db.PrestashopConnections.AnyAsync(x => x.WarehouseId == warehouseId, cancellationToken))
        {
            return Result.Failure("Impossible de supprimer cet entrepot car il est rattache a une connexion PrestaShop.");
        }

        db.Warehouses.Remove(warehouse);
        await db.SaveChangesAsync(cancellationToken);
        return Result.Success();
    }

    public async Task<IReadOnlyList<StockItemDto>> GetStockItemsAsync(CancellationToken cancellationToken)
        => await db.StockItems
            .OrderBy(x => x.ProductId)
            .Select(x => new StockItemDto(
                x.Id,
                x.ProductId,
                x.WarehouseId,
                x.QuantityOnHand,
                x.QuantityReserved,
                x.QuantityOnHand - x.QuantityReserved,
                x.AlertThreshold,
                x.AlertThreshold > 0 && x.QuantityOnHand - x.QuantityReserved <= x.AlertThreshold))
            .ToListAsync(cancellationToken);

    public async Task<IReadOnlyList<StockMovementDto>> GetMovementsAsync(Guid? productId, CancellationToken cancellationToken)
    {
        var query = db.StockMovements.AsQueryable();
        if (productId.HasValue)
        {
            query = query.Where(x => x.ProductId == productId.Value);
        }

        return await query
            .OrderByDescending(x => x.CreatedAt)
            .Take(100)
            .Select(x => new StockMovementDto(x.Id, x.ProductId, x.WarehouseId, x.Quantity, x.Type, x.Reason, x.ReferenceModule, x.ReferenceId, x.CreatedAt))
            .ToListAsync(cancellationToken);
    }

    public async Task<Result<StockMovementDto>> AdjustAsync(AdjustStockRequest request, CancellationToken cancellationToken)
    {
        if (request.Quantity == 0 && !request.AlertThreshold.HasValue)
        {
            return Result<StockMovementDto>.Failure("Quantity or alert threshold must be modified.");
        }

        if (!await db.Products.AnyAsync(x => x.Id == request.ProductId, cancellationToken))
        {
            return Result<StockMovementDto>.Failure("Product not found.");
        }

        if (!await db.Warehouses.AnyAsync(x => x.Id == request.WarehouseId, cancellationToken))
        {
            return Result<StockMovementDto>.Failure("Warehouse not found.");
        }

        var item = await db.StockItems.FirstOrDefaultAsync(x => x.ProductId == request.ProductId && x.WarehouseId == request.WarehouseId, cancellationToken);
        if (item is null)
        {
            item = new StockItem
            {
                ProductId = request.ProductId,
                WarehouseId = request.WarehouseId,
                AlertThreshold = request.AlertThreshold ?? 0
            };
            db.StockItems.Add(item);
        }

        item.QuantityOnHand += request.Quantity;
        if (item.QuantityOnHand < 0)
        {
            return Result<StockMovementDto>.Failure("Stock cannot become negative.");
        }

        if (item.QuantityOnHand < item.QuantityReserved)
        {
            return Result<StockMovementDto>.Failure("Stock on hand cannot become lower than reserved stock.");
        }

        if (request.AlertThreshold is decimal threshold)
        {
            item.AlertThreshold = threshold;
        }

        var movement = new StockMovement
        {
            ProductId = request.ProductId,
            WarehouseId = request.WarehouseId,
            Quantity = request.Quantity,
            Type = request.Quantity == 0 ? "Threshold" : "Adjustment",
            Reason = string.IsNullOrWhiteSpace(request.Reason) ? "Manual adjustment" : request.Reason.Trim()
        };
        db.StockMovements.Add(movement);
        await AddLowStockNotificationAsync(item, cancellationToken);

        var prestashopResult = await PublishPrestashopStockAsync(item, cancellationToken);
        if (!prestashopResult.Succeeded)
        {
            return Result<StockMovementDto>.Failure(prestashopResult.Error!);
        }

        await db.SaveChangesAsync(cancellationToken);

        return Result<StockMovementDto>.Success(Map(movement));
    }

    public async Task<Result<StockItemDto>> UpdateStockItemAsync(Guid stockItemId, UpdateStockItemRequest request, CancellationToken cancellationToken)
    {
        if (request.QuantityOnHand < 0)
        {
            return Result<StockItemDto>.Failure("Le stock reel ne peut pas etre negatif.");
        }

        if (!await db.Warehouses.AnyAsync(x => x.Id == request.WarehouseId, cancellationToken))
        {
            return Result<StockItemDto>.Failure("Entrepot introuvable.");
        }

        var item = await db.StockItems.FirstOrDefaultAsync(x => x.Id == stockItemId, cancellationToken);
        if (item is null)
        {
            return Result<StockItemDto>.Failure("Ligne de stock introuvable.");
        }

        if (request.QuantityOnHand < item.QuantityReserved)
        {
            return Result<StockItemDto>.Failure("Le stock reel ne peut pas etre inferieur au stock reserve.");
        }

        var warehouseChanged = item.WarehouseId != request.WarehouseId;
        if (warehouseChanged && item.QuantityReserved > 0)
        {
            return Result<StockItemDto>.Failure("Impossible de changer l'entrepot d'une ligne avec du stock reserve.");
        }

        if (warehouseChanged && await db.StockItems.AnyAsync(x => x.Id != item.Id && x.ProductId == item.ProductId && x.WarehouseId == request.WarehouseId, cancellationToken))
        {
            return Result<StockItemDto>.Failure("Un stock existe deja pour ce produit dans l'entrepot cible. Modifiez directement cette ligne.");
        }

        var oldWarehouseId = item.WarehouseId;
        var oldQuantity = item.QuantityOnHand;
        var oldThreshold = item.AlertThreshold;
        item.WarehouseId = request.WarehouseId;
        item.QuantityOnHand = request.QuantityOnHand;
        if (request.AlertThreshold is decimal threshold)
        {
            item.AlertThreshold = threshold;
        }

        if (warehouseChanged)
        {
            db.StockMovements.Add(new StockMovement
            {
                ProductId = item.ProductId,
                WarehouseId = oldWarehouseId,
                Quantity = -oldQuantity,
                Type = "Transfer",
                Reason = "Changement d'entrepot depuis la fiche stock"
            });
            db.StockMovements.Add(new StockMovement
            {
                ProductId = item.ProductId,
                WarehouseId = item.WarehouseId,
                Quantity = item.QuantityOnHand,
                Type = "Transfer",
                Reason = "Changement d'entrepot depuis la fiche stock"
            });
        }
        else
        {
            var delta = item.QuantityOnHand - oldQuantity;
            if (delta != 0 || item.AlertThreshold != oldThreshold)
            {
                db.StockMovements.Add(new StockMovement
                {
                    ProductId = item.ProductId,
                    WarehouseId = item.WarehouseId,
                    Quantity = delta,
                    Type = delta == 0 ? "Threshold" : "Adjustment",
                    Reason = "Correction de stock depuis la fiche stock"
                });
            }
        }

        await AddLowStockNotificationAsync(item, cancellationToken);
        var prestashopResult = await PublishPrestashopStockAsync(item, cancellationToken);
        if (!prestashopResult.Succeeded)
        {
            return Result<StockItemDto>.Failure(prestashopResult.Error!);
        }

        await db.SaveChangesAsync(cancellationToken);
        return Result<StockItemDto>.Success(Map(item));
    }

    private async Task AddLowStockNotificationAsync(StockItem item, CancellationToken cancellationToken)
    {
        var available = item.QuantityOnHand - item.QuantityReserved;
        if (item.AlertThreshold <= 0 || available > item.AlertThreshold)
        {
            return;
        }

        var product = await db.Products.FirstOrDefaultAsync(x => x.Id == item.ProductId, cancellationToken);
        var link = $"/stock?productId={item.ProductId}";
        var exists = await db.Notifications.AnyAsync(x => x.Type == "stock.low" && x.LinkUrl == link && !x.IsRead, cancellationToken);
        if (exists)
        {
            return;
        }

        db.Notifications.Add(new Notification
        {
            Type = "stock.low",
            Title = "Stock bas",
            Message = $"{product?.Reference ?? item.ProductId.ToString()} atteint le seuil d'alerte ({available:0.###}).",
            LinkUrl = link
        });
    }

    private async Task<Result> PublishPrestashopStockAsync(StockItem item, CancellationToken cancellationToken)
    {
        var externalReference = await db.ExternalReferences.FirstOrDefaultAsync(
            x => x.Provider == PrestashopProvider && x.Module == PrestashopProductModule && x.EntityId == item.ProductId,
            cancellationToken);
        if (externalReference is null)
        {
            return Result.Success();
        }

        var connectionResult = await ResolvePrestashopConnectionForWarehouseAsync(item.WarehouseId, cancellationToken);
        if (!connectionResult.Succeeded)
        {
            return Result.Failure(connectionResult.Error!);
        }

        var connection = connectionResult.Value!;

        var apiKeyResult = PrestashopSecretProtector.ResolveApiKey(configuration, connection);
        if (!apiKeyResult.Succeeded)
        {
            return Result.Failure(apiKeyResult.Error ?? "Cle API PrestaShop non configuree.");
        }

        var externalProductId = ExtractPrestashopProductId(externalReference);
        if (string.IsNullOrWhiteSpace(externalProductId))
        {
            return Result.Failure("Reference PrestaShop produit invalide.");
        }

        try
        {
            var apiBaseUrl = GetApiBaseUrl(connection.ShopUrl);
            var warehouseName = await db.Warehouses
                .Where(x => x.Id == item.WarehouseId)
                .Select(x => x.Name)
                .FirstOrDefaultAsync(cancellationToken);
            var stockAvailableId = await FindPrestashopStockAvailableIdAsync(apiBaseUrl, externalProductId, apiKeyResult.Value!, cancellationToken);
            if (string.IsNullOrWhiteSpace(stockAvailableId))
            {
                return Result.Failure("Stock PrestaShop introuvable pour ce produit.");
            }

            var document = await GetPrestashopStockXmlAsync(apiBaseUrl, stockAvailableId, apiKeyResult.Value!, cancellationToken);
            var stockElement = document.Root?.Element("stock_available") ?? document.Descendants("stock_available").FirstOrDefault();
            if (stockElement is null)
            {
                return Result.Failure("Reponse stock PrestaShop invalide.");
            }

            SetElementValue(stockElement, "quantity", FormatDecimal(item.QuantityOnHand));
            if (!string.IsNullOrWhiteSpace(warehouseName))
            {
                SetElementValue(stockElement, "location", warehouseName.Trim());
            }

            await PutPrestashopStockXmlAsync(apiBaseUrl, stockAvailableId, apiKeyResult.Value!, document, cancellationToken);
            return Result.Success();
        }
        catch (OperationCanceledException)
        {
            throw;
        }
        catch (Exception ex)
        {
            return Result.Failure($"Modification stock PrestaShop impossible: {TrimDetail(FullExceptionMessage(ex))}");
        }
    }

    private async Task<Result<PrestashopConnection>> ResolvePrestashopConnectionForWarehouseAsync(Guid warehouseId, CancellationToken cancellationToken)
    {
        var linkedConnection = await db.PrestashopConnections
            .Where(x => x.IsActive && x.WarehouseId == warehouseId)
            .OrderByDescending(x => x.UpdatedAt ?? x.CreatedAt)
            .FirstOrDefaultAsync(cancellationToken);
        if (linkedConnection is not null)
        {
            return Result<PrestashopConnection>.Success(linkedConnection);
        }

        var activeConnections = await db.PrestashopConnections
            .Where(x => x.IsActive)
            .OrderByDescending(x => x.UpdatedAt ?? x.CreatedAt)
            .ToListAsync(cancellationToken);
        if (activeConnections.Count == 0)
        {
            return Result<PrestashopConnection>.Failure("Aucune connexion PrestaShop active n'est configuree pour publier ce stock.");
        }

        var unassignedConnections = activeConnections.Where(x => x.WarehouseId is null).ToList();
        if (activeConnections.Count == 1 && unassignedConnections.Count == 1)
        {
            unassignedConnections[0].WarehouseId = warehouseId;
            return Result<PrestashopConnection>.Success(unassignedConnections[0]);
        }

        var warehouse = await db.Warehouses.FirstOrDefaultAsync(x => x.Id == warehouseId, cancellationToken);
        return Result<PrestashopConnection>.Failure(
            $"Aucune connexion PrestaShop active n'est rattachee a l'entrepot \"{warehouse?.Name ?? warehouseId.ToString()}\". Configurez le rattachement dans Parametres > PrestaShop.");
    }

    private async Task<string?> FindPrestashopStockAvailableIdAsync(string apiBaseUrl, string externalProductId, string apiKey, CancellationToken cancellationToken)
    {
        var client = httpClientFactory.CreateClient(nameof(StockService));
        using var request = new HttpRequestMessage(HttpMethod.Get, $"{apiBaseUrl}/stock_availables?display=full&filter[id_product]=[{externalProductId}]&output_format=JSON");
        AddPrestashopHeaders(request, apiKey, "application/json");

        using var response = await client.SendAsync(request, cancellationToken);
        var body = await response.Content.ReadAsStringAsync(cancellationToken);
        if (!response.IsSuccessStatusCode)
        {
            throw new InvalidOperationException($"GET stock PrestaShop HTTP {(int)response.StatusCode} {TrimDetail(body)}");
        }

        using var document = System.Text.Json.JsonDocument.Parse(body);
        var stockItems = EnumerateItems(document, "stock_availables").ToList();
        var defaultStock = stockItems.FirstOrDefault(x => IsZero(ReadPropertyText(x, "id_product_attribute")));
        var selectedStock = defaultStock.ValueKind == System.Text.Json.JsonValueKind.Undefined ? stockItems.FirstOrDefault() : defaultStock;
        return selectedStock.ValueKind == System.Text.Json.JsonValueKind.Undefined ? null : ReadPropertyText(selectedStock, "id");
    }

    private async Task<XDocument> GetPrestashopStockXmlAsync(string apiBaseUrl, string stockAvailableId, string apiKey, CancellationToken cancellationToken)
    {
        var client = httpClientFactory.CreateClient(nameof(StockService));
        using var request = new HttpRequestMessage(HttpMethod.Get, $"{apiBaseUrl}/stock_availables/{stockAvailableId}?display=full&output_format=XML");
        AddPrestashopHeaders(request, apiKey, "application/xml");

        using var response = await client.SendAsync(request, cancellationToken);
        var body = await response.Content.ReadAsStringAsync(cancellationToken);
        if (!response.IsSuccessStatusCode)
        {
            throw new InvalidOperationException($"GET stock PrestaShop HTTP {(int)response.StatusCode} {TrimDetail(body)}");
        }

        return XDocument.Parse(body, LoadOptions.PreserveWhitespace);
    }

    private async Task PutPrestashopStockXmlAsync(string apiBaseUrl, string stockAvailableId, string apiKey, XDocument document, CancellationToken cancellationToken)
    {
        var client = httpClientFactory.CreateClient(nameof(StockService));
        using var request = new HttpRequestMessage(HttpMethod.Put, $"{apiBaseUrl}/stock_availables/{stockAvailableId}");
        AddPrestashopHeaders(request, apiKey, "application/xml");
        request.Content = new StringContent(document.ToString(SaveOptions.DisableFormatting), Encoding.UTF8, "application/xml");

        using var response = await client.SendAsync(request, cancellationToken);
        var body = await response.Content.ReadAsStringAsync(cancellationToken);
        if (!response.IsSuccessStatusCode)
        {
            throw new InvalidOperationException($"PUT stock PrestaShop HTTP {(int)response.StatusCode} {TrimDetail(body)}");
        }
    }

    private static IEnumerable<System.Text.Json.JsonElement> EnumerateItems(System.Text.Json.JsonDocument document, string propertyName)
    {
        var isItem = (System.Text.Json.JsonElement item) => item.ValueKind == System.Text.Json.JsonValueKind.Object && item.TryGetProperty("id", out _);
        if (document.RootElement.ValueKind == System.Text.Json.JsonValueKind.Object && document.RootElement.TryGetProperty(propertyName, out var property))
        {
            return EnumerateCollection(property, isItem);
        }

        return EnumerateCollection(document.RootElement, isItem);
    }

    private static IEnumerable<System.Text.Json.JsonElement> EnumerateCollection(System.Text.Json.JsonElement property, Func<System.Text.Json.JsonElement, bool> isItem)
    {
        if (property.ValueKind == System.Text.Json.JsonValueKind.Object && isItem(property))
        {
            return [property];
        }

        if (property.ValueKind == System.Text.Json.JsonValueKind.Array)
        {
            return property.EnumerateArray().SelectMany(x => EnumerateCollection(x, isItem)).ToList();
        }

        if (property.ValueKind == System.Text.Json.JsonValueKind.Object)
        {
            return property.EnumerateObject().SelectMany(x => EnumerateCollection(x.Value, isItem)).ToList();
        }

        return [];
    }

    private static string? ReadPropertyText(System.Text.Json.JsonElement item, string propertyName)
    {
        if (item.ValueKind != System.Text.Json.JsonValueKind.Object || !item.TryGetProperty(propertyName, out var property))
        {
            return null;
        }

        return ReadText(property);
    }

    private static string? ReadText(System.Text.Json.JsonElement element)
    {
        if (element.ValueKind == System.Text.Json.JsonValueKind.String)
        {
            return element.GetString();
        }

        if (element.ValueKind == System.Text.Json.JsonValueKind.Number || element.ValueKind is System.Text.Json.JsonValueKind.True or System.Text.Json.JsonValueKind.False)
        {
            return element.ToString();
        }

        if (element.ValueKind == System.Text.Json.JsonValueKind.Object)
        {
            if (element.TryGetProperty("value", out var value))
            {
                return ReadText(value);
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

        if (element.ValueKind == System.Text.Json.JsonValueKind.Array)
        {
            foreach (var child in element.EnumerateArray())
            {
                var text = ReadText(child);
                if (!string.IsNullOrWhiteSpace(text))
                {
                    return text;
                }
            }
        }

        return null;
    }

    private static void AddPrestashopHeaders(HttpRequestMessage request, string apiKey, string accept)
    {
        request.Headers.Authorization = new AuthenticationHeaderValue(
            "Basic",
            Convert.ToBase64String(Encoding.ASCII.GetBytes($"{apiKey}:")));
        request.Headers.Accept.Add(new MediaTypeWithQualityHeaderValue(accept));
    }

    private static void SetElementValue(XElement parent, string name, string value)
    {
        var element = parent.Element(name);
        if (element is null)
        {
            element = new XElement(name);
            parent.Add(element);
        }

        element.Value = value;
    }

    private static string? ExtractPrestashopProductId(ExternalReference externalReference)
    {
        var prefix = $"{PrestashopProductModule}:";
        return externalReference.ExternalId.StartsWith(prefix, StringComparison.OrdinalIgnoreCase)
            ? externalReference.ExternalId[prefix.Length..]
            : externalReference.ExternalId;
    }

    private static string GetApiBaseUrl(string shopUrl)
    {
        var normalized = shopUrl.Trim().TrimEnd('/');
        return normalized.EndsWith("/api", StringComparison.OrdinalIgnoreCase)
            ? normalized
            : $"{normalized}/api";
    }

    private static string FormatDecimal(decimal value)
        => value.ToString("0.###", CultureInfo.InvariantCulture);

    private static bool IsZero(string? value)
        => string.IsNullOrWhiteSpace(value) || value == "0";

    private static string TrimDetail(string detail)
        => detail.Length > 300 ? detail[..300] : detail;

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

        return string.Join(" ", messages);
    }

    private static StockItemDto Map(StockItem item)
        => new(item.Id, item.ProductId, item.WarehouseId, item.QuantityOnHand, item.QuantityReserved, item.QuantityOnHand - item.QuantityReserved, item.AlertThreshold, item.AlertThreshold > 0 && item.QuantityOnHand - item.QuantityReserved <= item.AlertThreshold);

    private static StockMovementDto Map(StockMovement movement)
        => new(movement.Id, movement.ProductId, movement.WarehouseId, movement.Quantity, movement.Type, movement.Reason, movement.ReferenceModule, movement.ReferenceId, movement.CreatedAt);
}
