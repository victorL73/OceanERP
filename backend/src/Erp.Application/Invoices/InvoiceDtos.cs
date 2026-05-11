namespace Erp.Application.Invoices;

public sealed record InvoiceDto(Guid Id, string Number, Guid CustomerId, string Status, decimal Total, IReadOnlyList<InvoiceLineDto> Lines);
public sealed record InvoiceLineDto(Guid Id, string Description, decimal Quantity, decimal UnitPrice);
public sealed record CreateInvoiceFromOrderRequest(Guid SalesOrderId);
public sealed record AddInvoicePaymentRequest(decimal Amount, DateOnly PaidOn);

