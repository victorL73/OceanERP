using Erp.Application.Common;
using Erp.Domain.Documents;
using Erp.Domain.Quotes;
using Erp.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Erp.Infrastructure.Services;

public sealed class QuoteDocumentDriveLinker(ErpDbContext db, ICurrentUserService currentUser)
{
    private const string QuoteFolderName = "Devis";
    private const string QuoteModule = "quotes";

    public async Task LinkAsync(QuoteDocument document, string? sha256, CancellationToken cancellationToken)
    {
        var driveItem = await FindExistingDriveItemAsync(document, cancellationToken);
        if (driveItem is null)
        {
            var folderId = await EnsureQuoteFolderAsync(cancellationToken);
            driveItem = new DriveItem
            {
                FolderId = folderId,
                Name = Path.GetFileName(document.FileName),
                MimeType = document.MimeType,
                Size = document.Size,
                StoragePath = document.StoragePath,
                CurrentVersion = 1,
                CreatedAt = document.CreatedAt,
                CreatedByUserId = currentUser.UserId
            };

            driveItem.Versions.Add(new DriveFileVersion
            {
                DriveItemId = driveItem.Id,
                Version = 1,
                StoragePath = document.StoragePath,
                Size = document.Size,
                Sha256 = sha256 ?? string.Empty,
                CreatedAt = document.CreatedAt,
                CreatedByUserId = currentUser.UserId
            });

            db.DriveItems.Add(driveItem);
            db.DriveActivityLogs.Add(new DriveActivityLog
            {
                DriveItemId = driveItem.Id,
                Action = "file.generated.quote"
            });
        }

        document.DriveItemId = driveItem.Id;
        await EnsureDocumentLinkAsync(driveItem.Id, document.QuoteId, cancellationToken);
    }

    public async Task<int> BackfillAsync(CancellationToken cancellationToken)
    {
        var documents = await db.QuoteDocuments
            .Where(x => x.DriveItemId == null)
            .OrderBy(x => x.CreatedAt)
            .Take(500)
            .ToListAsync(cancellationToken);
        if (documents.Count == 0)
        {
            return 0;
        }

        foreach (var document in documents)
        {
            await LinkAsync(document, null, cancellationToken);
        }

        await db.SaveChangesAsync(cancellationToken);
        return documents.Count;
    }

    private async Task<DriveItem?> FindExistingDriveItemAsync(QuoteDocument document, CancellationToken cancellationToken)
    {
        if (document.DriveItemId.HasValue)
        {
            var linked = await db.DriveItems.FirstOrDefaultAsync(x => x.Id == document.DriveItemId.Value, cancellationToken);
            if (linked is not null)
            {
                return linked;
            }
        }

        if (string.IsNullOrWhiteSpace(document.StoragePath))
        {
            return null;
        }

        return await db.DriveItems.FirstOrDefaultAsync(x => x.StoragePath == document.StoragePath, cancellationToken);
    }

    private async Task<Guid> EnsureQuoteFolderAsync(CancellationToken cancellationToken)
    {
        var folder = await db.DriveFolders
            .FirstOrDefaultAsync(x => x.ParentFolderId == null && x.Name == QuoteFolderName && !x.IsTrashed, cancellationToken);
        if (folder is not null)
        {
            return folder.Id;
        }

        folder = new DriveFolder
        {
            Name = QuoteFolderName,
            CreatedByUserId = currentUser.UserId
        };
        db.DriveFolders.Add(folder);
        db.DriveActivityLogs.Add(new DriveActivityLog { FolderId = folder.Id, Action = "folder.generated.quotes" });
        return folder.Id;
    }

    private async Task EnsureDocumentLinkAsync(Guid driveItemId, Guid quoteId, CancellationToken cancellationToken)
    {
        var exists = await db.DocumentLinks.AnyAsync(
            x => x.DriveItemId == driveItemId && x.Module == QuoteModule && x.EntityId == quoteId,
            cancellationToken);
        if (exists)
        {
            return;
        }

        db.DocumentLinks.Add(new DocumentLink
        {
            DriveItemId = driveItemId,
            Module = QuoteModule,
            EntityId = quoteId
        });
        db.DriveActivityLogs.Add(new DriveActivityLog
        {
            DriveItemId = driveItemId,
            Action = "file.linked.quotes"
        });
    }
}
