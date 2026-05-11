namespace Erp.Application.Sales;

public sealed record SalesOrderDto(Guid Id, string Number, Guid CustomerId, Guid? WarehouseId, string Status, decimal Total, IReadOnlyList<SalesOrderLineDto> Lines);
public sealed record SalesOrderLineDto(Guid Id, Guid? ProductId, string Description, decimal Quantity, decimal UnitPrice, decimal LineTotal);
public sealed record CreateSalesOrderRequest(Guid CustomerId, Guid? WarehouseId, IReadOnlyList<CreateSalesOrderLineRequest> Lines);
public sealed record CreateSalesOrderLineRequest(Guid? ProductId, string Description, decimal Quantity, decimal UnitPrice);
public sealed record CreateSalesOrderFromQuoteRequest(Guid QuoteId, Guid? WarehouseId = null);
public sealed record UpdateSalesOrderStatusRequest(string Status);
