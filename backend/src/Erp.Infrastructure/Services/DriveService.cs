using Erp.Application.Common;
using Erp.Application.Documents;
using Erp.Domain.Documents;
using Erp.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Erp.Infrastructure.Services;

public sealed class DriveService(ErpDbContext db, IFileStorageService fileStorageService, QuoteDocumentDriveLinker quoteDocumentDriveLinker) : IDriveService
{
    public async Task<IReadOnlyList<DriveFolderDto>> GetFoldersAsync(Guid? parentFolderId, string? search, bool includeTrashed, CancellationToken cancellationToken)
    {
        var query = db.DriveFolders.AsQueryable();
        if (!includeTrashed)
        {
            query = query.Where(x => !x.IsTrashed);
        }

        if (!string.IsNullOrWhiteSpace(search))
        {
            var term = search.Trim().ToLower();
            query = query.Where(x => x.Name.ToLower().Contains(term));
        }
        else
        {
            query = query.Where(x => x.ParentFolderId == parentFolderId);
        }

        return await query
            .OrderBy(x => x.Name)
            .Select(x => new DriveFolderDto(x.Id, x.ParentFolderId, x.Name, x.IsTrashed, x.CreatedAt))
            .ToListAsync(cancellationToken);
    }

    public async Task<IReadOnlyList<DriveItemDto>> GetFilesAsync(Guid? folderId, string? search, bool includeTrashed, CancellationToken cancellationToken)
    {
        await quoteDocumentDriveLinker.BackfillAsync(cancellationToken);

        var query = db.DriveItems.AsQueryable();
        if (!includeTrashed)
        {
            query = query.Where(x => !x.IsTrashed);
        }

        if (!string.IsNullOrWhiteSpace(search))
        {
            var term = search.Trim().ToLower();
            query = query.Where(x => x.Name.ToLower().Contains(term) || x.MimeType.ToLower().Contains(term));
        }
        else
        {
            query = query.Where(x => x.FolderId == folderId);
        }

        var files = await query.OrderBy(x => x.Name).ToListAsync(cancellationToken);
        return files.Select(Map).ToList();
    }

