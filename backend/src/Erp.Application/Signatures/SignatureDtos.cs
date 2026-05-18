using Erp.Application.Common;

namespace Erp.Application.Signatures;

public sealed record SignatureRequestDto(
    Guid Id,
    Guid DriveItemId,
    string? DriveItemName,
    string Title,
    string Status,
    DateTimeOffset ExpiresAt,
    DateTimeOffset? CompletedAt,
    IReadOnlyList<SignatureRecipientDto> Recipients,
    IReadOnlyList<SignatureEvidenceDto> Evidence,
    IReadOnlyList<SignedDocumentDto> SignedDocuments);

public sealed record SignatureRecipientDto(Guid Id, string Email, string? Name, string Status, DateTimeOffset? SignedAt, string? SigningUrl = null);
public sealed record SignatureEvidenceDto(Guid Id, Guid? SignatureRecipientId, string Action, string DocumentSha256, bool ConditionsAccepted, string? SignatureMode, string? IpAddress, string? UserAgent, DateTimeOffset CreatedAt);
public sealed record SignedDocumentDto(Guid Id, string FileName, string MimeType, long Size, string DocumentSha256, DateTimeOffset CreatedAt);
public sealed record PublicSignatureDto(Guid RequestId, Guid RecipientId, string Title, string FileName, DateTimeOffset ExpiresAt, string Status, bool RequiresOtp, string DocumentUrl, string? SignedDocumentUrl, string? SignerName, string? SignerEmail);
public sealed record SignatureDocumentStream(Stream Content, string MimeType, string FileName);

public sealed record CreateSignatureRequestRequest(Guid DriveItemId, string Title, DateTimeOffset ExpiresAt, IReadOnlyList<CreateSignatureRecipientRequest> Recipients);
public sealed record CreateSignatureRecipientRequest(string Email, string? Name = null);
public sealed record AcceptSignatureRequest(bool ConditionsAccepted, string SignatureMode = "Click", string? DrawnSignatureDataUrl = null, string? OtpCode = null, string? SignerName = null, string? SignerEmail = null);

public interface ISignatureService
{
    Task<PagedResult<SignatureRequestDto>> SearchAsync(int page, int pageSize, CancellationToken cancellationToken);
    Task<Result<SignatureRequestDto>> GetAsync(Guid id, CancellationToken cancellationToken);
    Task<Result<SignatureRequestDto>> CreateAsync(CreateSignatureRequestRequest request, string publicBaseUrl, CancellationToken cancellationToken);
    Task<Result<SignatureRequestDto>> ChangeStatusAsync(Guid id, string status, CancellationToken cancellationToken);
    Task<Result> DeleteAsync(Guid id, CancellationToken cancellationToken);
    Task<Result<SignatureDocumentStream>> OpenDocumentAsync(Guid id, CancellationToken cancellationToken);
    Task<Result<SignatureDocumentStream>> OpenSignedDocumentAsync(Guid id, Guid signedDocumentId, CancellationToken cancellationToken);
    Task<Result<SignatureDocumentStream>> OpenPublicDocumentAsync(string token, bool signed, CancellationToken cancellationToken);
    Task<Result<PublicSignatureDto>> GetPublicAsync(string token, CancellationToken cancellationToken);
    Task<Result<SignatureRequestDto>> AcceptAsync(string token, AcceptSignatureRequest request, string? ipAddress, string? userAgent, CancellationToken cancellationToken);
}
