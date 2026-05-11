using Erp.Application.Common;
using Erp.Application.Stock;
using Erp.Domain.FutureModules;
using Erp.Domain.Notifications;
using Erp.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Erp.Infrastructure.Services;

public sealed class StockService(ErpDbContext db) : IStockService
{
    public async Task<IReadOnlyList<WarehouseDto>> GetWarehousesAsync(CancellationToken cancellationToken)
        => await db.Warehouses.OrderBy(x => x.Name).Select(x => new WarehouseDto(x.Id, x.Name)).ToListAsync(cancellationToken);

    public async Task<Result<WarehouseDto>> CreateWarehouseAsync(CreateWarehouseRequest request, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.Name))
        {
            return Result<WarehouseDto>.Failure("Warehouse name is required.");
        }

        var warehouse = new Warehouse { Name = request.Name.Trim() };
        db.Warehouses.Add(warehouse);
        await db.SaveChangesAsync(cancellationToken);
        return Result<WarehouseDto>.Success(new WarehouseDto(warehouse.Id, warehouse.Name));
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
        if (request.Quantity == 0)
        {
            return Result<StockMovementDto>.Failure("Quantity must not be zero.");
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
            Type = "Adjustment",
            Reason = string.IsNullOrWhiteSpace(request.Reason) ? "Manual adjustment" : request.Reason.Trim()
        };
        db.StockMovements.Add(movement);
        await AddLowStockNotificationAsync(item, cancellationToken);
        await db.SaveChangesAsync(cancellationToken);

        return Result<StockMovementDto>.Success(Map(movement));
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

    private static StockMovementDto Map(StockMovement movement)
        => new(movement.Id, movement.ProductId, movement.WarehouseId, movement.Quantity, movement.Type, movement.Reason, movement.ReferenceModule, movement.ReferenceId, movement.CreatedAt);
}