    public async Task<Result<DriveFolderDto>> CreateFolderAsync(CreateFolderRequest request, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.Name))
        {
            return Result<DriveFolderDto>.Failure("Folder name is required.");
        }

        if (request.ParentFolderId.HasValue && !await db.DriveFolders.AnyAsync(x => x.Id == request.ParentFolderId.Value && !x.IsTrashed, cancellationToken))
        {
            return Result<DriveFolderDto>.Failure("Parent folder not found.");
        }

        var folder = new DriveFolder { ParentFolderId = request.ParentFolderId, Name = request.Name.Trim() };
        db.DriveFolders.Add(folder);
        db.DriveActivityLogs.Add(new DriveActivityLog { FolderId = folder.Id, Action = "folder.created" });
        await db.SaveChangesAsync(cancellationToken);
        return Result<DriveFolderDto>.Success(new DriveFolderDto(folder.Id, folder.ParentFolderId, folder.Name, folder.IsTrashed, folder.CreatedAt));
    }

    public async Task<Result<DriveFolderDto>> RenameFolderAsync(Guid id, RenameDriveItemRequest request, CancellationToken cancellationToken)
    {
        var folder = await db.DriveFolders.FirstOrDefaultAsync(x => x.Id == id, cancellationToken);
        if (folder is null)
        {
            return Result<DriveFolderDto>.Failure("Folder not found.");
        }

        if (string.IsNullOrWhiteSpace(request.Name))
        {
            return Result<DriveFolderDto>.Failure("Folder name is required.");
        }

        folder.Name = request.Name.Trim();
        db.DriveActivityLogs.Add(new DriveActivityLog { FolderId = id, Action = "folder.renamed" });
        await db.SaveChangesAsync(cancellationToken);
        return Result<DriveFolderDto>.Success(Map(folder));
    }

    public async Task<Result<DriveFolderDto>> MoveFolderAsync(Guid id, MoveDriveItemRequest request, CancellationToken cancellationToken)
    {
        var folder = await db.DriveFolders.FirstOrDefaultAsync(x => x.Id == id, cancellationToken);
        if (folder is null)
        {
            return Result<DriveFolderDto>.Failure("Folder not found.");
        }

        if (request.FolderId == id)
        {
            return Result<DriveFolderDto>.Failure("A folder cannot be moved into itself.");
        }

        if (request.FolderId.HasValue)
        {
            var parent = await db.DriveFolders.FirstOrDefaultAsync(x => x.Id == request.FolderId.Value && !x.IsTrashed, cancellationToken);
            if (parent is null)
            {
                return Result<DriveFolderDto>.Failure("Destination folder not found.");
            }

            if (await IsDescendantAsync(parent.Id, folder.Id, cancellationToken))
            {
                return Result<DriveFolderDto>.Failure("A folder cannot be moved into one of its children.");
            }
        }

        folder.ParentFolderId = request.FolderId;
        db.DriveActivityLogs.Add(new DriveActivityLog { FolderId = id, Action = "folder.moved" });
        await db.SaveChangesAsync(cancellationToken);
        return Result<DriveFolderDto>.Success(Map(folder));
    }

    public async Task<Result> TrashFolderAsync(Guid id, CancellationToken cancellationToken)
    {
        var folder = await db.DriveFolders.FirstOrDefaultAsync(x => x.Id == id, cancellationToken);
        if (folder is null)
        {
            return Result.Failure("Folder not found.");
        }

        folder.IsTrashed = true;
        db.DriveActivityLogs.Add(new DriveActivityLog { FolderId = id, Action = "folder.trashed" });
        await db.SaveChangesAsync(cancellationToken);
        return Result.Success();
    }

    public async Task<Result<DriveFolderDto>> RestoreFolderAsync(Guid id, CancellationToken cancellationToken)
    {
        var folder = await db.DriveFolders.FirstOrDefaultAsync(x => x.Id == id, cancellationToken);
        if (folder is null)
        {
            return Result<DriveFolderDto>.Failure("Folder not found.");
        }

        folder.IsTrashed = false;
        db.DriveActivityLogs.Add(new DriveActivityLog { FolderId = id, Action = "folder.restored" });
        await db.SaveChangesAsync(cancellationToken);
        return Result<DriveFolderDto>.Success(Map(folder));
    }

    public async Task<Result<DriveUploadResult>> SaveFileAsync(Guid? folderId, string fileName, string mimeType, Stream content, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(fileName))
        {
            return Result<DriveUploadResult>.Failure("File name is required.");
        }

        if (folderId.HasValue && !await db.DriveFolders.AnyAsync(x => x.Id == folderId.Value && !x.IsTrashed, cancellationToken))
        {
            return Result<DriveUploadResult>.Failure("Folder not found.");
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

    public async Task<Result<DriveItemDto>> RenameFileAsync(Guid id, RenameDriveItemRequest request, CancellationToken cancellationToken)
    {
        var item = await db.DriveItems.FirstOrDefaultAsync(x => x.Id == id, cancellationToken);
        if (item is null)
        {
            return Result<DriveItemDto>.Failure("File not found.");
        }

        if (string.IsNullOrWhiteSpace(request.Name))
        {
            return Result<DriveItemDto>.Failure("File name is required.");
        }

        item.Name = Path.GetFileName(request.Name.Trim());
        db.DriveActivityLogs.Add(new DriveActivityLog { DriveItemId = id, Action = "file.renamed" });
        await db.SaveChangesAsync(cancellationToken);
        return Result<DriveItemDto>.Success(Map(item));
    }

    public async Task<Result<DriveItemDto>> MoveFileAsync(Guid id, MoveDriveItemRequest request, CancellationToken cancellationToken)
    {
        var item = await db.DriveItems.FirstOrDefaultAsync(x => x.Id == id, cancellationToken);
        if (item is null)
        {
            return Result<DriveItemDto>.Failure("File not found.");
        }

        if (request.FolderId.HasValue && !await db.DriveFolders.AnyAsync(x => x.Id == request.FolderId.Value && !x.IsTrashed, cancellationToken))
        {
            return Result<DriveItemDto>.Failure("Destination folder not found.");
        }

        item.FolderId = request.FolderId;
        db.DriveActivityLogs.Add(new DriveActivityLog { DriveItemId = id, Action = "file.moved" });
        await db.SaveChangesAsync(cancellationToken);
        return Result<DriveItemDto>.Success(Map(item));
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

    public async Task<Result<DriveItemDto>> RestoreFileAsync(Guid id, CancellationToken cancellationToken)
    {
        var item = await db.DriveItems.FirstOrDefaultAsync(x => x.Id == id, cancellationToken);
        if (item is null)
        {
            return Result<DriveItemDto>.Failure("File not found.");
        }

        item.IsTrashed = false;
        db.DriveActivityLogs.Add(new DriveActivityLog { DriveItemId = id, Action = "file.restored" });
        await db.SaveChangesAsync(cancellationToken);
        return Result<DriveItemDto>.Success(Map(item));
    }

    public async Task<IReadOnlyList<DocumentLinkDto>> GetLinksAsync(string module, Guid entityId, CancellationToken cancellationToken)
    {
        var normalizedModule = NormalizeModule(module);
        return await db.DocumentLinks
            .Include(x => x.DriveItem)
            .Where(x => x.Module == normalizedModule && x.EntityId == entityId && x.DriveItem != null && !x.DriveItem.IsTrashed)
            .OrderByDescending(x => x.CreatedAt)
            .Select(x => new DocumentLinkDto(
                x.Id,
                x.DriveItemId,
                x.DriveItem!.Name,
                x.DriveItem.MimeType,
                x.DriveItem.Size,
                x.Module,
                x.EntityId,
                x.CreatedAt))
            .ToListAsync(cancellationToken);
    }

    public async Task<Result<DocumentLinkDto>> LinkFileAsync(CreateDocumentLinkRequest request, CancellationToken cancellationToken)
    {
        var normalizedModule = NormalizeModule(request.Module);
        if (string.IsNullOrWhiteSpace(normalizedModule))
        {
            return Result<DocumentLinkDto>.Failure("Module is required.");
        }

        var file = await db.DriveItems.FirstOrDefaultAsync(x => x.Id == request.DriveItemId && !x.IsTrashed, cancellationToken);
        if (file is null)
        {
            return Result<DocumentLinkDto>.Failure("File not found.");
        }

        var existing = await db.DocumentLinks
            .FirstOrDefaultAsync(x => x.Module == normalizedModule && x.EntityId == request.EntityId && x.DriveItemId == request.DriveItemId, cancellationToken);
        if (existing is not null)
        {
            return Result<DocumentLinkDto>.Success(Map(existing, file));
        }

        var link = new DocumentLink { DriveItemId = request.DriveItemId, Module = normalizedModule, EntityId = request.EntityId };
        db.DocumentLinks.Add(link);
        db.DriveActivityLogs.Add(new DriveActivityLog { DriveItemId = file.Id, Action = $"file.linked.{normalizedModule}" });
        await db.SaveChangesAsync(cancellationToken);
        return Result<DocumentLinkDto>.Success(Map(link, file));
    }

    public async Task<Result> UnlinkFileAsync(Guid linkId, CancellationToken cancellationToken)
    {
        var link = await db.DocumentLinks.FirstOrDefaultAsync(x => x.Id == linkId, cancellationToken);
        if (link is null)
        {
            return Result.Failure("Document link not found.");
        }

        db.DocumentLinks.Remove(link);
        db.DriveActivityLogs.Add(new DriveActivityLog { DriveItemId = link.DriveItemId, Action = $"file.unlinked.{link.Module}" });
        await db.SaveChangesAsync(cancellationToken);
        return Result.Success();
    }

    private async Task<bool> IsDescendantAsync(Guid candidateFolderId, Guid rootFolderId, CancellationToken cancellationToken)
    {
        var currentId = candidateFolderId;
        while (true)
        {
            var parentId = await db.DriveFolders
                .Where(x => x.Id == currentId)
                .Select(x => x.ParentFolderId)
                .FirstOrDefaultAsync(cancellationToken);
            if (!parentId.HasValue)
            {
                return false;
            }

            if (parentId.Value == rootFolderId)
            {
                return true;
            }

            currentId = parentId.Value;
        }
    }

    private static DriveItemDto Map(DriveItem item)
        => new(item.Id, item.FolderId, item.Name, item.MimeType, item.Size, item.CurrentVersion, item.IsTrashed, item.CreatedAt);

    private static DriveFolderDto Map(DriveFolder folder)
        => new(folder.Id, folder.ParentFolderId, folder.Name, folder.IsTrashed, folder.CreatedAt);

    private static DocumentLinkDto Map(DocumentLink link, DriveItem item)
        => new(link.Id, item.Id, item.Name, item.MimeType, item.Size, link.Module, link.EntityId, link.CreatedAt);

    private static string NormalizeModule(string? module)
        => (module ?? string.Empty).Trim().ToLowerInvariant();
}
