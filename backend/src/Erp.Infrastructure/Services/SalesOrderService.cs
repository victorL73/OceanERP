using Erp.Application.Common;
using Erp.Application.Sales;
using Erp.Application.Stock;
using Erp.Domain.Customers;
using Erp.Domain.FutureModules;
using Erp.Domain.Quotes;
using Erp.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using System.Net;
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
        "colissimo_ace",
        "colissimo_label_product",
        "colissimo_label_products",
        "colissimo_labels",
        "colissimo_label",
        "colissimo_shipping_labels",
        "colissimo_order_labels",
        "colissimo_shipments",
        "colissimo_orders"
    ];

    private static readonly string[] LabelBase64PropertyNames = ["label", "etiquette", "pdf", "file", "content", "base64", "zpl"];
    private static readonly string[] LabelUrlPropertyNames = ["label_url", "etiquette_url", "pdf_url", "download_url", "file_url", "label_file", "label_path", "url", "href", "link"];

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

        var validatedLines = new List<SalesOrderLine>();
        foreach (var line in request.Lines)
        {
            var validated = await BuildLineAsync(order.Id, line, cancellationToken);
            if (!validated.Succeeded)
            {
                return Result<SalesOrderDto>.Failure(validated.Error!);
            }

            validatedLines.Add(validated.Value!);
        }

        order.WarehouseId ??= await ResolveWarehouseIdFromLinesAsync(validatedLines, cancellationToken);
        db.SalesOrders.Add(order);
        db.SalesOrderLines.AddRange(validatedLines);
        db.SalesOrderStatusHistories.Add(new SalesOrderStatusHistory { SalesOrderId = order.Id, Status = order.Status });
        await db.SaveChangesAsync(cancellationToken);
        return Result<SalesOrderDto>.Success(await MapAsync(order, cancellationToken));
    }

    public async Task<Result<SalesOrderDto>> UpdateAsync(Guid id, UpdateSalesOrderRequest request, CancellationToken cancellationToken)
    {
        var order = await db.SalesOrders.FirstOrDefaultAsync(x => x.Id == id, cancellationToken);
        if (order is null)
        {
            return Result<SalesOrderDto>.Failure("Sales order not found.");
        }

        if (!await db.Customers.AnyAsync(x => x.Id == request.CustomerId, cancellationToken))
        {
            return Result<SalesOrderDto>.Failure("Customer not found.");
        }

        if (request.WarehouseId.HasValue && !await db.Warehouses.AnyAsync(x => x.Id == request.WarehouseId.Value, cancellationToken))
        {
            return Result<SalesOrderDto>.Failure("Warehouse not found.");
        }

        order.CustomerId = request.CustomerId;
        order.WarehouseId = request.WarehouseId ?? await ResolveWarehouseIdFromOrderLinesAsync(order.Id, cancellationToken);
        order.PaymentMethod = NullIfWhiteSpace(request.PaymentMethod);
        order.PaymentModule = NullIfWhiteSpace(request.PaymentModule);
        order.PaidTotal = request.PaidTotal;
        order.ProductsTotal = request.ProductsTotal;
        order.ShippingTotal = request.ShippingTotal;
        order.ShippingWeightKg = request.ShippingWeightKg;
        order.InvoiceReference = NullIfWhiteSpace(request.InvoiceReference);
        order.ShippingServiceName = NullIfWhiteSpace(request.ShippingServiceName);
        order.ShippingCarrierName = NullIfWhiteSpace(request.ShippingCarrierName);
        order.ShippingTrackingNumber = NullIfWhiteSpace(request.ShippingTrackingNumber);
        order.ShippingAddressName = NullIfWhiteSpace(request.ShippingAddress?.Name);
        order.ShippingAddressLine1 = NullIfWhiteSpace(request.ShippingAddress?.Line1);
        order.ShippingAddressLine2 = NullIfWhiteSpace(request.ShippingAddress?.Line2);
        order.ShippingPostalCode = NullIfWhiteSpace(request.ShippingAddress?.PostalCode);
        order.ShippingCity = NullIfWhiteSpace(request.ShippingAddress?.City);
        order.ShippingCountry = NullIfWhiteSpace(request.ShippingAddress?.Country);
        order.ShippingPhone = NullIfWhiteSpace(request.ShippingAddress?.Phone);
        order.ShippingEmail = NullIfWhiteSpace(request.ShippingAddress?.Email);

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

        if (db.Database.ProviderName == "Microsoft.EntityFrameworkCore.InMemory")
        {
            return await CreateOrderAndConvertQuoteAsync();
        }

        await using var transaction = await db.Database.BeginTransactionAsync(cancellationToken);
        var created = await CreateOrderAndConvertQuoteAsync();
        if (!created.Succeeded)
        {
            await transaction.RollbackAsync(cancellationToken);
            return created;
        }

        await transaction.CommitAsync(cancellationToken);
        return created;

        async Task<Result<SalesOrderDto>> CreateOrderAndConvertQuoteAsync()
        {
            var targetWarehouseId = request.WarehouseId ?? quote.StockReservationWarehouseId;
            if (quote.StockReserved)
            {
                await ReleaseQuoteReservationForOrderAsync(quote, $"Transformation du devis {quote.Number} en commande", cancellationToken);
            }

            var createdOrder = await CreateAsync(new CreateSalesOrderRequest(
                quote.CustomerId,
                targetWarehouseId,
                quote.Lines.Select(x => new CreateSalesOrderLineRequest(x.ProductId, x.Description, x.Quantity, x.UnitPrice)).ToList()), cancellationToken);

            if (!createdOrder.Succeeded)
            {
                return createdOrder;
            }

            quote.SetStatus(QuoteStatus.ConvertedToOrder);
            db.QuoteStatusHistories.Add(new QuoteStatusHistory
            {
                QuoteId = quote.Id,
                Status = QuoteStatus.ConvertedToOrder,
                Comment = $"Converted to order {createdOrder.Value!.Number}"
            });
            await db.SaveChangesAsync(cancellationToken);
            return createdOrder;
        }
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
            return Result<SalesOrderShipmentSlipFileDto>.Failure("Etiquette Colissimo introuvable : cette commande n'est pas reliee a une commande PrestaShop.");
        }

        var connection = await db.PrestashopConnections
            .Where(x => x.IsActive)
            .OrderByDescending(x => x.UpdatedAt ?? x.CreatedAt)
            .FirstOrDefaultAsync(cancellationToken);
        if (connection is null)
        {
            return Result<SalesOrderShipmentSlipFileDto>.Failure("Etiquette Colissimo introuvable : aucune connexion PrestaShop active n'est configuree.");
        }

        var apiKeyResult = PrestashopSecretProtector.ResolveApiKey(configuration, connection);
        if (!apiKeyResult.Succeeded)
        {
            return Result<SalesOrderShipmentSlipFileDto>.Failure($"Etiquette Colissimo introuvable : {apiKeyResult.Error ?? "cle API PrestaShop non configuree."}");
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
        var discoveredDetail = !string.IsNullOrWhiteSpace(discoveredResource.Error)
            ? $" Ressources API testees : {discoveredResource.Error}"
            : string.Empty;
        return Result<SalesOrderShipmentSlipFileDto>.Failure(
            $"{configuredDetail}Etiquette Colissimo officielle introuvable. Verifiez que le module OceanERP Bridge 0.2.0 est installe dans PrestaShop, que le token du pont est renseigne dans Parametres > PrestaShop, et que l'etiquette existe bien cote module Colissimo.{discoveredDetail}");
    }

    public async Task<Result> DeleteAsync(Guid id, CancellationToken cancellationToken)
    {
        var order = await db.SalesOrders.FirstOrDefaultAsync(x => x.Id == id, cancellationToken);
        if (order is null)
        {
            return Result.Failure("Commande introuvable.");
        }

        if (order.Status is "Shipped" or "Completed")
        {
            return Result.Failure("Une commande expediee ou terminee ne peut pas etre supprimee.");
        }

        if (await db.Invoices.AnyAsync(x => x.SalesOrderId == id, cancellationToken))
        {
            return Result.Failure("Une commande liee a une facture ne peut pas etre supprimee.");
        }

        var productLines = await GetStockOrderLinesAsync(order.Id, cancellationToken);
        if (order.WarehouseId.HasValue)
        {
            var releaseResult = await ReleaseReservationAsync(order, productLines, cancellationToken);
            if (!releaseResult.Succeeded)
            {
                return releaseResult;
            }
        }

        await DeleteOrderGraphAsync(order, cancellationToken);

        await db.SaveChangesAsync(cancellationToken);
        await lowStockAlerts.CheckAndNotifyAsync(cancellationToken);
        return Result.Success();
    }

    public async Task<Result> DeleteAsAdministratorAsync(Guid id, CancellationToken cancellationToken)
    {
        var order = await db.SalesOrders.FirstOrDefaultAsync(x => x.Id == id, cancellationToken);
        if (order is null)
        {
            return Result.Failure("Commande introuvable.");
        }

        var productLines = await GetStockOrderLinesAsync(order.Id, cancellationToken);
        var stockResult = await UndoStockEffectBeforeAdminDeleteAsync(order, productLines, cancellationToken);
        if (!stockResult.Succeeded)
        {
            return stockResult;
        }

        await DeleteInvoicesLinkedToOrderAsync(order.Id, cancellationToken);
        await DeleteOrderGraphAsync(order, cancellationToken);

        await db.SaveChangesAsync(cancellationToken);
        await lowStockAlerts.CheckAndNotifyAsync(cancellationToken);
        return Result.Success();
    }

    private async Task<Result> UndoStockEffectBeforeAdminDeleteAsync(SalesOrder order, IReadOnlyList<StockOrderLine> productLines, CancellationToken cancellationToken)
    {
        if (productLines.Count == 0)
        {
            return Result.Success();
        }

        order.WarehouseId ??= await ResolveWarehouseIdFromOrderLinesAsync(order.Id, cancellationToken);
        if (!order.WarehouseId.HasValue)
        {
            return Result.Failure("Suppression impossible : aucun entrepot n'est rattache aux lignes produit de cette commande.");
        }

        if (order.Status is "Confirmed" or "Preparing")
        {
            return await ReleaseReservationAsync(order, productLines, cancellationToken);
        }

        if (order.Status is not ("Shipped" or "Completed"))
        {
            return Result.Success();
        }

        if (await db.StockMovements.AnyAsync(x => x.ReferenceId == order.Id && x.Type == "AdminDeleteRestore", cancellationToken))
        {
            return Result.Success();
        }

        foreach (var line in productLines)
        {
            var item = await db.StockItems.FirstOrDefaultAsync(x => x.ProductId == line.ProductId && x.WarehouseId == order.WarehouseId.Value, cancellationToken);
            if (item is null)
            {
                db.StockItems.Add(new StockItem
                {
                    ProductId = line.ProductId,
                    WarehouseId = order.WarehouseId.Value,
                    QuantityOnHand = line.Quantity,
                    QuantityReserved = 0,
                    AlertThreshold = 0
                });
            }
            else
            {
                item.QuantityOnHand += line.Quantity;
            }

            db.StockMovements.Add(new StockMovement
            {
                ProductId = line.ProductId,
                WarehouseId = order.WarehouseId.Value,
                Quantity = line.Quantity,
                Type = "AdminDeleteRestore",
                Reason = $"Stock restored after admin deletion of order {order.Number}",
                ReferenceModule = "SalesOrder",
                ReferenceId = order.Id
            });
        }

        return Result.Success();
    }

    private async Task DeleteInvoicesLinkedToOrderAsync(Guid orderId, CancellationToken cancellationToken)
    {
        var invoices = await db.Invoices
            .Where(x => x.SalesOrderId == orderId)
            .ToListAsync(cancellationToken);

        var invoiceIds = invoices.Select(x => x.Id).ToHashSet();
        while (true)
        {
            var creditNotes = await db.Invoices
                .Where(x => x.CreditOfInvoiceId.HasValue && invoiceIds.Contains(x.CreditOfInvoiceId.Value) && !invoiceIds.Contains(x.Id))
                .ToListAsync(cancellationToken);
            if (creditNotes.Count == 0)
            {
                break;
            }

            invoices.AddRange(creditNotes);
            foreach (var creditNote in creditNotes)
            {
                invoiceIds.Add(creditNote.Id);
            }
        }

        if (invoiceIds.Count == 0)
        {
            return;
        }

        var ids = invoiceIds.ToArray();
        var lines = await db.InvoiceLines.Where(x => ids.Contains(x.InvoiceId)).ToListAsync(cancellationToken);
        var payments = await db.InvoicePayments.Where(x => ids.Contains(x.InvoiceId)).ToListAsync(cancellationToken);
        var documents = await db.InvoiceDocuments.Where(x => ids.Contains(x.InvoiceId)).ToListAsync(cancellationToken);
        var histories = await db.InvoiceStatusHistories.Where(x => ids.Contains(x.InvoiceId)).ToListAsync(cancellationToken);

        db.InvoiceLines.RemoveRange(lines);
        db.InvoicePayments.RemoveRange(payments);
        db.InvoiceDocuments.RemoveRange(documents);
        db.InvoiceStatusHistories.RemoveRange(histories);
        db.Invoices.RemoveRange(invoices);
    }

    private async Task DeleteOrderGraphAsync(SalesOrder order, CancellationToken cancellationToken)
    {
        var orderLines = await db.SalesOrderLines.Where(x => x.SalesOrderId == order.Id).ToListAsync(cancellationToken);
        var orderHistory = await db.SalesOrderStatusHistories.Where(x => x.SalesOrderId == order.Id).ToListAsync(cancellationToken);
        var emailLinks = await db.EmailLinks.Where(x => x.Module == "orders" && x.EntityId == order.Id).ToListAsync(cancellationToken);
        var documentLinks = await db.DocumentLinks.Where(x => x.Module == "orders" && x.EntityId == order.Id).ToListAsync(cancellationToken);
        var externalReferences = await db.ExternalReferences
            .Where(x => x.Provider == PrestashopProvider && x.Module == PrestashopOrderModule && x.EntityId == order.Id)
            .ToListAsync(cancellationToken);

        foreach (var externalReference in externalReferences)
        {
            externalReference.Module = $"{PrestashopOrderModule}.deleted";
            externalReference.EntityId = Guid.Empty;
        }

        db.SalesOrderLines.RemoveRange(orderLines);
        db.SalesOrderStatusHistories.RemoveRange(orderHistory);
        db.EmailLinks.RemoveRange(emailLinks);
        db.DocumentLinks.RemoveRange(documentLinks);
        db.SalesOrders.Remove(order);
    }

    private async Task<Result<SalesOrderShipmentSlipFileDto>> TryConfiguredColissimoLabelEndpointAsync(
        SalesOrder order,
        string externalOrderId,
        PrestashopConnection connection,
        string apiKey,
        CancellationToken cancellationToken)
    {
        var bridgeTokenResult = ResolveColissimoBridgeToken(connection);
        if (!bridgeTokenResult.Succeeded)
        {
            return Result<SalesOrderShipmentSlipFileDto>.Failure(bridgeTokenResult.Error!);
        }

        var templates = BuildColissimoLabelEndpointTemplates(connection, bridgeTokenResult.Value);
        if (templates.Count == 0)
        {
            return Result<SalesOrderShipmentSlipFileDto>.Failure("Aucun endpoint Colissimo n'est configure.");
        }

        var lastError = "Endpoint Colissimo non exploitable.";
        try
        {
            var apiBaseUrl = GetApiBaseUrl(connection.ShopUrl);
            var shopRootUrl = GetShopRootUrl(connection.ShopUrl);
            foreach (var endpointTemplate in templates)
            {
                var url = BuildColissimoLabelUrl(endpointTemplate, apiBaseUrl, shopRootUrl, order, externalOrderId, bridgeTokenResult.Value);
                using var request = new HttpRequestMessage(HttpMethod.Get, url);
                AddPrestashopHeaders(request, apiKey, "application/pdf");

                var client = httpClientFactory.CreateClient(nameof(SalesOrderService));
                using var response = await client.SendAsync(request, cancellationToken);
                var result = await BuildLabelFileFromResponseAsync(response, order, apiKey, shopRootUrl, cancellationToken);
                if (result.Succeeded)
                {
                    return result;
                }

                lastError = result.Error ?? lastError;
            }

            return Result<SalesOrderShipmentSlipFileDto>.Failure(lastError);
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
            foreach (var url in BuildColissimoResourceCandidateUrls(apiBaseUrl, resource, externalOrderId, order.Number))
            {
                try
                {
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
            var detail = BuildHttpErrorDetail(response.StatusCode, mimeType, content);
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
        CancellationToken cancellationToken,
        int depth = 0)
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
                var file = await DownloadReferencedLabelAsync(url, order, apiKey, shopRootUrl, cancellationToken, depth);
                if (file is not null)
                {
                    return file;
                }
            }
        }
        catch (JsonException)
        {
        }

        foreach (var base64 in FindBase64LabelsInText(text))
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

        foreach (var reference in FindLabelReferencesInText(text))
        {
            var file = await DownloadReferencedLabelAsync(reference, order, apiKey, shopRootUrl, cancellationToken, depth);
            if (file is not null)
            {
                return file;
            }
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
        CancellationToken cancellationToken,
        int depth = 0)
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
        if (LooksLikeLabelContent(mimeType, content))
        {
            return new SalesOrderShipmentSlipFileDto(BuildLabelFileName(order.Number, mimeType, content), NormalizeMimeType(mimeType, content), content);
        }

        if (depth >= 2 || !LooksLikeTextContent(mimeType, content))
        {
            return null;
        }

        return await TryExtractReferencedLabelAsync(Encoding.UTF8.GetString(content), order, apiKey, shopRootUrl, cancellationToken, depth + 1);
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

        var productLines = await GetStockOrderLinesAsync(order.Id, cancellationToken);

        if (productLines.Count == 0)
        {
            return Result.Success();
        }

        order.WarehouseId ??= await ResolveWarehouseIdFromOrderLinesAsync(order.Id, cancellationToken);
        if (!order.WarehouseId.HasValue)
        {
            return Result.Failure("Un entrepot est obligatoire avant de reserver ou expedier les lignes produit.");
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

    private async Task<List<StockOrderLine>> GetStockOrderLinesAsync(Guid orderId, CancellationToken cancellationToken)
        => await db.SalesOrderLines
            .Where(x => x.SalesOrderId == orderId && x.ProductId != null)
            .GroupBy(x => x.ProductId!.Value)
            .Select(x => new StockOrderLine(x.Key, x.Sum(line => line.Quantity)))
            .ToListAsync(cancellationToken);

    private async Task<Guid?> ResolveWarehouseIdFromOrderLinesAsync(Guid orderId, CancellationToken cancellationToken)
    {
        var lines = await db.SalesOrderLines
            .AsNoTracking()
            .Where(x => x.SalesOrderId == orderId && x.ProductId != null)
            .ToListAsync(cancellationToken);

        return await ResolveWarehouseIdFromLinesAsync(lines, cancellationToken);
    }

    private async Task<Guid?> ResolveWarehouseIdFromLinesAsync(IEnumerable<SalesOrderLine> lines, CancellationToken cancellationToken)
    {
        var productIds = lines
            .Where(x => x.ProductId.HasValue)
            .Select(x => x.ProductId!.Value)
            .Distinct()
            .ToArray();

        if (productIds.Length == 0)
        {
            return null;
        }

        var stockItems = await db.StockItems
            .AsNoTracking()
            .Where(x => productIds.Contains(x.ProductId))
            .Select(x => new { x.ProductId, x.WarehouseId, x.QuantityOnHand, x.QuantityReserved })
            .ToListAsync(cancellationToken);

        return stockItems
            .GroupBy(x => x.WarehouseId)
            .OrderByDescending(x => x.Select(item => item.ProductId).Distinct().Count())
            .ThenByDescending(x => x.Sum(item => item.QuantityOnHand - item.QuantityReserved))
            .ThenByDescending(x => x.Sum(item => item.QuantityOnHand))
            .Select(x => (Guid?)x.Key)
            .FirstOrDefault();
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
                var productLabel = await StockProductLabelAsync(line.ProductId, cancellationToken);
                var availableQuantity = item is null ? 0 : item.QuantityOnHand - item.QuantityReserved;
                return Result.Failure($"Stock insuffisant pour confirmer la commande : {productLabel} demande {FormatQuantity(line.Quantity)}, disponible {FormatQuantity(availableQuantity)} dans l'entrepot selectionne.");
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
            var item = await db.StockItems.FirstOrDefaultAsync(x => x.ProductId == line.ProductId && x.WarehouseId == order.WarehouseId!.Value, cancellationToken);
            if (item is null || item.QuantityReserved < line.Quantity || item.QuantityOnHand < line.Quantity)
            {
                var productLabel = await StockProductLabelAsync(line.ProductId, cancellationToken);
                var reservedQuantity = item?.QuantityReserved ?? 0;
                return Result.Failure($"Stock reserve insuffisant pour expedier la commande : {productLabel} demande {FormatQuantity(line.Quantity)}, reserve {FormatQuantity(reservedQuantity)} dans l'entrepot selectionne.");
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

    private async Task<string> StockProductLabelAsync(Guid productId, CancellationToken cancellationToken)
    {
        var product = await db.Products
            .Where(x => x.Id == productId)
            .Select(x => new { x.Reference, x.Name })
            .FirstOrDefaultAsync(cancellationToken);

        return product is null ? productId.ToString() : $"{product.Reference} - {product.Name}";
    }

    private static string FormatQuantity(decimal quantity)
        => quantity.ToString("0.###", System.Globalization.CultureInfo.InvariantCulture);

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
        var resolvedWarehouseId = order.WarehouseId ?? await ResolveWarehouseIdFromOrderLinesAsync(order.Id, cancellationToken);
        var warehouseName = resolvedWarehouseId.HasValue
            ? await db.Warehouses.Where(x => x.Id == resolvedWarehouseId.Value).Select(x => x.Name).FirstOrDefaultAsync(cancellationToken)
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
            resolvedWarehouseId,
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

    private static string? NullIfWhiteSpace(string? value)
        => string.IsNullOrWhiteSpace(value) ? null : value.Trim();

    private static bool IsColissimoCarrier(string? carrierName)
        => !string.IsNullOrWhiteSpace(carrierName) && carrierName.Contains("colissimo", StringComparison.OrdinalIgnoreCase);

    private static string SanitizeFileName(string value)
    {
        var invalid = Path.GetInvalidFileNameChars();
        return new string(value.Select(x => invalid.Contains(x) ? '-' : x).ToArray());
    }

    private static string BuildColissimoLabelUrl(string template, string apiBaseUrl, string shopRootUrl, SalesOrder order, string externalOrderId, string? bridgeToken)
    {
        var resolved = template
            .Replace("{apiBaseUrl}", apiBaseUrl, StringComparison.OrdinalIgnoreCase)
            .Replace("{shopUrl}", shopRootUrl, StringComparison.OrdinalIgnoreCase)
            .Replace("{externalOrderId}", Uri.EscapeDataString(externalOrderId), StringComparison.OrdinalIgnoreCase)
            .Replace("{orderId}", Uri.EscapeDataString(externalOrderId), StringComparison.OrdinalIgnoreCase)
            .Replace("{orderReference}", Uri.EscapeDataString(order.Number), StringComparison.OrdinalIgnoreCase)
            .Replace("{orderNumber}", Uri.EscapeDataString(order.Number), StringComparison.OrdinalIgnoreCase)
            .Replace("{trackingNumber}", Uri.EscapeDataString(order.ShippingTrackingNumber ?? string.Empty), StringComparison.OrdinalIgnoreCase)
            .Replace("{bridgeToken}", Uri.EscapeDataString(bridgeToken ?? string.Empty), StringComparison.OrdinalIgnoreCase);

        if (Uri.TryCreate(resolved, UriKind.Absolute, out var absolute))
        {
            return absolute.ToString();
        }

        return $"{shopRootUrl.TrimEnd('/')}/{resolved.TrimStart('/')}";
    }

    private static IReadOnlyList<string> BuildColissimoLabelEndpointTemplates(PrestashopConnection connection, string? bridgeToken)
    {
        var templates = new List<string>();
        if (!string.IsNullOrWhiteSpace(connection.ColissimoLabelEndpointTemplate))
        {
            templates.AddRange(SplitConfiguredTemplates(connection.ColissimoLabelEndpointTemplate));
        }

        if (!string.IsNullOrWhiteSpace(bridgeToken))
        {
            templates.Add("{shopUrl}/modules/oceanerpbridge/label.php?token={bridgeToken}&id_order={orderId}&order_reference={orderNumber}&tracking={trackingNumber}");
            templates.Add("{shopUrl}/module/oceanerpbridge/colissimolabel?token={bridgeToken}&id_order={orderId}&order_reference={orderNumber}&tracking={trackingNumber}");
            templates.Add("{shopUrl}/index.php?fc=module&module=oceanerpbridge&controller=colissimolabel&token={bridgeToken}&id_order={orderId}&order_reference={orderNumber}&tracking={trackingNumber}");
        }

        return templates.Distinct(StringComparer.OrdinalIgnoreCase).ToList();
    }

    private Result<string?> ResolveColissimoBridgeToken(PrestashopConnection connection)
    {
        if (string.IsNullOrWhiteSpace(connection.ColissimoBridgeTokenProtectedValue))
        {
            return Result<string?>.Success(null);
        }

        var token = PrestashopSecretProtector.UnprotectSecret(configuration, connection.ColissimoBridgeTokenProtectedValue);
        return token.Succeeded
            ? Result<string?>.Success(token.Value)
            : Result<string?>.Failure("Le token du pont Colissimo configure dans Parametres > PrestaShop ne peut pas etre dechiffre.");
    }

    private static IReadOnlyList<string> SplitConfiguredTemplates(string value)
        => value
            .Split(['\r', '\n', ';'], StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .Where(x => !string.IsNullOrWhiteSpace(x))
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToList();

    private static IReadOnlyList<string> BuildColissimoResourceCandidateUrls(string apiBaseUrl, string resource, string externalOrderId, string orderNumber)
    {
        var encodedOrderId = Uri.EscapeDataString(externalOrderId);
        var encodedOrderNumber = Uri.EscapeDataString(orderNumber);
        return
        [
            $"{apiBaseUrl}/{resource}?display=full&filter[id_order]=[{encodedOrderId}]&output_format=JSON",
            $"{apiBaseUrl}/{resource}?display=full&filter[id_order]={encodedOrderId}&output_format=JSON",
            $"{apiBaseUrl}/{resource}?display=full&filter[id_order_reference]=[{encodedOrderId}]&output_format=JSON",
            $"{apiBaseUrl}/{resource}?display=full&filter[order_reference]=[{encodedOrderNumber}]&output_format=JSON",
            $"{apiBaseUrl}/{resource}?display=full&filter[reference]=[{encodedOrderNumber}]&output_format=JSON"
        ];
    }

    private static void AddPrestashopHeaders(HttpRequestMessage request, string apiKey, string accept)
    {
        request.Headers.Authorization = new AuthenticationHeaderValue(
            "Basic",
            Convert.ToBase64String(Encoding.ASCII.GetBytes($"{apiKey}:")));
        request.Headers.Accept.Add(new MediaTypeWithQualityHeaderValue(accept));
        if (!string.Equals(accept, "application/json", StringComparison.OrdinalIgnoreCase))
        {
            request.Headers.Accept.Add(new MediaTypeWithQualityHeaderValue("application/octet-stream"));
            request.Headers.Accept.Add(new MediaTypeWithQualityHeaderValue("application/zip"));
            request.Headers.Accept.Add(new MediaTypeWithQualityHeaderValue("image/*"));
            request.Headers.Accept.Add(new MediaTypeWithQualityHeaderValue("text/html"));
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

    private static IReadOnlyList<string> FindLabelReferencesInText(string text)
    {
        var decoded = WebUtility.HtmlDecode(text);
        var candidates = new List<string>();

        foreach (Match match in Regex.Matches(decoded, @"(?:href|src)\s*=\s*[""'](?<url>[^""']+)[""']", RegexOptions.IgnoreCase | RegexOptions.CultureInvariant))
        {
            candidates.Add(match.Groups["url"].Value);
        }

        foreach (Match match in Regex.Matches(decoded, @"https?://[^\s""'<>]+", RegexOptions.IgnoreCase | RegexOptions.CultureInvariant))
        {
            candidates.Add(match.Value);
        }

        foreach (Match match in Regex.Matches(decoded, @"(?<url>/(?:modules|admin|download|files|img|upload)[^\s""'<>]+)", RegexOptions.IgnoreCase | RegexOptions.CultureInvariant))
        {
            candidates.Add(match.Groups["url"].Value);
        }

        return candidates
            .Select(x => x.Trim().Trim('"', '\'', ',', ';', ')', ']'))
            .Where(x => !string.IsNullOrWhiteSpace(x))
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .OrderByDescending(IsLikelyLabelReference)
            .ThenBy(x => x.Contains(".pdf", StringComparison.OrdinalIgnoreCase) ? 0 : 1)
            .ThenBy(x => x.Contains(".zip", StringComparison.OrdinalIgnoreCase) ? 0 : 1)
            .Take(20)
            .ToList();
    }

    private static IReadOnlyList<string> FindBase64LabelsInText(string text)
    {
        var decoded = WebUtility.HtmlDecode(text);
        var results = new List<string>();
        foreach (Match match in Regex.Matches(decoded, @"<(?<tag>[^>/]*(?:label|etiquette|pdf|file|zpl)[^>]*)>(?<data>[^<]{80,})</", RegexOptions.IgnoreCase | RegexOptions.CultureInvariant | RegexOptions.Singleline))
        {
            results.Add(match.Groups["data"].Value);
        }

        foreach (Match match in Regex.Matches(decoded, @"""(?<name>[^""]*(?:label|etiquette|pdf|file|zpl)[^""]*)""\s*:\s*""(?<data>[^""]{80,})""", RegexOptions.IgnoreCase | RegexOptions.CultureInvariant | RegexOptions.Singleline))
        {
            results.Add(match.Groups["data"].Value);
        }

        return results
            .Select(x => x.Trim())
            .Where(x => !string.IsNullOrWhiteSpace(x))
            .Distinct(StringComparer.Ordinal)
            .Take(10)
            .ToList();
    }

    private static bool IsLikelyLabelReference(string reference)
        => reference.Contains("label", StringComparison.OrdinalIgnoreCase)
           || reference.Contains("etiquette", StringComparison.OrdinalIgnoreCase)
           || reference.Contains("colissimo", StringComparison.OrdinalIgnoreCase)
           || reference.Contains("affranchissement", StringComparison.OrdinalIgnoreCase)
           || reference.Contains("bordereau", StringComparison.OrdinalIgnoreCase)
           || reference.Contains("download", StringComparison.OrdinalIgnoreCase)
           || reference.Contains(".pdf", StringComparison.OrdinalIgnoreCase)
           || reference.Contains(".zip", StringComparison.OrdinalIgnoreCase);

    private static string BuildHttpErrorDetail(HttpStatusCode statusCode, string? mimeType, byte[] content)
    {
        if (content.Length == 0)
        {
            return statusCode == HttpStatusCode.NotFound
                ? "endpoint introuvable."
                : string.Empty;
        }

        var normalizedMime = mimeType?.ToLowerInvariant() ?? string.Empty;
        if (normalizedMime.Contains("html", StringComparison.Ordinal) || normalizedMime.Contains("text", StringComparison.Ordinal) || normalizedMime.Contains("json", StringComparison.Ordinal) || normalizedMime.Contains("xml", StringComparison.Ordinal))
        {
            var text = Encoding.UTF8.GetString(content);
            var cleaned = WebUtility.HtmlDecode(Regex.Replace(text, "<[^>]+>", " "));
            cleaned = Regex.Replace(cleaned, @"\s+", " ").Trim();
            if (statusCode == HttpStatusCode.NotFound)
            {
                return string.IsNullOrWhiteSpace(cleaned)
                    ? "endpoint introuvable."
                    : $"endpoint introuvable ({TrimDetail(cleaned)}). Verifiez que le module OceanERP Bridge est installe et a jour dans PrestaShop.";
            }

            return cleaned;
        }

        return statusCode == HttpStatusCode.NotFound
            ? "endpoint introuvable."
            : "reponse non lisible.";
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
            || normalized.Contains("zip", StringComparison.Ordinal))
        {
            return true;
        }

        if (normalized.Contains("octet-stream", StringComparison.Ordinal))
        {
            return !LooksLikeTextContent(mimeType, content);
        }

        return IsPdf(content) || IsPng(content) || IsJpeg(content) || IsGif(content) || IsWebp(content) || IsZip(content);
    }

    private static string NormalizeMimeType(string? mimeType, byte[] content)
    {
        if (IsPdf(content)) return "application/pdf";
        if (IsPng(content)) return "image/png";
        if (IsJpeg(content)) return "image/jpeg";
        if (IsGif(content)) return "image/gif";
        if (IsWebp(content)) return "image/webp";
        if (IsZip(content)) return "application/zip";
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
            "application/zip" => ".zip",
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

    private static bool IsZip(byte[] content)
        => content.Length >= 4 && content[0] == 0x50 && content[1] == 0x4B && content[2] is 0x03 or 0x05 or 0x07;

    private static bool LooksLikeTextContent(string? mimeType, byte[] content)
    {
        var normalized = mimeType?.ToLowerInvariant() ?? string.Empty;
        if (normalized.Contains("json", StringComparison.Ordinal)
            || normalized.Contains("xml", StringComparison.Ordinal)
            || normalized.Contains("html", StringComparison.Ordinal)
            || normalized.StartsWith("text/", StringComparison.Ordinal))
        {
            return true;
        }

        var sample = Encoding.UTF8.GetString(content.AsSpan(0, Math.Min(content.Length, 120))).TrimStart();
        return sample.StartsWith("<", StringComparison.Ordinal) || sample.StartsWith("{", StringComparison.Ordinal) || sample.StartsWith("[", StringComparison.Ordinal);
    }

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

    private async Task ReleaseQuoteReservationForOrderAsync(Quote quote, string orderNumber, CancellationToken cancellationToken)
    {
        if (!quote.StockReserved || !quote.StockReservationWarehouseId.HasValue)
        {
            quote.StockReserved = false;
            quote.StockReleasedAt = DateTimeOffset.UtcNow;
            return;
        }

        var warehouseId = quote.StockReservationWarehouseId.Value;
        var lines = quote.Lines
            .Where(x => x.ProductId.HasValue && x.Quantity > 0)
            .GroupBy(x => x.ProductId!.Value)
            .Select(x => new QuoteStockLine(x.Key, x.Sum(line => line.Quantity)))
            .ToList();

        foreach (var line in lines)
        {
            var item = await db.StockItems.FirstOrDefaultAsync(x => x.ProductId == line.ProductId && x.WarehouseId == warehouseId, cancellationToken);
            if (item is null)
            {
                continue;
            }

            var released = Math.Min(item.QuantityReserved, line.Quantity);
            if (released <= 0)
            {
                continue;
            }

            item.QuantityReserved -= released;
            db.StockMovements.Add(new StockMovement
            {
                ProductId = line.ProductId,
                WarehouseId = warehouseId,
                Quantity = -released,
                Type = "QuoteRelease",
                Reason = $"Liberation du stock bloque apres transformation en commande {orderNumber}",
                ReferenceModule = "Quote",
                ReferenceId = quote.Id
            });
        }

        quote.StockReserved = false;
        quote.StockReleasedAt = DateTimeOffset.UtcNow;
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
    private sealed record QuoteStockLine(Guid ProductId, decimal Quantity);
    private readonly record struct LabelBinary(string MimeType, byte[] Content);
}
