using Erp.Application.Common;

namespace Erp.Application.Stock;

public interface IStockService
{
    Task<IReadOnlyList<WarehouseDto>> GetWarehousesAsync(CancellationToken cancellationToken);
    Task<Result<WarehouseDto>> CreateWarehouseAsync(CreateWarehouseRequest request, CancellationToken cancellationToken);
    Task<IReadOnlyList<StockItemDto>> GetStockItemsAsync(CancellationToken cancellationToken);
    Task<Result<StockMovementDto>> AdjustAsync(AdjustStockRequest request, CancellationToken cancellationToken);
}

