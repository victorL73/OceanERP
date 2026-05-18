using Erp.Domain.Quotes;

namespace Erp.Application.Quotes;

public sealed record QuoteDto(
    Guid Id,
    string Number,
    Guid CustomerId,
    string? CustomerName,
    QuoteCustomerDto? Customer,
    string Status,
    DateOnly IssueDate,
    DateOnly ValidUntil,
    decimal Subtotal,
    decimal VatTotal,
    decimal Total,
    string Currency,
    IReadOnlyList<QuoteLineDto> Lines,
    IReadOnlyList<QuoteDocumentDto> Documents,
    IReadOnlyList<QuoteStatusHistoryDto> StatusHistory);

public sealed record QuoteCustomerDto(
    Guid Id,
    string Code,
    string CompanyName,
    string? LegalName,
    string? TradeName,
    string? SirenNumber,
    string? SiretNumber,
    string? VatNumber,
    string? Email,
    string? Phone,
    string? MobilePhone,
    string? Website,
    string? ContactName,
    string? ContactEmail,
    string? ContactPhone,
    string? AddressLabel,
    string? AddressLine1,
    string? AddressLine2,
    string? PostalCode,
    string? City,
    string? Country);

public sealed record QuoteLineDto(Guid Id, Guid? ProductId, string? ProductReference, string? ProductName, string Description, decimal Quantity, decimal UnitPrice, decimal DiscountRate, decimal VatRate, decimal LineNetTotal, decimal LineVatTotal, decimal LineTotal);
public sealed record QuoteDocumentDto(Guid Id, Guid? DriveItemId, string FileName, string MimeType, long Size, int Version, DateTimeOffset CreatedAt);
public sealed record QuoteStatusHistoryDto(Guid Id, string Status, string? Comment, Guid? ChangedByUserId, string? ChangedByDisplayName, string? ChangedByEmail, DateTimeOffset ChangedAt);
public sealed record CreateQuoteRequest(Guid CustomerId, DateOnly ValidUntil, IReadOnlyList<UpsertQuoteLineRequest> Lines);
public sealed record UpdateQuoteRequest(Guid CustomerId, DateOnly ValidUntil, IReadOnlyList<UpsertQuoteLineRequest> Lines);
public sealed record UpdateQuoteStatusRequest(string Status, string? Comment);
public sealed record UpsertQuoteLineRequest(Guid? ProductId, string Description, decimal Quantity, decimal UnitPrice, decimal DiscountRate, decimal VatRate);
public sealed record SendQuoteEmailRequest(Guid MailAccountId, string To, string? Subject = null, string? Body = null, string? Cc = null, string? Bcc = null);
public sealed record QuoteSettingsDto(Guid? Id, string CompanyName, string? AddressLine1, string? AddressLine2, string? PostalCode, string? City, string? Country, string? Phone, string? Email, string? Website, string? VatNumber, string? Siret, string? LegalText, string? FooterText, string? LogoFileName, string? LogoMimeType, long? LogoSize, string? LogoDataUrl, bool HasLogo);
public sealed record UpdateQuoteSettingsRequest(string CompanyName, string? AddressLine1 = null, string? AddressLine2 = null, string? PostalCode = null, string? City = null, string? Country = null, string? Phone = null, string? Email = null, string? Website = null, string? VatNumber = null, string? Siret = null, string? LegalText = null, string? FooterText = null);
public sealed record QuotePdfSettings(string CompanyName, string? AddressLine1, string? AddressLine2, string? PostalCode, string? City, string? Country, string? Phone, string? Email, string? Website, string? VatNumber, string? Siret, string? LegalText, string? FooterText)
{
    public static QuotePdfSettings Default { get; } = new("OceanERP", null, null, null, null, null, null, null, null, null, null, null, "Merci pour votre confiance.");
}
