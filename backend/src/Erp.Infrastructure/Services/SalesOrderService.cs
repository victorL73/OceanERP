using Erp.Application.Common;
using Erp.Application.Sales;
using Erp.Application.Stock;
using Erp.Domain.Customers;
using Erp.Domain.FutureModules;
using Erp.Domain.Quotes;
using Erp.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;

namespace Erp.Infrastructure.Services;

public sealed class SalesOrderService(
    ErpDbContext db,
    ILowStockAlertService lowStockAlerts,
    ISalesOrderShipmentPdfService shipmentPdfService,
    IHttpClientFactory httpClientFactory,
    IConfiguration configuration) : ISalesOrderService
{
    private const string PrestashopProvider = "PrestaShop";
    private const string PrestashopOrderModule = "orders";

    private static readonly IReadOnlyDictionary<string, string[]> AllowedTransitions = new Dictionary<string, string[]>(StringComparer.OrdinalIgnoreCase)
    {
        ["Draft"] = ["Confirmed", "Cancelled"],
        ["Confirmed"] = ["Preparing", "Shipped", "Cancelled"],
        ["Preparing"] = ["Shipped", "Cancelled"],
        ["Shipped"] = ["Completed"],
        ["Completed"] = [],
        ["Cancelled"] = []
    };

    private static readonly string[] KnownColissimoLabelResources =
    [
        "colissimo_labels",
        "colissimo_label",
        "colissimo_shipping_labels",
        "colissimo_order_labels",
        "colissimo_shipments",
        "colissimo_orders"
    ];

    private static readonly string[] LabelBase64PropertyNames = ["label", "etiquette", "pdf", "file", "content", "base64"];
    private static readonly string[] LabelUrlPropertyNames = ["label_url", "etiquette_url", "pdf_url", "download_url", "file_url", "url", "href", "link"];

    public async Task<PagedResult<SalesOrderDto>> SearchAsync(int page, int pageSize, CancellationToken cancellationToken)
    {
        page = Math.Max(1, page);
        pageSize = Math.Clamp(pageSize, 1, 100);
        var query = db.SalesOrders.OrderByDescending(x => x.CreatedAt);
        var total = await db.SalesOrders.CountAsync(cancellationToken);
        var orders = await query.Skip((page - 1) * pageSize).Take(pageSize).ToListAsync(cancellationToken);
        return new PagedResult<SalesOrderDto>(await MapManyAsync(orders, cancellationToken), total, page, pageSize);
    }

    public async Task<Result<SalesOrderDto>> GetAsync(Guid id, CancellationToken cancellationToken)
    {
        var order = await db.SalesOrders.FirstOrDefaultAsync(x => x.Id == id, cancellationToken);
        return order is null ? Result<SalesOrderDto>.Failure("Sales order not found.") : Result<SalesOrderDto>.Success(await MapAsync(order, cancellationToken));
    }

    public async Task<Result<SalesOrderDto>> CreateAsync(CreateSalesOrderRequest request, CancellationToken cancellationToken)
    {
        if (!await db.Customers.AnyAsync(x => x.Id == request.CustomerId, cancellationToken))
        {
            return Result<SalesOrderDto>.Failure("Customer not found.");
        }

        if (request.WarehouseId.HasValue && !await db.Warehouses.AnyAsync(x => x.Id == request.WarehouseId.Value, cancellationToken))
        {
            return Result<SalesOrderDto>.Failure("Warehouse not found.");
        }

        if (request.Lines.Count == 0)
        {
            return Result<SalesOrderDto>.Failure("A sales order requires at least one line.");
        }

        var order = new SalesOrder
        {
            Number = await NextNumberAsync(cancellationToken),
            CustomerId = request.CustomerId,
            WarehouseId = request.WarehouseId,
            Status = "Draft"
        };

        db.SalesOrders.Add(order);
        foreach (var line in request.Lines)
        {
            var validated = await BuildLineAsync(order.Id, line, cancellationToken);
            if (!validated.Succeeded)
            {
                return Result<SalesOrderDto>.Failure(validated.Error!);
            }

            db.SalesOrderLines.Add(validated.Value!);
        }

        db.SalesOrderStatusHistories.Add(new SalesOrderStatusHistory { SalesOrderId = order.Id, Status = order.Status });
        await db.SaveChangesAsync(cancellationToken);
        return Result<SalesOrderDto>.Success(await MapAsync(order, cancellationToken));
    }

    public async Task<Result<SalesOrderDto>> CreateFromQuoteAsync(CreateSalesOrderFromQuoteRequest request, CancellationToken cancellationToken)
    {
        var quote = await db.Quotes.Include(x => x.Lines).FirstOrDefaultAsync(x => x.Id == request.QuoteId, cancellationToken);
        if (quote is null)
        {
            return Result<SalesOrderDto>.Failure("Quote not found.");
        }

        if (quote.Status != QuoteStatus.Signed)
        {
            return Result<SalesOrderDto>.Failure("Only a signed quote can be converted to an order.");
        }

        var created = await CreateAsync(new CreateSalesOrderRequest(
            quote.CustomerId,
            request.WarehouseId,
            quote.Lines.Select(x => new CreateSalesOrderLineRequest(x.ProductId, x.Description, x.Quantity, x.UnitPrice)).ToList()), cancellationToken);

        if (created.Succeeded)
        {
            quote.SetStatus(QuoteStatus.ConvertedToOrder);
            db.QuoteStatusHistories.Add(new QuoteStatusHistory
            {
                QuoteId = quote.Id,
                Status = QuoteStatus.ConvertedToOrder,
                Comment = $"Converted to order {created.Value!.Number}"
            });
            await db.SaveChangesAsync(cancellationToken);
        }

        return created;
    }

    public async Task<Result<SalesOrderDto>> ChangeStatusAsync(Guid id, UpdateSalesOrderStatusRequest request, CancellationToken cancellationToken)
    {
        var nextStatus = NormalizeStatus(request.Status);
        if (nextStatus is null)
        {
            return Result<SalesOrderDto>.Failure("Unknown sales order status.");
        }

        var order = await db.SalesOrders.FirstOrDefaultAsync(x => x.Id == id, cancellationToken);
        if (order is null)
        {
            return Result<SalesOrderDto>.Failure("Sales order not found.");
        }

        if (string.Equals(order.Status, nextStatus, StringComparison.OrdinalIgnoreCase))
        {
            return Result<SalesOrderDto>.Success(await MapAsync(order, cancellationToken));
        }

        if (!AllowedTransitions.TryGetValue(order.Status, out var allowed) || !allowed.Contains(nextStatus, StringComparer.OrdinalIgnoreCase))
        {
            return Result<SalesOrderDto>.Failure($"Invalid status transition from {order.Status} to {nextStatus}.");
        }

        var stockResult = await ApplyStockEffectAsync(order, nextStatus, cancellationToken);
        if (!stockResult.Succeeded)
        {
            return Result<SalesOrderDto>.Failure(stockResult.Error!);
        }

        order.Status = nextStatus;
        var now = DateTimeOffset.UtcNow;
        if (nextStatus == "Confirmed") order.ConfirmedAt = now;
        if (nextStatus == "Shipped") order.ShippedAt = now;
        if (nextStatus == "Completed") order.CompletedAt = now;
        if (nextStatus == "Cancelled") order.CancelledAt = now;

        db.SalesOrderStatusHistories.Add(new SalesOrderStatusHistory { SalesOrderId = order.Id, Status = nextStatus });
        await db.SaveChangesAsync(cancellationToken);
        if (nextStatus is "Confirmed" or "Shipped" or "Cancelled")
        {
            await lowStockAlerts.CheckAndNotifyAsync(cancellationToken);
        }

        return Result<SalesOrderDto>.Success(await MapAsync(order, cancellationToken));
    }

    public async Task<Result<SalesOrderShipmentSlipFileDto>> GenerateShipmentSlipAsync(Guid id, CancellationToken cancellationToken)
    {
        var order = await db.SalesOrders.FirstOrDefaultAsync(x => x.Id == id, cancellationToken);
        if (order is null)
        {
            return Result<SalesOrderShipmentSlipFileDto>.Failure("Sales order not found.");
        }

        if (!IsColissimoCarrier(order.ShippingCarrierName) && !IsColissimoCarrier(order.ShippingServiceName))
        {
            return Result<SalesOrderShipmentSlipFileDto>.Failure("Le bon d'expedition est disponible uniquement pour les commandes avec livraison Colissimo.");
        }

        var customer = await db.Customers.Include(x => x.Addresses).FirstOrDefaultAsync(x => x.Id == order.CustomerId, cancellationToken);
        var address = BuildShippingAddress(order, customer);
        var lines = await MapLinesAsync(order.Id, cancellationToken);
        var model = new SalesOrderShipmentSlipPdfModel(
            order.Number,
            customer?.CompanyName ?? order.ShippingAddressName ?? "Client",
            order.ShippingCarrierName ?? order.ShippingServiceName,
            order.ShippingTrackingNumber,
            address,
            lines,
            order.OrderedAt ?? order.CreatedAt);

        var content = shipmentPdfService.Generate(model);
        return Result<SalesOrderShipmentSlipFileDto>.Success(new SalesOrderShipmentSlipFileDto(
            $"bon-expedition-{SanitizeFileName(order.Number)}.pdf",
            "application/pdf",
            content));
    }

    public async Task<Result<SalesOrderShipmentSlipFileDto>> GenerateColissimoLabelAsync(Guid id, CancellationToken cancellationToken)
    {
        var order = await db.SalesOrders.FirstOrDefaultAsync(x => x.Id == id, cancellationToken);
        if (order is null)
        {
            return Result<SalesOrderShipmentSlipFileDto>.Failure("Sales order not found.");
        }

        if (!IsColissimoCarrier(order.ShippingCarrierName) && !IsColissimoCarrier(order.ShippingServiceName))
        {
            return Result<SalesOrderShipmentSlipFileDto>.Failure("L'etiquette Colissimo est disponible uniquement pour les commandes avec livraison Colissimo.");
        }

        var externalOrderId = await GetPrestashopExternalOrderIdAsync(order.Id, cancellationToken);
        if (string.IsNullOrWhiteSpace(externalOrderId))
        {
            return await GenerateColissimoFallbackLabelAsync(order, "Cette commande n'est pas reliee a une commande PrestaShop.", cancellationToken);
        }

        var connection = await db.PrestashopConnections
            .Where(x => x.IsActive)
            .OrderByDescending(x => x.UpdatedAt ?? x.CreatedAt)
            .FirstOrDefaultAsync(cancellationToken);
        if (connection is null)
        {
            return await GenerateColissimoFallbackLabelAsync(order, "Aucune connexion PrestaShop active n'est configuree.", cancellationToken);
        }

        var apiKeyResult = PrestashopSecretProtector.ResolveApiKey(configuration, connection);
        if (!apiKeyResult.Succeeded)
        {
            return await GenerateColissimoFallbackLabelAsync(order, apiKeyResult.Error ?? "Cle API PrestaShop non configuree.", cancellationToken);
        }

        var configuredEndpoint = await TryConfiguredColissimoLabelEndpointAsync(order, externalOrderId, connection, apiKeyResult.Value!, cancellationToken);
        if (configuredEndpoint.Succeeded)
        {
            return configuredEndpoint;
        }

        var discoveredResource = await TryKnownColissimoResourcesAsync(order, externalOrderId, connection, apiKeyResult.Value!, cancellationToken);
        if (discoveredResource.Succeeded)
        {
            return discoveredResource;
        }

        var configuredDetail = configuredEndpoint.Error?.StartsWith("Aucun endpoint", StringComparison.OrdinalIgnoreCase) == false
            ? $"{configuredEndpoint.Error} "
            : string.Empty;
        return await GenerateColissimoFallbackLabelAsync(
            order,
            $"{configuredDetail}Etiquette officielle introuvable via l'API PrestaShop. Si l'etiquette existe deja dans PrestaShop, configurez PRESTASHOP_COLISSIMO_LABEL_ENDPOINT_TEMPLATE avec l'URL exposee par le module.",
            cancellationToken);
    }

    private async Task<Result<SalesOrderShipmentSlipFileDto>> GenerateColissimoFallbackLabelAsync(SalesOrder order, string reason, CancellationToken cancellationToken)
    {
        var customer = await db.Customers.Include(x => x.Addresses).FirstOrDefaultAsync(x => x.Id == order.CustomerId, cancellationToken);
        var address = BuildShippingAddress(order, customer);
        var lines = await MapLinesAsync(order.Id, cancellationToken);
        var model = new SalesOrderShipmentSlipPdfModel(
            order.Number,
            customer?.CompanyName ?? order.ShippingAddressName ?? "Client",
            order.ShippingCarrierName ?? order.ShippingServiceName,
            order.ShippingTrackingNumber,
            address,
            lines,
            order.OrderedAt ?? order.CreatedAt,
            "Preparation etiquette Colissimo",
            "Document de preparation genere par OceanERP. Ce document n'est pas une etiquette transporteur officielle.",
            $"Etiquette Colissimo officielle non disponible depuis l'API PrestaShop. {reason} Generez l'etiquette officielle dans le back-office PrestaShop si necessaire.");

        var content = shipmentPdfService.Generate(model);
        return Result<SalesOrderShipmentSlipFileDto>.Success(new SalesOrderShipmentSlipFileDto(
            $"preparation-etiquette-colissimo-{SanitizeFileName(order.Number)}.pdf",
            "application/pdf",
            content));
    }

    private async Task<Result<SalesOrderShipmentSlipFileDto>> TryConfiguredColissimoLabelEndpointAsync(
        SalesOrder order,
        string externalOrderId,
        PrestashopConnection connection,
        string apiKey,
        CancellationToken cancellationToken)
    {
        var template = configuration["Prestashop:ColissimoLabelEndpointTemplate"];
        if (string.IsNullOrWhiteSpace(template))
        {
            template = configuration["Colissimo:LabelEndpointTemplate"];
        }

        if (string.IsNullOrWhiteSpace(template))
        {
            return Result<SalesOrderShipmentSlipFileDto>.Failure("Aucun endpoint Colissimo n'est configure.");
        }

        try
        {
            var apiBaseUrl = GetApiBaseUrl(connection.ShopUrl);
            var shopRootUrl = GetShopRootUrl(connection.ShopUrl);
            var url = BuildColissimoLabelUrl(template, apiBaseUrl, shopRootUrl, order, externalOrderId);
            using var request = new HttpRequestMessage(HttpMethod.Get, url);
            AddPrestashopHeaders(request, apiKey, "application/pdf");

            var client = httpClientFactory.CreateClient(nameof(SalesOrderService));
            using var response = await client.SendAsync(request, cancellationToken);
            return await BuildLabelFileFromResponseAsync(response, order, apiKey, shopRootUrl, cancellationToken);
        }
        catch (OperationCanceledException)
        {
            throw;
        }
        catch (Exception ex)
        {
            return Result<SalesOrderShipmentSlipFileDto>.Failure($"Endpoint Colissimo: {TrimDetail(FullExceptionMessage(ex))}");
        }
    }

    private async Task<Result<SalesOrderShipmentSlipFileDto>> TryKnownColissimoResourcesAsync(
        SalesOrder order,
        string externalOrderId,
        PrestashopConnection connection,
        string apiKey,
        CancellationToken cancellationToken)
    {
        var apiBaseUrl = GetApiBaseUrl(connection.ShopUrl);
        var shopRootUrl = GetShopRootUrl(connection.ShopUrl);
        var lastError = "Aucune ressource Colissimo d'etiquette n'a ete trouvee.";

        foreach (var resource in KnownColissimoLabelResources)
        {
            try
            {
                var url = $"{apiBaseUrl}/{resource}?display=full&filter[id_order]=[{Uri.EscapeDataString(externalOrderId)}]&output_format=JSON";
                using var request = new HttpRequestMessage(HttpMethod.Get, url);
                AddPrestashopHeaders(request, apiKey, "application/json");

                var client = httpClientFactory.CreateClient(nameof(SalesOrderService));
                using var response = await client.SendAsync(request, cancellationToken);
                if ((int)response.StatusCode is 400 or 404)
                {
                    continue;
                }

                var result = await BuildLabelFileFromResponseAsync(response, order, apiKey, shopRootUrl, cancellationToken);
                if (result.Succeeded)
                {
                    return result;
                }

                lastError = result.Error ?? lastError;
            }
            catch (OperationCanceledException)
            {
                throw;
            }
            catch (Exception ex)
            {
                lastError = TrimDetail(FullExceptionMessage(ex));
            }
        }

        return Result<SalesOrderShipmentSlipFileDto>.Failure(lastError);
    }

    private async Task<Result<SalesOrderShipmentSlipFileDto>> BuildLabelFileFromResponseAsync(
        HttpResponseMessage response,
        SalesOrder order,
        string apiKey,
        string shopRootUrl,
        CancellationToken cancellationToken)
    {
        var mimeType = response.Content.Headers.ContentType?.MediaType ?? "application/pdf";
        var content = await response.Content.ReadAsByteArrayAsync(cancellationToken);
        if (!response.IsSuccessStatusCode)
        {
            var detail = content.Length == 0 ? string.Empty : Encoding.UTF8.GetString(content);
            return Result<SalesOrderShipmentSlipFileDto>.Failure($"HTTP {(int)response.StatusCode} {TrimDetail(detail)}");
        }

        if (content.Length == 0)
        {
            return Result<SalesOrderShipmentSlipFileDto>.Failure("La reponse Colissimo est vide.");
        }

        if (LooksLikeLabelContent(mimeType, content))
        {
            return Result<SalesOrderShipmentSlipFileDto>.Success(new SalesOrderShipmentSlipFileDto(
                BuildLabelFileName(order.Number, mimeType, content),
                NormalizeMimeType(mimeType, content),
                content));
        }

        var text = Encoding.UTF8.GetString(content);
        var referenced = await TryExtractReferencedLabelAsync(text, order, apiKey, shopRootUrl, cancellationToken);
        return referenced is not null
            ? Result<SalesOrderShipmentSlipFileDto>.Success(referenced)
            : Result<SalesOrderShipmentSlipFileDto>.Failure("La reponse Colissimo ne contient ni PDF, ni image, ni URL/base64 d'etiquette.");
    }

    private async Task<SalesOrderShipmentSlipFileDto?> TryExtractReferencedLabelAsync(
        string text,
        SalesOrder order,
        string apiKey,
        string shopRootUrl,
        CancellationToken cancellationToken)
    {
        try
        {
            using var document = JsonDocument.Parse(text);
            foreach (var base64 in FindStringsByPropertyNames(document.RootElement, LabelBase64PropertyNames))
            {
                var decoded = DecodeBase64Label(base64);
                if (decoded is not null)
                {
                    return new SalesOrderShipmentSlipFileDto(
                        BuildLabelFileName(order.Number, decoded.Value.MimeType, decoded.Value.Content),
                        decoded.Value.MimeType,
                        decoded.Value.Content);
                }
            }

            foreach (var url in FindStringsByPropertyNames(document.RootElement, LabelUrlPropertyNames))
            {
                var file = await DownloadReferencedLabelAsync(url, order, apiKey, shopRootUrl, cancellationToken);
                if (file is not null)
                {
                    return file;
                }
            }
        }
        catch (JsonException)
        {
        }

        var textUrl = FindUrlInText(text);
        if (!string.IsNullOrWhiteSpace(textUrl))
        {
            return await DownloadReferencedLabelAsync(textUrl, order, apiKey, shopRootUrl, cancellationToken);
        }

        var textDecoded = DecodeBase64Label(text);
        return textDecoded is null
            ? null
            : new SalesOrderShipmentSlipFileDto(BuildLabelFileName(order.Number, textDecoded.Value.MimeType, textDecoded.Value.Content), textDecoded.Value.MimeType, textDecoded.Value.Content);
    }

    private async Task<SalesOrderShipmentSlipFileDto?> DownloadReferencedLabelAsync(
        string reference,
        SalesOrder order,
        string apiKey,
        string shopRootUrl,
        CancellationToken cancellationToken)
    {
        var url = ResolveLabelUrl(reference, shopRootUrl);
        if (string.IsNullOrWhiteSpace(url))
        {
            return null;
        }

        using var request = new HttpRequestMessage(HttpMethod.Get, url);
        AddPrestashopHeaders(request, apiKey, "application/pdf");
        var client = httpClientFactory.CreateClient(nameof(SalesOrderService));
        using var response = await client.SendAsync(request, cancellationToken);
        if (!response.IsSuccessStatusCode)
        {
            return null;
        }

        var mimeType = response.Content.Headers.ContentType?.MediaType ?? "application/pdf";
        var content = await response.Content.ReadAsByteArrayAsync(cancellationToken);
        return LooksLikeLabelContent(mimeType, content)
            ? new SalesOrderShipmentSlipFileDto(BuildLabelFileName(order.Number, mimeType, content), NormalizeMimeType(mimeType, content), content)
            : null;
    }

    private async Task<string?> GetPrestashopExternalOrderIdAsync(Guid orderId, CancellationToken cancellationToken)
    {
        var reference = await db.ExternalReferences.FirstOrDefaultAsync(
            x => x.Provider == PrestashopProvider && x.Module == PrestashopOrderModule && x.EntityId == orderId,
            cancellationToken);
        if (reference is null)
        {
            return null;
        }

        var prefix = $"{PrestashopOrderModule}:";
        return reference.ExternalId.StartsWith(prefix, StringComparison.OrdinalIgnoreCase)
            ? reference.ExternalId[prefix.Length..]
            : reference.ExternalId;
    }

    private async Task<Result<SalesOrderLine>> BuildLineAsync(Guid orderId, CreateSalesOrderLineRequest request, CancellationToken cancellationToken)
    {
        if (request.Quantity <= 0)
        {
            return Result<SalesOrderLine>.Failure("Line quantity must be greater than zero.");
        }

        if (request.UnitPrice < 0)
        {
            return Result<SalesOrderLine>.Failure("Line unit price cannot be negative.");
        }

        var description = request.Description.Trim();
        var unitPrice = request.UnitPrice;
        if (request.ProductId.HasValue)
        {
            var product = await db.Products.FirstOrDefaultAsync(x => x.Id == request.ProductId.Value && x.IsActive, cancellationToken);
            if (product is null)
            {
                return Result<SalesOrderLine>.Failure("Product not found.");
            }

            if (string.IsNullOrWhiteSpace(description))
            {
                description = $"{product.Reference} - {product.Name}";
            }

            if (unitPrice == 0)
            {
                unitPrice = product.SalePrice;
            }
        }

        if (string.IsNullOrWhiteSpace(description))
        {
            return Result<SalesOrderLine>.Failure("Line description is required.");
        }

        return Result<SalesOrderLine>.Success(new SalesOrderLine
        {
            SalesOrderId = orderId,
            ProductId = request.ProductId,
            Description = description,
            Quantity = request.Quantity,
            UnitPrice = unitPrice
        });
    }

    private async Task<Result> ApplyStockEffectAsync(SalesOrder order, string nextStatus, CancellationToken cancellationToken)
    {
        if (nextStatus is not ("Confirmed" or "Shipped" or "Cancelled"))
        {
            return Result.Success();
        }

        var productLines = await db.SalesOrderLines
            .Where(x => x.SalesOrderId == order.Id && x.ProductId != null)
            .GroupBy(x => x.ProductId!.Value)
            .Select(x => new StockOrderLine(x.Key, x.Sum(line => line.Quantity)))
            .ToListAsync(cancellationToken);

        if (productLines.Count == 0)
        {
            return Result.Success();
        }

        if (!order.WarehouseId.HasValue)
        {
            return Result.Failure("A warehouse is required before reserving or shipping product lines.");
        }

        if (nextStatus == "Confirmed")
        {
            return await ReserveAsync(order, productLines, cancellationToken);
        }

        if (nextStatus == "Shipped")
        {
            var reserveResult = await ReserveAsync(order, productLines, cancellationToken);
            if (!reserveResult.Succeeded)
            {
                return reserveResult;
            }

            return await ShipAsync(order, productLines, cancellationToken);
        }

        return await ReleaseReservationAsync(order, productLines, cancellationToken);
    }

    private async Task<Result> ReserveAsync(SalesOrder order, IReadOnlyList<StockOrderLine> lines, CancellationToken cancellationToken)
    {
        if (await db.StockMovements.AnyAsync(x => x.ReferenceId == order.Id && x.Type == "Reservation", cancellationToken))
        {
            return Result.Success();
        }

        foreach (var line in lines)
        {
            var item = await db.StockItems.FirstOrDefaultAsync(x => x.ProductId == line.ProductId && x.WarehouseId == order.WarehouseId!.Value, cancellationToken);
            if (item is null || item.QuantityOnHand - item.QuantityReserved < line.Quantity)
            {
                return Result.Failure("Insufficient available stock for reservation.");
            }
        }

        foreach (var line in lines)
        {
            var item = await db.StockItems.FirstAsync(x => x.ProductId == line.ProductId && x.WarehouseId == order.WarehouseId!.Value, cancellationToken);
            item.QuantityReserved += line.Quantity;
            db.StockMovements.Add(new StockMovement
            {
                ProductId = line.ProductId,
                WarehouseId = order.WarehouseId!.Value,
                Quantity = line.Quantity,
                Type = "Reservation",
                Reason = $"Reservation for order {order.Number}",
                ReferenceModule = "SalesOrder",
                ReferenceId = order.Id
            });
        }

        return Result.Success();
    }

    private async Task<Result> ShipAsync(SalesOrder order, IReadOnlyList<StockOrderLine> lines, CancellationToken cancellationToken)
    {
        if (await db.StockMovements.AnyAsync(x => x.ReferenceId == order.Id && x.Type == "Shipment", cancellationToken))
        {
            return Result.Success();
        }

        foreach (var line in lines)
        {
            var item = await db.StockItems.FirstAsync(x => x.ProductId == line.ProductId && x.WarehouseId == order.WarehouseId!.Value, cancellationToken);
            if (item.QuantityReserved < line.Quantity || item.QuantityOnHand < line.Quantity)
            {
                return Result.Failure("Insufficient reserved stock for shipment.");
            }
        }

        foreach (var line in lines)
        {
            var item = await db.StockItems.FirstAsync(x => x.ProductId == line.ProductId && x.WarehouseId == order.WarehouseId!.Value, cancellationToken);
            item.QuantityReserved -= line.Quantity;
            item.QuantityOnHand -= line.Quantity;
            db.StockMovements.Add(new StockMovement
            {
                ProductId = line.ProductId,
                WarehouseId = order.WarehouseId!.Value,
                Quantity = -line.Quantity,
                Type = "Shipment",
                Reason = $"Shipment for order {order.Number}",
                ReferenceModule = "SalesOrder",
                ReferenceId = order.Id
            });
        }

        return Result.Success();
    }

    private async Task<Result> ReleaseReservationAsync(SalesOrder order, IReadOnlyList<StockOrderLine> lines, CancellationToken cancellationToken)
    {
        if (!await db.StockMovements.AnyAsync(x => x.ReferenceId == order.Id && x.Type == "Reservation", cancellationToken)
            || await db.StockMovements.AnyAsync(x => x.ReferenceId == order.Id && x.Type == "ReservationRelease", cancellationToken)
            || await db.StockMovements.AnyAsync(x => x.ReferenceId == order.Id && x.Type == "Shipment", cancellationToken))
        {
            return Result.Success();
        }

        foreach (var line in lines)
        {
            var item = await db.StockItems.FirstOrDefaultAsync(x => x.ProductId == line.ProductId && x.WarehouseId == order.WarehouseId!.Value, cancellationToken);
            if (item is null)
            {
                continue;
            }

            item.QuantityReserved = Math.Max(0, item.QuantityReserved - line.Quantity);
            db.StockMovements.Add(new StockMovement
            {
                ProductId = line.ProductId,
                WarehouseId = order.WarehouseId!.Value,
                Quantity = -line.Quantity,
                Type = "ReservationRelease",
                Reason = $"Reservation release for order {order.Number}",
                ReferenceModule = "SalesOrder",
                ReferenceId = order.Id
            });
        }

        return Result.Success();
    }

    private async Task<string> NextNumberAsync(CancellationToken cancellationToken)
    {
        var prefix = $"CMD-{DateTime.UtcNow:yyyy}-";
        var count = await db.SalesOrders.CountAsync(x => x.Number.StartsWith(prefix), cancellationToken);
        return $"{prefix}{count + 1:0000}";
    }

    private async Task<IReadOnlyList<SalesOrderDto>> MapManyAsync(IReadOnlyList<SalesOrder> orders, CancellationToken cancellationToken)
    {
        var result = new List<SalesOrderDto>();
        foreach (var order in orders)
        {
            result.Add(await MapAsync(order, cancellationToken));
        }

        return result;
    }

    private async Task<SalesOrderDto> MapAsync(SalesOrder order, CancellationToken cancellationToken)
    {
        var customer = await db.Customers.Include(x => x.Addresses).FirstOrDefaultAsync(x => x.Id == order.CustomerId, cancellationToken);
        var warehouseName = order.WarehouseId.HasValue
            ? await db.Warehouses.Where(x => x.Id == order.WarehouseId.Value).Select(x => x.Name).FirstOrDefaultAsync(cancellationToken)
            : null;
        var lineDtos = await MapLinesAsync(order.Id, cancellationToken);
        var statusHistory = await db.SalesOrderStatusHistories
            .Where(x => x.SalesOrderId == order.Id)
            .OrderByDescending(x => x.ChangedAt)
            .Select(x => new SalesOrderStatusHistoryDto(x.Id, x.Status, x.ChangedAt))
            .ToListAsync(cancellationToken);
        if (statusHistory.Count == 0)
        {
            statusHistory.Add(new SalesOrderStatusHistoryDto(Guid.Empty, order.Status, order.OrderedAt ?? order.CreatedAt));
        }

        var isColissimoOrder = IsColissimoCarrier(order.ShippingCarrierName) || IsColissimoCarrier(order.ShippingServiceName);
        return new SalesOrderDto(
            order.Id,
            order.Number,
            order.CustomerId,
            customer?.CompanyName,
            order.WarehouseId,
            warehouseName,
            order.Status,
            order.ExternalStatusName,
            lineDtos.Sum(x => x.LineTotal),
            order.OrderedAt,
            order.PaymentMethod,
            order.PaymentModule,
            order.PaidTotal,
            order.ProductsTotal,
            order.ShippingTotal,
            order.ShippingWeightKg,
            order.InvoiceReference,
            order.ShippingServiceName,
            order.ShippingCarrierName,
            order.ShippingTrackingNumber,
            HasShippingAddress(order, customer) ? BuildShippingAddress(order, customer) : null,
            isColissimoOrder,
            isColissimoOrder,
            order.CreatedAt,
            order.ConfirmedAt,
            order.ShippedAt,
            order.CompletedAt,
            order.CancelledAt,
            lineDtos,
            statusHistory);
    }

    private async Task<IReadOnlyList<SalesOrderLineDto>> MapLinesAsync(Guid orderId, CancellationToken cancellationToken)
    {
        var lines = await db.SalesOrderLines.Where(x => x.SalesOrderId == orderId).OrderBy(x => x.Id).ToListAsync(cancellationToken);
        return lines.Select(x => new SalesOrderLineDto(x.Id, x.ProductId, x.Description, x.Quantity, x.UnitPrice, decimal.Round(x.Quantity * x.UnitPrice, 2))).ToList();
    }

    private static bool HasShippingAddress(SalesOrder order, Customer? customer)
        => !string.IsNullOrWhiteSpace(order.ShippingAddressLine1)
           || !string.IsNullOrWhiteSpace(order.ShippingCity)
           || customer?.Addresses.Any(x => x.IsShipping) == true;

    private static SalesOrderShippingAddressDto BuildShippingAddress(SalesOrder order, Customer? customer)
    {
        var fallback = customer?.Addresses.FirstOrDefault(x => x.IsShipping) ?? customer?.Addresses.FirstOrDefault();
        return new SalesOrderShippingAddressDto(
            FirstNonEmpty(order.ShippingAddressName, customer?.CompanyName),
            FirstNonEmpty(order.ShippingAddressLine1, fallback?.Line1),
            FirstNonEmpty(order.ShippingAddressLine2, fallback?.Line2),
            FirstNonEmpty(order.ShippingPostalCode, fallback?.PostalCode),
            FirstNonEmpty(order.ShippingCity, fallback?.City),
            FirstNonEmpty(order.ShippingCountry, fallback?.Country),
            FirstNonEmpty(order.ShippingPhone, customer?.MobilePhone, customer?.Phone),
            FirstNonEmpty(order.ShippingEmail, customer?.Email));
    }

    private static string? FirstNonEmpty(params string?[] values)
        => values.FirstOrDefault(x => !string.IsNullOrWhiteSpace(x))?.Trim();

    private static bool IsColissimoCarrier(string? carrierName)
        => !string.IsNullOrWhiteSpace(carrierName) && carrierName.Contains("colissimo", StringComparison.OrdinalIgnoreCase);

    private static string SanitizeFileName(string value)
    {
        var invalid = Path.GetInvalidFileNameChars();
        return new string(value.Select(x => invalid.Contains(x) ? '-' : x).ToArray());
    }

    private static string BuildColissimoLabelUrl(string template, string apiBaseUrl, string shopRootUrl, SalesOrder order, string externalOrderId)
        => template
            .Replace("{apiBaseUrl}", apiBaseUrl, StringComparison.OrdinalIgnoreCase)
            .Replace("{shopUrl}", shopRootUrl, StringComparison.OrdinalIgnoreCase)
            .Replace("{orderId}", Uri.EscapeDataString(externalOrderId), StringComparison.OrdinalIgnoreCase)
            .Replace("{orderReference}", Uri.EscapeDataString(order.Number), StringComparison.OrdinalIgnoreCase)
            .Replace("{orderNumber}", Uri.EscapeDataString(order.Number), StringComparison.OrdinalIgnoreCase);

    private static void AddPrestashopHeaders(HttpRequestMessage request, string apiKey, string accept)
    {
        request.Headers.Authorization = new AuthenticationHeaderValue(
            "Basic",
            Convert.ToBase64String(Encoding.ASCII.GetBytes($"{apiKey}:")));
        request.Headers.Accept.Add(new MediaTypeWithQualityHeaderValue(accept));
        if (!string.Equals(accept, "application/json", StringComparison.OrdinalIgnoreCase))
        {
            request.Headers.Accept.Add(new MediaTypeWithQualityHeaderValue("application/octet-stream"));
            request.Headers.Accept.Add(new MediaTypeWithQualityHeaderValue("image/*"));
        }
    }

    private static string GetApiBaseUrl(string shopUrl)
    {
        var normalized = shopUrl.Trim().TrimEnd('/');
        return normalized.EndsWith("/api", StringComparison.OrdinalIgnoreCase)
            ? normalized
            : $"{normalized}/api";
    }

    private static string GetShopRootUrl(string shopUrl)
    {
        var normalized = shopUrl.Trim().TrimEnd('/');
        return normalized.EndsWith("/api", StringComparison.OrdinalIgnoreCase)
            ? normalized[..^4]
            : normalized;
    }

    private static IReadOnlyList<string> FindStringsByPropertyNames(JsonElement element, string[] propertyNames)
    {
        var results = new List<string>();
        CollectStringsByPropertyNames(element, propertyNames, results);
        return results;
    }

    private static void CollectStringsByPropertyNames(JsonElement element, string[] propertyNames, List<string> results)
    {
        if (element.ValueKind == JsonValueKind.Object)
        {
            foreach (var property in element.EnumerateObject())
            {
                if (property.Value.ValueKind == JsonValueKind.String
                    && propertyNames.Any(name => property.Name.Contains(name, StringComparison.OrdinalIgnoreCase)))
                {
                    var value = property.Value.GetString();
                    if (!string.IsNullOrWhiteSpace(value))
                    {
                        results.Add(value);
                    }
                }
            }

            foreach (var property in element.EnumerateObject())
            {
                CollectStringsByPropertyNames(property.Value, propertyNames, results);
            }

            return;
        }

        if (element.ValueKind == JsonValueKind.Array)
        {
            foreach (var item in element.EnumerateArray())
            {
                CollectStringsByPropertyNames(item, propertyNames, results);
            }
        }
    }

    private static LabelBinary? DecodeBase64Label(string? value)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            return null;
        }

        var normalized = value.Trim();
        var mimeType = "application/pdf";
        var match = Regex.Match(normalized, @"^data:(?<mime>[^;]+);base64,(?<data>.+)$", RegexOptions.IgnoreCase | RegexOptions.Singleline);
        if (match.Success)
        {
            mimeType = match.Groups["mime"].Value;
            normalized = match.Groups["data"].Value;
        }

        normalized = Regex.Replace(normalized, @"\s+", string.Empty);
        if (normalized.Length < 60)
        {
            return null;
        }

        try
        {
            var content = Convert.FromBase64String(normalized);
            if (!LooksLikeLabelContent(mimeType, content))
            {
                return null;
            }

            return new LabelBinary(NormalizeMimeType(mimeType, content), content);
        }
        catch (FormatException)
        {
            return null;
        }
    }

    private static string? FindUrlInText(string text)
    {
        var match = Regex.Match(text, @"https?://[^\s""'<>]+", RegexOptions.IgnoreCase | RegexOptions.CultureInvariant);
        return match.Success ? match.Value : null;
    }

    private static string? ResolveLabelUrl(string reference, string shopRootUrl)
    {
        var trimmed = reference.Trim().Trim('"', '\'');
        if (Uri.TryCreate(trimmed, UriKind.Absolute, out var absolute))
        {
            return absolute.ToString();
        }

        if (trimmed.StartsWith("//", StringComparison.Ordinal))
        {
            var shopUri = new Uri(shopRootUrl);
            return $"{shopUri.Scheme}:{trimmed}";
        }

        return string.IsNullOrWhiteSpace(trimmed)
            ? null
            : $"{shopRootUrl.TrimEnd('/')}/{trimmed.TrimStart('/')}";
    }

    private static bool LooksLikeLabelContent(string? mimeType, byte[] content)
    {
        if (content.Length == 0)
        {
            return false;
        }

        var normalized = mimeType?.ToLowerInvariant() ?? string.Empty;
        if (normalized.Contains("pdf", StringComparison.Ordinal)
            || normalized.StartsWith("image/", StringComparison.Ordinal)
            || normalized.Contains("octet-stream", StringComparison.Ordinal))
        {
            return true;
        }

        return IsPdf(content) || IsPng(content) || IsJpeg(content) || IsGif(content) || IsWebp(content);
    }

    private static string NormalizeMimeType(string? mimeType, byte[] content)
    {
        if (IsPdf(content)) return "application/pdf";
        if (IsPng(content)) return "image/png";
        if (IsJpeg(content)) return "image/jpeg";
        if (IsGif(content)) return "image/gif";
        if (IsWebp(content)) return "image/webp";
        return string.IsNullOrWhiteSpace(mimeType) ? "application/pdf" : mimeType;
    }

    private static string BuildLabelFileName(string orderNumber, string? mimeType, byte[] content)
        => $"etiquette-colissimo-{SanitizeFileName(orderNumber)}{ExtensionFromMimeType(NormalizeMimeType(mimeType, content))}";

    private static string ExtensionFromMimeType(string mimeType)
        => mimeType.ToLowerInvariant() switch
        {
            "application/pdf" => ".pdf",
            "image/png" => ".png",
            "image/jpeg" => ".jpg",
            "image/gif" => ".gif",
            "image/webp" => ".webp",
            _ => ".bin"
        };

    private static bool IsPdf(byte[] content)
        => content.Length >= 4 && content[0] == 0x25 && content[1] == 0x50 && content[2] == 0x44 && content[3] == 0x46;

    private static bool IsPng(byte[] content)
        => content.Length >= 8 && content[0] == 0x89 && content[1] == 0x50 && content[2] == 0x4E && content[3] == 0x47;

    private static bool IsJpeg(byte[] content)
        => content.Length >= 3 && content[0] == 0xFF && content[1] == 0xD8 && content[2] == 0xFF;

    private static bool IsGif(byte[] content)
        => content.Length >= 3 && content[0] == 0x47 && content[1] == 0x49 && content[2] == 0x46;

    private static bool IsWebp(byte[] content)
        => content.Length >= 12 && content[0] == 0x52 && content[1] == 0x49 && content[2] == 0x46 && content[3] == 0x46
           && content[8] == 0x57 && content[9] == 0x45 && content[10] == 0x42 && content[11] == 0x50;

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

        return string.Join(" | ", messages.Distinct());
    }

    private static string? NormalizeStatus(string status)
    {
        if (string.IsNullOrWhiteSpace(status))
        {
            return null;
        }

        var known = AllowedTransitions.Keys.Concat(AllowedTransitions.Values.SelectMany(x => x)).Distinct(StringComparer.OrdinalIgnoreCase);
        return known.FirstOrDefault(x => string.Equals(x, status.Trim(), StringComparison.OrdinalIgnoreCase));
    }

    private sealed record StockOrderLine(Guid ProductId, decimal Quantity);
    private readonly record struct LabelBinary(string MimeType, byte[] Content);
}
