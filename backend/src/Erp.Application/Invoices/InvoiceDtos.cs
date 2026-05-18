namespace Erp.Application.Invoices;

public sealed record InvoiceDto(
    Guid Id,
    string Number,
    string Kind,
    Guid CustomerId,
    string CustomerName,
    Guid? SalesOrderId,
    string? SalesOrderNumber,
    Guid? CreditOfInvoiceId,
    string? CreditOfInvoiceNumber,
    string Status,
    DateOnly IssueDate,
    DateOnly DueDate,
    decimal Total,
    decimal PaidTotal,
    decimal BalanceDue,
    string FacturXProfile,
    bool FacturXReady,
    IReadOnlyList<InvoiceLineDto> Lines,
    IReadOnlyList<InvoiceDocumentDto> Documents,
    IReadOnlyList<InvoiceStatusHistoryDto> StatusHistory);

public sealed record InvoiceLineDto(Guid Id, string Description, decimal Quantity, decimal UnitPrice, decimal LineTotal);
public sealed record InvoiceDocumentDto(Guid Id, string FileName, string MimeType, long Size, int Version, DateTimeOffset CreatedAt);
public sealed record InvoiceStatusHistoryDto(Guid Id, string Status, DateTimeOffset ChangedAt);
public sealed record InvoiceFacturXExportDto(string FileName, string MimeType, string Xml);
public sealed record CreateInvoiceFromOrderRequest(Guid SalesOrderId, DateOnly? DueDate = null);
public sealed record AddInvoicePaymentRequest(decimal Amount, DateOnly PaidOn);
public sealed record CreateCreditNoteRequest(string? Reason = null);
