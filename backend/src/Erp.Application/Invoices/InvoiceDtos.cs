namespace Erp.Application.Invoices;

public sealed record InvoiceDto(
    Guid Id,
    string Number,
    Guid CustomerId,
    Guid? SalesOrderId,
    string Status,
    DateOnly IssueDate,
    DateOnly DueDate,
    decimal Total,
    decimal PaidTotal,
    decimal BalanceDue,
    IReadOnlyList<InvoiceLineDto> Lines,
    IReadOnlyList<InvoiceDocumentDto> Documents);

public sealed record InvoiceLineDto(Guid Id, string Description, decimal Quantity, decimal UnitPrice, decimal LineTotal);
public sealed record InvoiceDocumentDto(Guid Id, string FileName, string MimeType, long Size, int Version, DateTimeOffset CreatedAt);
public sealed record CreateInvoiceFromOrderRequest(Guid SalesOrderId, DateOnly? DueDate = null);
public sealed record AddInvoicePaymentRequest(decimal Amount, DateOnly PaidOn);
