namespace Erp.Application.Stock;

public sealed record WarehouseDto(Guid Id, string Name, string? AddressLine1, string? AddressLine2, string? PostalCode, string? City, string? Country, string? RepresentativeName, string? Phone, string? Email, string? Notes);
public sealed record StockItemDto(Guid Id, Guid ProductId, Guid WarehouseId, decimal QuantityOnHand, decimal QuantityReserved, decimal QuantityBlockedByQuotes, decimal AvailableQuantity, decimal AlertThreshold, bool IsLowStock);
public sealed record StockMovementDto(Guid Id, Guid ProductId, Guid WarehouseId, decimal Quantity, string Type, string Reason, string? ReferenceModule, Guid? ReferenceId, DateTimeOffset CreatedAt, Guid? CreatedByUserId, string? CreatedByDisplayName, string? CreatedByEmail);
public sealed record CreateWarehouseRequest(string Name, string? AddressLine1 = null, string? AddressLine2 = null, string? PostalCode = null, string? City = null, string? Country = null, string? RepresentativeName = null, string? Phone = null, string? Email = null, string? Notes = null);
public sealed record UpdateWarehouseRequest(string Name, string? AddressLine1 = null, string? AddressLine2 = null, string? PostalCode = null, string? City = null, string? Country = null, string? RepresentativeName = null, string? Phone = null, string? Email = null, string? Notes = null);
public sealed record AdjustStockRequest(Guid ProductId, Guid WarehouseId, decimal Quantity, string Reason, decimal? AlertThreshold, string? ReferenceModule = null, Guid? ReferenceId = null);
public sealed record UpdateStockItemRequest(Guid WarehouseId, decimal QuantityOnHand, decimal? AlertThreshold);
