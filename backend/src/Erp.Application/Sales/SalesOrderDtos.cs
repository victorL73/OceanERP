namespace Erp.Application.Sales;

public sealed record SalesOrderDto(Guid Id, string Number, Guid CustomerId, string Status, IReadOnlyList<SalesOrderLineDto> Lines);
public sealed record SalesOrderLineDto(Guid Id, string Description, decimal Quantity, decimal UnitPrice);
public sealed record CreateSalesOrderRequest(Guid CustomerId, IReadOnlyList<CreateSalesOrderLineRequest> Lines);
public sealed record CreateSalesOrderLineRequest(string Description, decimal Quantity, decimal UnitPrice);
public sealed record CreateSalesOrderFromQuoteRequest(Guid QuoteId);
public sealed record UpdateSalesOrderStatusRequest(string Status);

