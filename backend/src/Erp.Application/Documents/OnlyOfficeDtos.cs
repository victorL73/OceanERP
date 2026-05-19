using Erp.Application.Common;

namespace Erp.Application.Documents;

public sealed record OnlyOfficeConfigDto(
    string DocumentServerUrl,
    string DocumentType,
    string Type,
    OnlyOfficeDocumentDto Document,
    OnlyOfficeEditorConfigDto EditorConfig,
    string? Token = null);

public sealed record OnlyOfficeDocumentDto(string FileType, string Key, string Title, string Url, OnlyOfficeDocumentPermissionsDto? Permissions = null);
public sealed record OnlyOfficeDocumentPermissionsDto(bool Edit, bool Download, bool Print);
public sealed record OnlyOfficeEditorConfigDto(string Mode, string CallbackUrl, OnlyOfficeUserDto User, OnlyOfficeCustomizationDto? Customization = null, string Lang = "fr", string Region = "fr-FR");
public sealed record OnlyOfficeCustomizationDto(bool Autosave, bool Forcesave, bool Chat, bool Comments);
public sealed record OnlyOfficeUserDto(string Id, string Name);
public sealed record OnlyOfficeCallbackRequest(int Status, string? Url, string? Key, IReadOnlyList<string>? Users);

public interface IOnlyOfficeService
{
    Task<Result<OnlyOfficeConfigDto>> GetConfigAsync(Guid driveItemId, Uri requestBaseUri, CancellationToken cancellationToken);
    Task<Result<(Stream Content, string FileName, string MimeType)>> OpenDocumentAsync(Guid driveItemId, string? token, CancellationToken cancellationToken);
    Task<Result> HandleCallbackAsync(Guid driveItemId, string? token, OnlyOfficeCallbackRequest request, CancellationToken cancellationToken);
}
