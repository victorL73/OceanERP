using Erp.Application.Common;
using Erp.Application.Documents;
using Erp.Application.Quotes;
using Erp.Domain.FutureModules;
using Erp.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Erp.Infrastructure.Services;

public sealed class QuoteSettingsService(ErpDbContext db, IFileStorageService fileStorageService, ICurrentUserService currentUser) : IQuoteSettingsService
{
    private static readonly HashSet<string> AllowedLogoMimeTypes = ["image/png", "image/jpeg", "image/webp"];
    private const long MaxLogoSize = 2 * 1024 * 1024;

    public async Task<QuoteSettingsDto> GetAsync(CancellationToken cancellationToken)
    {
        var settings = await LoadSettingsAsync(cancellationToken);
        return await MapAsync(settings, cancellationToken);
    }

    public async Task<Result<QuoteSettingsDto>> UpdateAsync(UpdateQuoteSettingsRequest request, CancellationToken cancellationToken)
    {
        if (!await IsAdministratorAsync(cancellationToken))
        {
            return Result<QuoteSettingsDto>.Failure("Seul un administrateur peut modifier la personnalisation des devis.");
        }

        if (string.IsNullOrWhiteSpace(request.CompanyName))
        {
            return Result<QuoteSettingsDto>.Failure("Le nom de l'entreprise est obligatoire.");
        }

        var settings = await LoadSettingsAsync(cancellationToken);
        settings.CompanyName = NormalizeRequired(request.CompanyName, 240);
        settings.AddressLine1 = Normalize(request.AddressLine1, 240);
        settings.AddressLine2 = Normalize(request.AddressLine2, 240);
        settings.PostalCode = Normalize(request.PostalCode, 40);
        settings.City = Normalize(request.City, 120);
        settings.Country = Normalize(request.Country, 120);
        settings.Phone = Normalize(request.Phone, 80);
        settings.Email = Normalize(request.Email, 320);
        settings.Website = Normalize(request.Website, 240);
        settings.VatNumber = Normalize(request.VatNumber, 80);
        settings.Siret = Normalize(request.Siret, 80);
        settings.LegalText = Normalize(request.LegalText, 2000);
        settings.FooterText = Normalize(request.FooterText, 2000);

        await db.SaveChangesAsync(cancellationToken);
        return Result<QuoteSettingsDto>.Success(await MapAsync(settings, cancellationToken));
    }

    public async Task<Result<QuoteSettingsDto>> UploadLogoAsync(string fileName, string mimeType, Stream content, long size, CancellationToken cancellationToken)
    {
        if (!await IsAdministratorAsync(cancellationToken))
        {
            return Result<QuoteSettingsDto>.Failure("Seul un administrateur peut modifier le logo des devis.");
        }

        if (!AllowedLogoMimeTypes.Contains(mimeType))
        {
            return Result<QuoteSettingsDto>.Failure("Logo invalide. Formats acceptes: PNG, JPEG ou WebP.");
        }

        if (size <= 0 || size > MaxLogoSize)
        {
            return Result<QuoteSettingsDto>.Failure("Le logo doit peser moins de 2 Mo.");
        }

        var settings = await LoadSettingsAsync(cancellationToken);
        var previousLogoPath = settings.LogoStoragePath;
        var stored = await fileStorageService.SaveAsync("quote-settings", fileName, content, cancellationToken);
        settings.LogoStoragePath = stored.StoragePath;
        settings.LogoFileName = Normalize(fileName, 260);
        settings.LogoMimeType = mimeType;
        settings.LogoSize = stored.Size;
        await db.SaveChangesAsync(cancellationToken);

        if (!string.IsNullOrWhiteSpace(previousLogoPath))
        {
            await fileStorageService.DeleteAsync(previousLogoPath, cancellationToken);
        }

        return Result<QuoteSettingsDto>.Success(await MapAsync(settings, cancellationToken));
    }

    public async Task<Result<QuoteSettingsDto>> DeleteLogoAsync(CancellationToken cancellationToken)
    {
        if (!await IsAdministratorAsync(cancellationToken))
        {
            return Result<QuoteSettingsDto>.Failure("Seul un administrateur peut supprimer le logo des devis.");
        }

        var settings = await LoadSettingsAsync(cancellationToken);
        var logoPath = settings.LogoStoragePath;
        settings.LogoStoragePath = null;
        settings.LogoFileName = null;
        settings.LogoMimeType = null;
        settings.LogoSize = null;
        await db.SaveChangesAsync(cancellationToken);

        if (!string.IsNullOrWhiteSpace(logoPath))
        {
            await fileStorageService.DeleteAsync(logoPath, cancellationToken);
        }

        return Result<QuoteSettingsDto>.Success(await MapAsync(settings, cancellationToken));
    }

    private async Task<QuoteDocumentSettings> LoadSettingsAsync(CancellationToken cancellationToken)
    {
        var settings = await db.QuoteDocumentSettings.OrderBy(x => x.CreatedAt).FirstOrDefaultAsync(cancellationToken);
        if (settings is not null)
        {
            return settings;
        }

        settings = new QuoteDocumentSettings();
        db.QuoteDocumentSettings.Add(settings);
        await db.SaveChangesAsync(cancellationToken);
        return settings;
    }

    private async Task<QuoteSettingsDto> MapAsync(QuoteDocumentSettings settings, CancellationToken cancellationToken)
    {
        string? logoDataUrl = null;
        if (!string.IsNullOrWhiteSpace(settings.LogoStoragePath) && !string.IsNullOrWhiteSpace(settings.LogoMimeType) && settings.LogoSize is > 0 and <= MaxLogoSize)
        {
            try
            {
                await using var logo = await fileStorageService.OpenReadAsync(settings.LogoStoragePath, cancellationToken);
                await using var memory = new MemoryStream();
                await logo.CopyToAsync(memory, cancellationToken);
                logoDataUrl = $"data:{settings.LogoMimeType};base64,{Convert.ToBase64String(memory.ToArray())}";
            }
            catch
            {
                logoDataUrl = null;
            }
        }

        return new QuoteSettingsDto(
            settings.Id,
            settings.CompanyName,
            settings.AddressLine1,
            settings.AddressLine2,
            settings.PostalCode,
            settings.City,
            settings.Country,
            settings.Phone,
            settings.Email,
            settings.Website,
            settings.VatNumber,
            settings.Siret,
            settings.LegalText,
            settings.FooterText,
            settings.LogoFileName,
            settings.LogoMimeType,
            settings.LogoSize,
            logoDataUrl,
            !string.IsNullOrWhiteSpace(settings.LogoStoragePath));
    }

    private async Task<bool> IsAdministratorAsync(CancellationToken cancellationToken)
        => currentUser.UserId is { } userId
            && await db.UserRoles.AnyAsync(userRole => userRole.UserId == userId && db.Roles.Any(role => role.Id == userRole.RoleId && role.Name == "Administrator"), cancellationToken);

    private static string NormalizeRequired(string value, int maxLength)
    {
        var trimmed = value.Trim();
        return trimmed.Length <= maxLength ? trimmed : trimmed[..maxLength];
    }

    private static string? Normalize(string? value, int maxLength)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            return null;
        }

        var trimmed = value.Trim();
        return trimmed.Length <= maxLength ? trimmed : trimmed[..maxLength];
    }
}
