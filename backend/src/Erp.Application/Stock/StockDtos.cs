namespace Erp.Application.Stock;

public sealed record WarehouseDto(Guid Id, string Name);
public sealed record StockItemDto(Guid Id, Guid ProductId, Guid WarehouseId, decimal QuantityOnHand, decimal QuantityReserved, decimal AvailableQuantity, decimal AlertThreshold, bool IsLowStock);
public sealed record StockMovementDto(Guid Id, Guid ProductId, Guid WarehouseId, decimal Quantity, string Type, string Reason, string? ReferenceModule, Guid? ReferenceId, DateTimeOffset CreatedAt);
public sealed record CreateWarehouseRequest(string Name);
public sealed record AdjustStockRequest(Guid ProductId, Guid WarehouseId, decimal Quantity, string Reason, decimal? AlertThreshold);
