using Erp.Application.Common;

namespace Erp.Application.Documents;

public interface IDriveService
{
    Task<IReadOnlyList<DriveFolderDto>> GetFoldersAsync(Guid? parentFolderId, string? search, bool includeTrashed, CancellationToken cancellationToken);
    Task<IReadOnlyList<DriveItemDto>> GetFilesAsync(Guid? folderId, string? search, bool includeTrashed, CancellationToken cancellationToken);
    Task<Result<DriveFolderDto>> CreateFolderAsync(CreateFolderRequest request, CancellationToken cancellationToken);
    Task<Result<DriveFolderDto>> RenameFolderAsync(Guid id, RenameDriveItemRequest request, CancellationToken cancellationToken);
    Task<Result<DriveFolderDto>> MoveFolderAsync(Guid id, MoveDriveItemRequest request, CancellationToken cancellationToken);
    Task<Result> TrashFolderAsync(Guid id, CancellationToken cancellationToken);
    Task<Result<DriveFolderDto>> RestoreFolderAsync(Guid id, CancellationToken cancellationToken);
    Task<Result<DriveUploadResult>> SaveFileAsync(Guid? folderId, string fileName, string mimeType, Stream content, CancellationToken cancellationToken);
    Task<Result<(Stream Content, string FileName, string MimeType)>> OpenFileAsync(Guid id, CancellationToken cancellationToken);
    Task<Result<DriveItemDto>> RenameFileAsync(Guid id, RenameDriveItemRequest request, CancellationToken cancellationToken);
    Task<Result<DriveItemDto>> MoveFileAsync(Guid id, MoveDriveItemRequest request, CancellationToken cancellationToken);
    Task<Result> TrashFileAsync(Guid id, CancellationToken cancellationToken);
    Task<Result<DriveItemDto>> RestoreFileAsync(Guid id, CancellationToken cancellationToken);
    Task<IReadOnlyList<DocumentLinkDto>> GetLinksAsync(string module, Guid entityId, CancellationToken cancellationToken);
    Task<Result<DocumentLinkDto>> LinkFileAsync(CreateDocumentLinkRequest request, CancellationToken cancellationToken);
    Task<Result> UnlinkFileAsync(Guid linkId, CancellationToken cancellationToken);
}
