using Erp.Application.Common;
using Erp.Application.Purchases;
using Erp.Application.Stock;
using Erp.Domain.FutureModules;
using Erp.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Erp.Infrastructure.Services;

public sealed class PurchaseOrderService(ErpDbContext db, ILowStockAlertService lowStockAlerts, IStockService stock) : IPurchaseOrderService
{
    private static readonly IReadOnlyDictionary<string, string[]> AllowedTransitions = new Dictionary<string, string[]>(StringComparer.OrdinalIgnoreCase)
    {
        ["Draft"] = ["Ordered", "Cancelled"],
        ["Ordered"] = ["Draft", "PartiallyReceived", "Received", "Cancelled"],
        ["PartiallyReceived"] = ["Ordered", "Received", "Cancelled"],
        ["Received"] = ["Ordered", "PartiallyReceived", "Cancelled"],
        ["Cancelled"] = ["Draft"]
    };

    public async Task<PagedResult<PurchaseOrderDto>> SearchAsync(int page, int pageSize, CancellationToken cancellationToken)
    {
        page = Math.Max(1, page);
        pageSize = Math.Clamp(pageSize, 1, 100);
        var total = await db.PurchaseOrders.CountAsync(cancellationToken);
        var orders = await db.PurchaseOrders
            .AsNoTracking()
            .OrderByDescending(x => x.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(cancellationToken);

        return new PagedResult<PurchaseOrderDto>(await MapManyAsync(orders, cancellationToken), total, page, pageSize);
    }

    public async Task<Result<PurchaseOrderDto>> GetAsync(Guid id, CancellationToken cancellationToken)
    {
        var order = await db.PurchaseOrders.AsNoTracking().FirstOrDefaultAsync(x => x.Id == id, cancellationToken);
        return order is null
            ? Result<PurchaseOrderDto>.Failure("Commande fournisseur introuvable.")
            : Result<PurchaseOrderDto>.Success(await MapAsync(order, cancellationToken));
    }

    public async Task<Result<PurchaseOrderDto>> CreateAsync(CreatePurchaseOrderRequest request, CancellationToken cancellationToken)
    {
        if (!await db.ProductSuppliers.AnyAsync(x => x.Id == request.SupplierId, cancellationToken))
        {
            return Result<PurchaseOrderDto>.Failure("Fournisseur introuvable.");
        }

        if (request.Lines.Count == 0)
        {
            return Result<PurchaseOrderDto>.Failure("Une commande fournisseur requiert au moins une ligne.");
        }

        if (!request.WarehouseId.HasValue)
        {
            return Result<PurchaseOrderDto>.Failure("Selectionnez l'entrepot de reception avant de saisir une commande fournisseur.");
        }

        if (!await db.Warehouses.AnyAsync(x => x.Id == request.WarehouseId.Value, cancellationToken))
        {
            return Result<PurchaseOrderDto>.Failure("Entrepot de reception introuvable.");
        }

        var effectiveWarehouseId = request.WarehouseId.Value;
        var productSupplierResult = await ValidateProductsForSupplierAsync(request.Lines.Select(x => x.ProductId), request.SupplierId, cancellationToken);
        if (!productSupplierResult.Succeeded)
        {
            return Result<PurchaseOrderDto>.Failure(productSupplierResult.Error!);
        }

        var productWarehouseResult = await ValidateProductsInWarehouseAsync(request.Lines.Select(x => x.ProductId), effectiveWarehouseId, cancellationToken);
        if (!productWarehouseResult.Succeeded)
        {
            return Result<PurchaseOrderDto>.Failure(productWarehouseResult.Error!);
        }

        var order = new PurchaseOrder
        {
            Number = await NextNumberAsync(cancellationToken),
            SupplierId = request.SupplierId,
            WarehouseId = effectiveWarehouseId,
            ExpectedAt = request.ExpectedAt,
            Comment = NormalizeOptional(request.Comment),
            Status = "Draft"
        };
        db.PurchaseOrders.Add(order);

        foreach (var line in request.Lines)
        {
            var built = await BuildLineAsync(order.Id, line, cancellationToken);
            if (!built.Succeeded)
            {
                return Result<PurchaseOrderDto>.Failure(built.Error!);
            }

            db.PurchaseOrderLines.Add(built.Value!);
        }

        foreach (var charge in request.Charges ?? [])
        {
            var built = BuildCharge(order.Id, charge);
            if (!built.Succeeded)
            {
                return Result<PurchaseOrderDto>.Failure(built.Error!);
            }

            db.PurchaseOrderCharges.Add(built.Value!);
        }

        await db.SaveChangesAsync(cancellationToken);
        await lowStockAlerts.CheckAndNotifyAsync(cancellationToken);
        return Result<PurchaseOrderDto>.Success(await MapAsync(order, cancellationToken));
    }

    public async Task<Result<PurchaseOrderDto>> UpdateAsync(Guid id, UpdatePurchaseOrderRequest request, CancellationToken cancellationToken)
    {
        var order = await db.PurchaseOrders.FirstOrDefaultAsync(x => x.Id == id, cancellationToken);
        if (order is null)
        {
            return Result<PurchaseOrderDto>.Failure("Commande fournisseur introuvable.");
        }

        if (order.Status is "Received" or "Cancelled")
        {
            return Result<PurchaseOrderDto>.Failure("Reouvrez la commande fournisseur avant modification.");
        }

        if (await db.PurchaseOrderLines.AnyAsync(x => x.PurchaseOrderId == id && x.ReceivedQuantity > 0, cancellationToken))
        {
            return Result<PurchaseOrderDto>.Failure("La commande fournisseur ne peut plus etre modifiee apres ajout au stock.");
        }

        if (!await db.ProductSuppliers.AnyAsync(x => x.Id == request.SupplierId, cancellationToken))
        {
            return Result<PurchaseOrderDto>.Failure("Fournisseur introuvable.");
        }

        if (request.Lines.Count == 0)
        {
            return Result<PurchaseOrderDto>.Failure("Une commande fournisseur requiert au moins une ligne.");
        }

        if (!request.WarehouseId.HasValue)
        {
            return Result<PurchaseOrderDto>.Failure("Selectionnez l'entrepot de reception avant de modifier la commande fournisseur.");
        }

        if (!await db.Warehouses.AnyAsync(x => x.Id == request.WarehouseId.Value, cancellationToken))
        {
            return Result<PurchaseOrderDto>.Failure("Entrepot de reception introuvable.");
        }

        var effectiveWarehouseId = request.WarehouseId.Value;
        var productSupplierResult = await ValidateProductsForSupplierAsync(request.Lines.Select(x => x.ProductId), request.SupplierId, cancellationToken);
        if (!productSupplierResult.Succeeded)
        {
            return Result<PurchaseOrderDto>.Failure(productSupplierResult.Error!);
        }

        var productWarehouseResult = await ValidateProductsInWarehouseAsync(request.Lines.Select(x => x.ProductId), effectiveWarehouseId, cancellationToken);
        if (!productWarehouseResult.Succeeded)
        {
            return Result<PurchaseOrderDto>.Failure(productWarehouseResult.Error!);
        }

        var nextLines = new List<PurchaseOrderLine>();
        foreach (var line in request.Lines)
        {
            var built = await BuildLineAsync(order.Id, line, cancellationToken);
            if (!built.Succeeded)
            {
                return Result<PurchaseOrderDto>.Failure(built.Error!);
            }

            nextLines.Add(built.Value!);
        }

        var nextCharges = new List<PurchaseOrderCharge>();
        foreach (var charge in request.Charges ?? [])
        {
            var built = BuildCharge(order.Id, charge);
            if (!built.Succeeded)
            {
                return Result<PurchaseOrderDto>.Failure(built.Error!);
            }

            nextCharges.Add(built.Value!);
        }

        var oldLines = await db.PurchaseOrderLines.Where(x => x.PurchaseOrderId == id).ToListAsync(cancellationToken);
        var oldCharges = await db.PurchaseOrderCharges.Where(x => x.PurchaseOrderId == id).ToListAsync(cancellationToken);
        db.PurchaseOrderLines.RemoveRange(oldLines);
        db.PurchaseOrderCharges.RemoveRange(oldCharges);

        order.SupplierId = request.SupplierId;
        order.WarehouseId = effectiveWarehouseId;
        order.ExpectedAt = request.ExpectedAt;
        order.Comment = NormalizeOptional(request.Comment);
        db.PurchaseOrderLines.AddRange(nextLines);
        db.PurchaseOrderCharges.AddRange(nextCharges);

        await db.SaveChangesAsync(cancellationToken);
        await lowStockAlerts.CheckAndNotifyAsync(cancellationToken);
        return Result<PurchaseOrderDto>.Success(await MapAsync(order, cancellationToken));
    }

    public async Task<Result<PurchaseOrderDto>> ChangeStatusAsync(Guid id, UpdatePurchaseOrderStatusRequest request, CancellationToken cancellationToken)
    {
        var nextStatus = NormalizeStatus(request.Status);
        if (nextStatus is null)
        {
            return Result<PurchaseOrderDto>.Failure("Statut fournisseur inconnu.");
        }

        var order = await db.PurchaseOrders.FirstOrDefaultAsync(x => x.Id == id, cancellationToken);
        if (order is null)
        {
            return Result<PurchaseOrderDto>.Failure("Commande fournisseur introuvable.");
        }

        if (string.Equals(order.Status, nextStatus, StringComparison.OrdinalIgnoreCase))
        {
            return Result<PurchaseOrderDto>.Success(await MapAsync(order, cancellationToken));
        }

        if (!AllowedTransitions.TryGetValue(order.Status, out var allowed) || !allowed.Contains(nextStatus, StringComparer.OrdinalIgnoreCase))
        {
            return Result<PurchaseOrderDto>.Failure($"Transition invalide de {order.Status} vers {nextStatus}.");
        }

        order.Status = nextStatus;
        var now = DateTimeOffset.UtcNow;
        if (nextStatus == "Ordered") order.OrderedAt = now;
        if (nextStatus == "Received") order.ReceivedAt = now;
        if (nextStatus == "Cancelled") order.CancelledAt = now;
        if (nextStatus != "Received") order.ReceivedAt = null;
        if (nextStatus != "Cancelled") order.CancelledAt = null;

        await db.SaveChangesAsync(cancellationToken);
        await lowStockAlerts.CheckAndNotifyAsync(cancellationToken);
        return Result<PurchaseOrderDto>.Success(await MapAsync(order, cancellationToken));
    }

    public async Task<Result<PurchaseOrderDto>> UpdateExpectedAtAsync(Guid id, UpdatePurchaseOrderExpectedAtRequest request, CancellationToken cancellationToken)
    {
        var order = await db.PurchaseOrders.FirstOrDefaultAsync(x => x.Id == id, cancellationToken);
        if (order is null)
        {
            return Result<PurchaseOrderDto>.Failure("Commande fournisseur introuvable.");
        }

        if (order.Status is "Received" or "Cancelled")
        {
            return Result<PurchaseOrderDto>.Failure("La date ne peut plus etre modifiee sur une commande terminee ou annulee.");
        }

        order.ExpectedAt = request.ExpectedAt;
        await db.SaveChangesAsync(cancellationToken);
        return Result<PurchaseOrderDto>.Success(await MapAsync(order, cancellationToken));
    }

    public async Task<Result<PurchaseOrderDto>> UpdateWarehouseAsync(Guid id, UpdatePurchaseOrderWarehouseRequest request, CancellationToken cancellationToken)
    {
        var order = await db.PurchaseOrders.FirstOrDefaultAsync(x => x.Id == id, cancellationToken);
        if (order is null)
        {
            return Result<PurchaseOrderDto>.Failure("Commande fournisseur introuvable.");
        }

        if (await db.PurchaseOrderLines.AnyAsync(x => x.PurchaseOrderId == id && x.ReceivedQuantity > 0, cancellationToken))
        {
            return Result<PurchaseOrderDto>.Failure("L'entrepot ne peut plus etre modifie apres ajout au stock.");
        }

        if (request.WarehouseId.HasValue && !await db.Warehouses.AnyAsync(x => x.Id == request.WarehouseId.Value, cancellationToken))
        {
            return Result<PurchaseOrderDto>.Failure("Entrepot de reception introuvable.");
        }

        var productIds = await db.PurchaseOrderLines
            .Where(x => x.PurchaseOrderId == id)
            .Select(x => x.ProductId)
            .ToListAsync(cancellationToken);
        if (request.WarehouseId.HasValue)
        {
            var productWarehouseResult = await ValidateProductsInWarehouseAsync(productIds, request.WarehouseId.Value, cancellationToken);
            if (!productWarehouseResult.Succeeded)
            {
                return Result<PurchaseOrderDto>.Failure(productWarehouseResult.Error!);
            }
        }

        order.WarehouseId = request.WarehouseId;
        await db.SaveChangesAsync(cancellationToken);
        return Result<PurchaseOrderDto>.Success(await MapAsync(order, cancellationToken));
    }

    public async Task<Result<PurchaseOrderDto>> ReceiveToStockAsync(Guid id, ReceivePurchaseOrderToStockRequest request, CancellationToken cancellationToken)
    {
        var order = await db.PurchaseOrders.FirstOrDefaultAsync(x => x.Id == id, cancellationToken);
        if (order is null)
        {
            return Result<PurchaseOrderDto>.Failure("Commande fournisseur introuvable.");
        }

        if (!string.Equals(order.Status, "Received", StringComparison.OrdinalIgnoreCase))
        {
            return Result<PurchaseOrderDto>.Failure("La commande doit etre au statut recue avant ajout au stock.");
        }

        var lines = await db.PurchaseOrderLines
            .Where(x => x.PurchaseOrderId == id && x.ProductId.HasValue && x.Quantity > x.ReceivedQuantity)
            .OrderBy(x => x.Id)
            .ToListAsync(cancellationToken);

        if (lines.Count == 0)
        {
            return Result<PurchaseOrderDto>.Failure("Aucune ligne produit restante a ajouter au stock.");
        }

        var warehouseId = request.WarehouseId ?? order.WarehouseId;
        if (!warehouseId.HasValue)
        {
            return Result<PurchaseOrderDto>.Failure("Selectionnez l'entrepot de reception de la commande fournisseur avant ajout au stock.");
        }

        if (!db.Warehouses.Local.Any(x => x.Id == warehouseId.Value) && !await db.Warehouses.AnyAsync(x => x.Id == warehouseId.Value, cancellationToken))
        {
            return Result<PurchaseOrderDto>.Failure("Entrepot de reception introuvable.");
        }

        order.WarehouseId = warehouseId.Value;

        async Task<Result> AddLinesAsync()
        {
            foreach (var line in lines)
            {
                var quantity = line.Quantity - line.ReceivedQuantity;
                var result = await stock.AdjustAsync(new AdjustStockRequest(
                    line.ProductId!.Value,
                    warehouseId.Value,
                    quantity,
                    $"Reception commande fournisseur {order.Number}",
                    null,
                    "PurchaseOrder",
                    order.Id), cancellationToken);

                if (!result.Succeeded)
                {
                    return Result.Failure(result.Error!);
                }

                line.ReceivedQuantity = line.Quantity;
            }

            await db.SaveChangesAsync(cancellationToken);
            return Result.Success();
        }

        if (db.Database.ProviderName == "Microsoft.EntityFrameworkCore.InMemory")
        {
            var result = await AddLinesAsync();
            if (!result.Succeeded)
            {
                return Result<PurchaseOrderDto>.Failure(result.Error!);
            }
        }
        else
        {
            await using var transaction = await db.Database.BeginTransactionAsync(cancellationToken);
            var result = await AddLinesAsync();
            if (!result.Succeeded)
            {
                return Result<PurchaseOrderDto>.Failure(result.Error!);
            }

            await transaction.CommitAsync(cancellationToken);
        }

        await lowStockAlerts.CheckAndNotifyAsync(cancellationToken);

        return Result<PurchaseOrderDto>.Success(await MapAsync(order, cancellationToken));
    }

    private async Task<Result<PurchaseOrderLine>> BuildLineAsync(Guid orderId, CreatePurchaseOrderLineRequest request, CancellationToken cancellationToken)
    {
        if (request.Quantity <= 0)
        {
            return Result<PurchaseOrderLine>.Failure("La quantite doit etre superieure a zero.");
        }

        if (request.UnitPrice < 0)
        {
            return Result<PurchaseOrderLine>.Failure("Le prix d'achat ne peut pas etre negatif.");
        }

        var description = request.Description.Trim();
        var vatRate = request.VatRate;
        if (request.ProductId.HasValue)
        {
            var product = await db.Products.FirstOrDefaultAsync(x => x.Id == request.ProductId.Value, cancellationToken);
            if (product is null)
            {
                return Result<PurchaseOrderLine>.Failure("Produit introuvable.");
            }

            if (string.IsNullOrWhiteSpace(description))
            {
                description = $"{product.Reference} - {product.Name}";
            }

            vatRate ??= product.VatRate;
        }

        if (string.IsNullOrWhiteSpace(description))
        {
            return Result<PurchaseOrderLine>.Failure("La description est obligatoire.");
        }

        if (vatRate is < 0 or > 100)
        {
            return Result<PurchaseOrderLine>.Failure("Le taux de TVA doit etre compris entre 0 et 100.");
        }

        return Result<PurchaseOrderLine>.Success(new PurchaseOrderLine
        {
            PurchaseOrderId = orderId,
            ProductId = request.ProductId,
            Description = description,
            Quantity = request.Quantity,
            UnitPrice = request.UnitPrice,
            VatRate = vatRate ?? 20m
        });
    }

    private static Result<PurchaseOrderCharge> BuildCharge(Guid orderId, CreatePurchaseOrderChargeRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Label))
        {
            return Result<PurchaseOrderCharge>.Failure("Le libelle du frais annexe est obligatoire.");
        }

