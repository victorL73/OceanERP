using Erp.Application.Common;

namespace Erp.Application.Stock;

public interface IStockService
{
    Task<IReadOnlyList<WarehouseDto>> GetWarehousesAsync(CancellationToken cancellationToken);
    Task<Result<WarehouseDto>> CreateWarehouseAsync(CreateWarehouseRequest request, CancellationToken cancellationToken);
    Task<Result<WarehouseDto>> UpdateWarehouseAsync(Guid warehouseId, UpdateWarehouseRequest request, CancellationToken cancellationToken);
    Task<Result> DeleteWarehouseAsync(Guid warehouseId, CancellationToken cancellationToken);
    Task<IReadOnlyList<StockItemDto>> GetStockItemsAsync(CancellationToken cancellationToken);
    Task<IReadOnlyList<StockMovementDto>> GetMovementsAsync(Guid? productId, CancellationToken cancellationToken);
    Task<Result<StockMovementDto>> AdjustAsync(AdjustStockRequest request, CancellationToken cancellationToken);
    Task<Result<StockItemDto>> UpdateStockItemAsync(Guid stockItemId, UpdateStockItemRequest request, CancellationToken cancellationToken);
}
