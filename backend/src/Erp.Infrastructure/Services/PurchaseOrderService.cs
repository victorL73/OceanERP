using Erp.Application.Common;
using Erp.Application.Purchases;
using Erp.Application.Stock;
using Erp.Domain.FutureModules;
using Erp.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Erp.Infrastructure.Services;

public sealed class PurchaseOrderService(ErpDbContext db, ILowStockAlertService lowStockAlerts) : IPurchaseOrderService
{
    private static readonly IReadOnlyDictionary<string, string[]> AllowedTransitions = new Dictionary<string, string[]>(StringComparer.OrdinalIgnoreCase)
    {
        ["Draft"] = ["Ordered", "Cancelled"],
        ["Ordered"] = ["PartiallyReceived", "Received", "Cancelled"],
        ["PartiallyReceived"] = ["Received", "Cancelled"],
        ["Received"] = [],
        ["Cancelled"] = []
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

        var order = new PurchaseOrder
        {
            Number = await NextNumberAsync(cancellationToken),
            SupplierId = request.SupplierId,
            ExpectedAt = request.ExpectedAt,
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
        }

        if (string.IsNullOrWhiteSpace(description))
        {
            return Result<PurchaseOrderLine>.Failure("La description est obligatoire.");
        }

        return Result<PurchaseOrderLine>.Success(new PurchaseOrderLine
        {
            PurchaseOrderId = orderId,
            ProductId = request.ProductId,
            Description = description,
            Quantity = request.Quantity,
            UnitPrice = request.UnitPrice
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

        var lines = await db.PurchaseOrderLines
            .Where(x => x.PurchaseOrderId == order.Id)
            .GroupJoin(db.Products, line => line.ProductId, product => product.Id, (line, products) => new { line, product = products.FirstOrDefault() })
            .OrderBy(x => x.line.Id)
            .Select(x => new PurchaseOrderLineDto(
                x.line.Id,
                x.line.ProductId,
                x.product == null ? null : x.product.Reference,
                x.product == null ? null : x.product.Name,
                x.line.Description,
                x.line.Quantity,
                x.line.UnitPrice,
                x.line.ReceivedQuantity,
                decimal.Round(x.line.Quantity * x.line.UnitPrice, 2)))
            .ToListAsync(cancellationToken);

        return new PurchaseOrderDto(order.Id, order.Number, order.SupplierId, supplierName, order.Status, order.ExpectedAt, lines.Sum(x => x.LineTotal), lines);
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
}
