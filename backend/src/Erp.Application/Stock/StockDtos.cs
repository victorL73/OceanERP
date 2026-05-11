namespace Erp.Application.Stock;

public sealed record WarehouseDto(Guid Id, string Name);
public sealed record StockItemDto(Guid Id, Guid ProductId, Guid WarehouseId, decimal QuantityOnHand, decimal AlertThreshold);
public sealed record StockMovementDto(Guid Id, Guid ProductId, Guid WarehouseId, decimal Quantity, string Reason, DateTimeOffset CreatedAt);
public sealed record CreateWarehouseRequest(string Name);
public sealed record AdjustStockRequest(Guid ProductId, Guid WarehouseId, decimal Quantity, string Reason, decimal? AlertThreshold);