        if (request.Amount < 0)
        {
            return Result<PurchaseOrderCharge>.Failure("Le montant d'un frais annexe ne peut pas etre negatif.");
        }

        if (request.VatRate is < 0 or > 100)
        {
            return Result<PurchaseOrderCharge>.Failure("Le taux de TVA d'un frais annexe doit etre compris entre 0 et 100.");
        }

        return Result<PurchaseOrderCharge>.Success(new PurchaseOrderCharge
        {
            PurchaseOrderId = orderId,
            Label = request.Label.Trim(),
            Amount = request.Amount,
            VatRate = request.VatRate
        });
    }

    private async Task<IReadOnlyList<PurchaseOrderDto>> MapManyAsync(IReadOnlyList<PurchaseOrder> orders, CancellationToken cancellationToken)
    {
        var result = new List<PurchaseOrderDto>();
        foreach (var order in orders)
        {
            result.Add(await MapAsync(order, cancellationToken));
        }

        return result;
    }

    private async Task<PurchaseOrderDto> MapAsync(PurchaseOrder order, CancellationToken cancellationToken)
    {
        var supplierName = await db.ProductSuppliers
            .Where(x => x.Id == order.SupplierId)
            .Select(x => x.Name)
            .FirstOrDefaultAsync(cancellationToken);

        var warehouseName = order.WarehouseId.HasValue
            ? await db.Warehouses
                .Where(x => x.Id == order.WarehouseId.Value)
                .Select(x => x.Name)
                .FirstOrDefaultAsync(cancellationToken)
            : null;

        var lines = await db.PurchaseOrderLines
            .Where(x => x.PurchaseOrderId == order.Id)
            .GroupJoin(db.Products, line => line.ProductId, product => product.Id, (line, products) => new { line, product = products.FirstOrDefault() })
            .OrderBy(x => x.line.Id)
            .Select(x => new
            {
                x.line.Id,
                x.line.ProductId,
                ProductReference = x.product == null ? null : x.product.Reference,
                ProductName = x.product == null ? null : x.product.Name,
                x.line.Description,
                x.line.Quantity,
                x.line.UnitPrice,
                x.line.VatRate,
                x.line.ReceivedQuantity
            })
            .ToListAsync(cancellationToken);

        var lineDtos = lines.Select(x =>
        {
            var net = decimal.Round(x.Quantity * x.UnitPrice, 2);
            var vat = decimal.Round(net * x.VatRate / 100m, 2);
            return new PurchaseOrderLineDto(
                x.Id,
                x.ProductId,
                x.ProductReference,
                x.ProductName,
                x.Description,
                x.Quantity,
                x.UnitPrice,
                x.VatRate,
                x.ReceivedQuantity,
                net,
                vat,
                net + vat);
        }).ToList();

        var chargeRows = await db.PurchaseOrderCharges
            .Where(x => x.PurchaseOrderId == order.Id)
            .OrderBy(x => x.Id)
            .Select(x => new { x.Id, x.Label, x.Amount, x.VatRate })
            .ToListAsync(cancellationToken);

        var charges = chargeRows.Select(x =>
        {
            var vat = decimal.Round(x.Amount * x.VatRate / 100m, 2);
            return new PurchaseOrderChargeDto(x.Id, x.Label, x.Amount, x.VatRate, vat, x.Amount + vat);
        }).ToList();

        var linesNetTotal = lineDtos.Sum(x => x.LineNetTotal);
        var linesVatTotal = lineDtos.Sum(x => x.LineVatTotal);
        var chargesNetTotal = charges.Sum(x => x.Amount);
        var chargesVatTotal = charges.Sum(x => x.VatTotal);

        return new PurchaseOrderDto(
            order.Id,
            order.Number,
            order.SupplierId,
            supplierName,
            order.WarehouseId,
            warehouseName,
            order.Status,
            order.ExpectedAt,
            order.Comment,
            linesNetTotal,
            linesVatTotal,
            chargesNetTotal,
            chargesVatTotal,
            linesNetTotal + linesVatTotal + chargesNetTotal + chargesVatTotal,
            lineDtos,
            charges);
    }

    private async Task<string> NextNumberAsync(CancellationToken cancellationToken)
    {
        var prefix = $"ACH-{DateTime.UtcNow:yyyy}-";
        var count = await db.PurchaseOrders.CountAsync(x => x.Number.StartsWith(prefix), cancellationToken);
        return $"{prefix}{count + 1:0000}";
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

    private async Task<Result> ValidateProductsInWarehouseAsync(IEnumerable<Guid?> productIds, Guid warehouseId, CancellationToken cancellationToken)
    {
        var ids = productIds
            .Where(x => x.HasValue)
            .Select(x => x!.Value)
            .Distinct()
            .ToList();
        if (ids.Count == 0)
        {
            return Result.Success();
        }

        var assignedIds = await db.StockItems
            .Where(x => x.WarehouseId == warehouseId && ids.Contains(x.ProductId))
            .Select(x => x.ProductId)
            .Distinct()
            .ToListAsync(cancellationToken);
        var missingIds = ids.Except(assignedIds).ToList();
        if (missingIds.Count == 0)
        {
            return Result.Success();
        }

        var products = await db.Products
            .Where(x => missingIds.Contains(x.Id))
            .OrderBy(x => x.Reference)
            .Select(x => $"{x.Reference} - {x.Name}")
            .ToListAsync(cancellationToken);

        return Result.Failure($"Ces produits ne sont pas rattaches a l'entrepot selectionne: {string.Join(", ", products)}.");
    }

    private async Task<Result> ValidateProductsForSupplierAsync(IEnumerable<Guid?> productIds, Guid supplierId, CancellationToken cancellationToken)
    {
        var ids = productIds
            .Where(x => x.HasValue)
            .Select(x => x!.Value)
            .Distinct()
            .ToList();
        if (ids.Count == 0)
        {
            return Result.Success();
        }

        var assignedIds = await db.Products
            .Where(x => ids.Contains(x.Id) && x.MainSupplierId == supplierId)
            .Select(x => x.Id)
            .Distinct()
            .ToListAsync(cancellationToken);
        var missingIds = ids.Except(assignedIds).ToList();
        if (missingIds.Count == 0)
        {
            return Result.Success();
        }

        var products = await db.Products
            .Where(x => missingIds.Contains(x.Id))
            .OrderBy(x => x.Reference)
            .Select(x => $"{x.Reference} - {x.Name}")
            .ToListAsync(cancellationToken);

        return Result.Failure($"Ces produits ne sont pas rattaches au fournisseur selectionne: {string.Join(", ", products)}.");
    }

    private static string? NormalizeOptional(string? value)
        => string.IsNullOrWhiteSpace(value) ? null : value.Trim();
}
