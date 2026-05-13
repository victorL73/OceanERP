using Erp.Application.Common;
using Erp.Application.Sales;
using Erp.Application.Stock;
using Erp.Domain.FutureModules;
using Erp.Domain.Quotes;
using Erp.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Erp.Infrastructure.Services;

public sealed class SalesOrderService(ErpDbContext db, ILowStockAlertService lowStockAlerts) : ISalesOrderService
{
    private static readonly IReadOnlyDictionary<string, string[]> AllowedTransitions = new Dictionary<string, string[]>(StringComparer.OrdinalIgnoreCase)
    {
        ["Draft"] = ["Confirmed", "Cancelled"],
        ["Confirmed"] = ["Preparing", "Shipped", "Cancelled"],
        ["Preparing"] = ["Shipped", "Cancelled"],
        ["Shipped"] = ["Completed"],
        ["Completed"] = [],
        ["Cancelled"] = []
    };

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
        var lines = await db.SalesOrderLines.Where(x => x.SalesOrderId == order.Id).OrderBy(x => x.Id).ToListAsync(cancellationToken);
        var lineDtos = lines.Select(x => new SalesOrderLineDto(x.Id, x.ProductId, x.Description, x.Quantity, x.UnitPrice, decimal.Round(x.Quantity * x.UnitPrice, 2))).ToList();
        return new SalesOrderDto(order.Id, order.Number, order.CustomerId, order.WarehouseId, order.Status, lineDtos.Sum(x => x.LineTotal), lineDtos);
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
}
