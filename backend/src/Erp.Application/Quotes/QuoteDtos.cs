using Erp.Domain.Quotes;

namespace Erp.Application.Quotes;

public sealed record QuoteDto(
    Guid Id,
    string Number,
    Guid CustomerId,
    string? CustomerName,
    QuoteStatus Status,
    DateOnly IssueDate,
    DateOnly ValidUntil,
    decimal Subtotal,
    decimal VatTotal,
    decimal Total,
    string Currency,
    IReadOnlyList<QuoteLineDto> Lines,
    IReadOnlyList<QuoteDocumentDto> Documents);

public sealed record QuoteLineDto(Guid Id, Guid? ProductId, string Description, decimal Quantity, decimal UnitPrice, decimal DiscountRate, decimal VatRate, decimal LineNetTotal, decimal LineVatTotal, decimal LineTotal);
public sealed record QuoteDocumentDto(Guid Id, string FileName, string MimeType, long Size, int Version, DateTimeOffset CreatedAt);
public sealed record CreateQuoteRequest(Guid CustomerId, DateOnly ValidUntil, IReadOnlyList<UpsertQuoteLineRequest> Lines);
public sealed record UpdateQuoteStatusRequest(QuoteStatus Status, string? Comment);
public sealed record UpsertQuoteLineRequest(Guid? ProductId, string Description, decimal Quantity, decimal UnitPrice, decimal DiscountRate, decimal VatRate);

