using Erp.Application.Common;
using Erp.Application.Documents;
using Erp.Domain.Documents;
using Erp.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;

namespace Erp.Infrastructure.Services;

public sealed class OnlyOfficeService(
    ErpDbContext db,
    IFileStorageService fileStorageService,
    IHttpClientFactory httpClientFactory,
    IConfiguration configuration,
    ICurrentUserService currentUser) : IOnlyOfficeService
{
    private static readonly HashSet<string> WordFileTypes = new(StringComparer.OrdinalIgnoreCase) { "doc", "docx", "odt", "rtf", "txt" };
    private static readonly HashSet<string> CellFileTypes = new(StringComparer.OrdinalIgnoreCase) { "xls", "xlsx", "ods", "csv" };
    private static readonly HashSet<string> SlideFileTypes = new(StringComparer.OrdinalIgnoreCase) { "ppt", "pptx", "odp" };

    public async Task<Result<OnlyOfficeConfigDto>> GetConfigAsync(Guid driveItemId, Uri requestBaseUri, CancellationToken cancellationToken)
    {
        var item = await db.DriveItems.AsNoTracking().FirstOrDefaultAsync(x => x.Id == driveItemId && !x.IsTrashed, cancellationToken);
        if (item is null)
        {
            return Result<OnlyOfficeConfigDto>.Failure("Document Drive introuvable.");
        }

        var fileType = Path.GetExtension(item.Name).TrimStart('.').ToLowerInvariant();
        var documentType = GetDocumentType(fileType);
        if (documentType is null)
        {
            return Result<OnlyOfficeConfigDto>.Failure("Ce type de fichier n'est pas pris en charge par ONLYOFFICE.");
        }

        var documentServerUrl = configuration["OnlyOffice:DocumentServerUrl"]?.TrimEnd('/') ?? "/onlyoffice";
        var publicBaseUrl = configuration["App:PublicBaseUrl"]?.TrimEnd('/') ?? requestBaseUri.ToString().TrimEnd('/');
        var userId = currentUser.UserId?.ToString() ?? "anonymous";
        var userName = currentUser.Email ?? "OceanERP";
        var key = $"{item.Id:N}-{item.CurrentVersion}-{item.Size}".Replace("-", string.Empty, StringComparison.Ordinal);

        var config = new OnlyOfficeConfigDto(
            documentServerUrl,
            documentType,
            "desktop",
            new OnlyOfficeDocumentDto(
                fileType,
                key,
                item.Name,
                $"{publicBaseUrl}/api/drive/files/{item.Id}/download"),
            new OnlyOfficeEditorConfigDto(
                "edit",
                $"{publicBaseUrl}/api/onlyoffice/files/{item.Id}/callback",
                new OnlyOfficeUserDto(userId, userName)));

        return Result<OnlyOfficeConfigDto>.Success(config);
    }

    public async Task<Result> HandleCallbackAsync(Guid driveItemId, OnlyOfficeCallbackRequest request, CancellationToken cancellationToken)
    {
        // ONLYOFFICE status 2/6 means the editor has a ready-to-save document URL.
        if (request.Status is not (2 or 6))
        {
            return Result.Success();
        }

        if (string.IsNullOrWhiteSpace(request.Url))
        {
            return Result.Failure("Callback ONLYOFFICE sans URL de sauvegarde.");
        }

        var item = await db.DriveItems.FirstOrDefaultAsync(x => x.Id == driveItemId && !x.IsTrashed, cancellationToken);
        if (item is null)
        {
            return Result.Failure("Document Drive introuvable.");
        }

        var client = httpClientFactory.CreateClient();
        await using var source = await client.GetStreamAsync(request.Url, cancellationToken);
        var stored = await fileStorageService.SaveAsync("drive", item.Name, source, cancellationToken);

        item.CurrentVersion += 1;
        item.StoragePath = stored.StoragePath;
        item.Size = stored.Size;

        db.DriveFileVersions.Add(new DriveFileVersion
        {
            DriveItemId = item.Id,
            Version = item.CurrentVersion,
            StoragePath = stored.StoragePath,
            Size = stored.Size,
            Sha256 = stored.Sha256,
            CreatedByUserId = currentUser.UserId
        });
        db.DriveActivityLogs.Add(new DriveActivityLog
        {
            DriveItemId = item.Id,
            UserId = currentUser.UserId,
            Action = "file.onlyoffice.saved"
        });

        await db.SaveChangesAsync(cancellationToken);
        return Result.Success();
    }

    private static string? GetDocumentType(string fileType)
    {
        if (WordFileTypes.Contains(fileType))
        {
            return "word";
        }

        if (CellFileTypes.Contains(fileType))
        {
            return "cell";
        }

        if (SlideFileTypes.Contains(fileType))
        {
            return "slide";
        }

        return null;
    }
}
