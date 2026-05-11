using Erp.Application.Common;

namespace Erp.Application.Documents;

public interface IDriveService
{
    Task<IReadOnlyList<DriveFolderDto>> GetFoldersAsync(Guid? parentFolderId, CancellationToken cancellationToken);
    Task<IReadOnlyList<DriveItemDto>> GetFilesAsync(Guid? folderId, CancellationToken cancellationToken);
    Task<Result<DriveFolderDto>> CreateFolderAsync(CreateFolderRequest request, CancellationToken cancellationToken);
    Task<Result<DriveUploadResult>> SaveFileAsync(Guid? folderId, string fileName, string mimeType, Stream content, CancellationToken cancellationToken);
    Task<Result<(Stream Content, string FileName, string MimeType)>> OpenFileAsync(Guid id, CancellationToken cancellationToken);
    Task<Result> TrashFileAsync(Guid id, CancellationToken cancellationToken);
}

