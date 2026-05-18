using Erp.Application.Common;

namespace Erp.Application.Documents;

public sealed record OnlyOfficeConfigDto(
    string DocumentServerUrl,
    string DocumentType,
    string Type,
    OnlyOfficeDocumentDto Document,
    OnlyOfficeEditorConfigDto EditorConfig);

public sealed record OnlyOfficeDocumentDto(string FileType, string Key, string Title, string Url);
public sealed record OnlyOfficeEditorConfigDto(string Mode, string CallbackUrl, OnlyOfficeUserDto User);
public sealed record OnlyOfficeUserDto(string Id, string Name);
public sealed record OnlyOfficeCallbackRequest(int Status, string? Url, string? Key, IReadOnlyList<string>? Users);

public interface IOnlyOfficeService
{
    Task<Result<OnlyOfficeConfigDto>> GetConfigAsync(Guid driveItemId, Uri requestBaseUri, CancellationToken cancellationToken);
    Task<Result<(Stream Content, string FileName, string MimeType)>> OpenDocumentAsync(Guid driveItemId, string? token, CancellationToken cancellationToken);
    Task<Result> HandleCallbackAsync(Guid driveItemId, string? token, OnlyOfficeCallbackRequest request, CancellationToken cancellationToken);
}
