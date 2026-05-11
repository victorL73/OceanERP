using Erp.Application.Common;
using Erp.Application.Stock;
using Erp.Domain.FutureModules;
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
            .Select(x => new StockItemDto(x.Id, x.ProductId, x.WarehouseId, x.QuantityOnHand, x.AlertThreshold))
            .ToListAsync(cancellationToken);

    public async Task<Result<StockMovementDto>> AdjustAsync(AdjustStockRequest request, CancellationToken cancellationToken)
    {
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
        if (request.AlertThreshold is decimal threshold)
        {
            item.AlertThreshold = threshold;
        }

        var movement = new StockMovement
        {
            ProductId = request.ProductId,
            WarehouseId = request.WarehouseId,
            Quantity = request.Quantity,
            Reason = string.IsNullOrWhiteSpace(request.Reason) ? "Manual adjustment" : request.Reason.Trim()
        };
        db.StockMovements.Add(movement);
        await db.SaveChangesAsync(cancellationToken);

        return Result<StockMovementDto>.Success(new StockMovementDto(movement.Id, movement.ProductId, movement.WarehouseId, movement.Quantity, movement.Reason, movement.CreatedAt));
    }
}

