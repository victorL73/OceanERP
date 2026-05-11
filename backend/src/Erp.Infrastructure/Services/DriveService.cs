using Erp.Application.Common;
using Erp.Application.Documents;
using Erp.Domain.Documents;
using Erp.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Erp.Infrastructure.Services;

public sealed class DriveService(ErpDbContext db, IFileStorageService fileStorageService) : IDriveService
{
    public async Task<IReadOnlyList<DriveFolderDto>> GetFoldersAsync(Guid? parentFolderId, CancellationToken cancellationToken)
        => await db.DriveFolders
            .Where(x => x.ParentFolderId == parentFolderId && !x.IsTrashed)
            .OrderBy(x => x.Name)
            .Select(x => new DriveFolderDto(x.Id, x.ParentFolderId, x.Name, x.IsTrashed, x.CreatedAt))
            .ToListAsync(cancellationToken);

    public async Task<IReadOnlyList<DriveItemDto>> GetFilesAsync(Guid? folderId, CancellationToken cancellationToken)
    {
        var files = await db.DriveItems
            .Where(x => x.FolderId == folderId && !x.IsTrashed)
            .OrderBy(x => x.Name)
            .ToListAsync(cancellationToken);
        return files.Select(Map).ToList();
    }

    public async Task<Result<DriveFolderDto>> CreateFolderAsync(CreateFolderRequest request, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.Name))
        {
            return Result<DriveFolderDto>.Failure("Folder name is required.");
        }

        var folder = new DriveFolder { ParentFolderId = request.ParentFolderId, Name = request.Name.Trim() };
        db.DriveFolders.Add(folder);
        db.DriveActivityLogs.Add(new DriveActivityLog { FolderId = folder.Id, Action = "folder.created" });
        await db.SaveChangesAsync(cancellationToken);
        return Result<DriveFolderDto>.Success(new DriveFolderDto(folder.Id, folder.ParentFolderId, folder.Name, folder.IsTrashed, folder.CreatedAt));
    }

    public async Task<Result<DriveUploadResult>> SaveFileAsync(Guid? folderId, string fileName, string mimeType, Stream content, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(fileName))
        {
            return Result<DriveUploadResult>.Failure("File name is required.");
        }

        var stored = await fileStorageService.SaveAsync("drive", fileName, content, cancellationToken);
        var item = new DriveItem
        {
            FolderId = folderId,
            Name = Path.GetFileName(fileName),
            MimeType = string.IsNullOrWhiteSpace(mimeType) ? "application/octet-stream" : mimeType,
            Size = stored.Size,
            StoragePath = stored.StoragePath,
            CurrentVersion = 1
        };

        item.Versions.Add(new DriveFileVersion
        {
            DriveItemId = item.Id,
            Version = 1,
            StoragePath = stored.StoragePath,
            Size = stored.Size,
            Sha256 = stored.Sha256
        });

        db.DriveItems.Add(item);
        db.DriveActivityLogs.Add(new DriveActivityLog { DriveItemId = item.Id, Action = "file.uploaded" });
        await db.SaveChangesAsync(cancellationToken);

        return Result<DriveUploadResult>.Success(new DriveUploadResult(Map(item), stored.Sha256));
    }

    public async Task<Result<(Stream Content, string FileName, string MimeType)>> OpenFileAsync(Guid id, CancellationToken cancellationToken)
    {
        var item = await db.DriveItems.FirstOrDefaultAsync(x => x.Id == id && !x.IsTrashed, cancellationToken);
        if (item is null)
        {
            return Result<(Stream, string, string)>.Failure("File not found.");
        }

        var stream = await fileStorageService.OpenReadAsync(item.StoragePath, cancellationToken);
        return Result<(Stream, string, string)>.Success((stream, item.Name, item.MimeType));
    }

    public async Task<Result> TrashFileAsync(Guid id, CancellationToken cancellationToken)
    {
        var item = await db.DriveItems.FirstOrDefaultAsync(x => x.Id == id, cancellationToken);
        if (item is null)
        {
            return Result.Failure("File not found.");
        }

        item.IsTrashed = true;
        db.DriveActivityLogs.Add(new DriveActivityLog { DriveItemId = id, Action = "file.trashed" });
        await db.SaveChangesAsync(cancellationToken);
        return Result.Success();
    }

    private static DriveItemDto Map(DriveItem item)
        => new(item.Id, item.FolderId, item.Name, item.MimeType, item.Size, item.CurrentVersion, item.IsTrashed, item.CreatedAt);
}
