using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;
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
    private static readonly HashSet<string> WordFileTypes = new(StringComparer.OrdinalIgnoreCase) { "doc", "docx", "odt", "rtf" };
    private static readonly HashSet<string> CellFileTypes = new(StringComparer.OrdinalIgnoreCase) { "xls", "xlsx", "ods" };
    private static readonly HashSet<string> SlideFileTypes = new(StringComparer.OrdinalIgnoreCase) { "ppt", "pptx", "odp" };
    private static readonly JsonSerializerOptions JwtJsonOptions = new(JsonSerializerDefaults.Web)
    {
        DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull
    };

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

        var configuredDocumentServerUrl = configuration["OnlyOffice:DocumentServerUrl"];
        var documentServerUrl = string.IsNullOrWhiteSpace(configuredDocumentServerUrl)
            ? "/onlyoffice"
            : configuredDocumentServerUrl.TrimEnd('/');
        var configuredPublicBaseUrl = configuration["App:PublicBaseUrl"];
        var publicBaseUrl = string.IsNullOrWhiteSpace(configuredPublicBaseUrl)
            ? requestBaseUri.ToString().TrimEnd('/')
            : configuredPublicBaseUrl.TrimEnd('/');
        var configuredInternalBaseUrl = configuration["OnlyOffice:InternalBaseUrl"];
        var documentExchangeBaseUrl = string.IsNullOrWhiteSpace(configuredInternalBaseUrl)
            ? publicBaseUrl
            : configuredInternalBaseUrl.TrimEnd('/');
        var userId = currentUser.UserId?.ToString() ?? "anonymous";
        var userName = currentUser.Email ?? "OceanERP";
        var key = $"{item.Id:N}-{item.CurrentVersion}-{item.Size}".Replace("-", string.Empty, StringComparison.Ordinal);
        var accessToken = CreateDocumentToken(item.Id, item.CurrentVersion, DateTimeOffset.UtcNow.AddHours(8));
        var documentUrl = $"{documentExchangeBaseUrl}/api/onlyoffice/files/{item.Id}/download?token={Uri.EscapeDataString(accessToken)}";
        var callbackUrl = $"{documentExchangeBaseUrl}/api/onlyoffice/files/{item.Id}/callback?token={Uri.EscapeDataString(accessToken)}";
        var permissions = new OnlyOfficeDocumentPermissionsDto(Edit: true, Download: true, Print: true);
        var isCellDocument = string.Equals(documentType, "cell", StringComparison.OrdinalIgnoreCase);
        var customization = new OnlyOfficeCustomizationDto(
            Autosave: false,
            Forcesave: false,
            Chat: false,
            Comments: !isCellDocument,
            Plugins: false,
            Macros: false);
        var coEditing = new OnlyOfficeCoEditingDto(Mode: "strict", Change: false);
        var document = new OnlyOfficeDocumentDto(fileType, key, item.Name, documentUrl, permissions);
        var editorConfig = new OnlyOfficeEditorConfigDto("edit", callbackUrl, new OnlyOfficeUserDto(userId, userName), customization, coEditing);
        var jwtPayload = new
        {
            documentType,
            type = "desktop",
            document,
            editorConfig
        };
        var jwt = CreateOnlyOfficeJwt(jwtPayload);

        var config = new OnlyOfficeConfigDto(
            documentServerUrl,
            documentType,
            "desktop",
            document,
            editorConfig,
            jwt);

        return Result<OnlyOfficeConfigDto>.Success(config);
    }

    public async Task<Result<(Stream Content, string FileName, string MimeType)>> OpenDocumentAsync(Guid driveItemId, string? token, CancellationToken cancellationToken)
    {
        var item = await ValidateDocumentTokenAsync(driveItemId, token, allowPreviousVersion: true, cancellationToken);
        if (!item.Succeeded)
        {
            return Result<(Stream, string, string)>.Failure(item.Error!);
        }

        var stream = await fileStorageService.OpenReadAsync(item.Value!.StoragePath, cancellationToken);
        return Result<(Stream, string, string)>.Success((stream, item.Value.Name, item.Value.MimeType));
    }

    public async Task<Result> HandleCallbackAsync(Guid driveItemId, string? token, OnlyOfficeCallbackRequest request, CancellationToken cancellationToken)
    {
        var tokenValidation = await ValidateDocumentTokenAsync(driveItemId, token, allowPreviousVersion: true, cancellationToken);
        if (!tokenValidation.Succeeded)
        {
            return Result.Failure(tokenValidation.Error!);
        }

        // ONLYOFFICE status 2 is the final save. Status 6 is a manual/forced save.
        // Tableurs: the editor keeps using the same document key during the session, so the signed
        // download token intentionally remains valid for older versions until it expires.
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

    private async Task<Result<DriveItem>> ValidateDocumentTokenAsync(Guid driveItemId, string? token, bool allowPreviousVersion, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(token))
        {
            return Result<DriveItem>.Failure("Token ONLYOFFICE manquant.");
        }

        var parsed = ParseDocumentToken(token.Trim());
        if (!parsed.Succeeded)
        {
            return Result<DriveItem>.Failure(parsed.Error!);
        }

        var (tokenDriveItemId, version, expiresAt) = parsed.Value;
        if (tokenDriveItemId != driveItemId)
        {
            return Result<DriveItem>.Failure("Token ONLYOFFICE invalide.");
        }

        if (expiresAt <= DateTimeOffset.UtcNow)
        {
            return Result<DriveItem>.Failure("Token ONLYOFFICE expire.");
        }

        var item = await db.DriveItems.FirstOrDefaultAsync(x => x.Id == driveItemId && !x.IsTrashed, cancellationToken);
        if (item is null)
        {
            return Result<DriveItem>.Failure("Document Drive introuvable.");
        }

        if (version > item.CurrentVersion)
        {
            return Result<DriveItem>.Failure("Version ONLYOFFICE invalide.");
        }

        if (version != item.CurrentVersion && !allowPreviousVersion)
        {
            return Result<DriveItem>.Failure("Version ONLYOFFICE obsolete.");
        }

        return Result<DriveItem>.Success(item);
    }

    private string CreateDocumentToken(Guid driveItemId, int version, DateTimeOffset expiresAt)
    {
        var payload = $"{driveItemId:N}|{version}|{expiresAt.ToUnixTimeSeconds()}";
        var payloadBytes = Encoding.UTF8.GetBytes(payload);
        var signature = ComputeSignature(payloadBytes);
        return $"{Base64UrlEncode(payloadBytes)}.{Base64UrlEncode(signature)}";
    }

    private Result<(Guid DriveItemId, int Version, DateTimeOffset ExpiresAt)> ParseDocumentToken(string token)
    {
        var parts = token.Split('.', 2);
        if (parts.Length != 2)
        {
            return Result<(Guid, int, DateTimeOffset)>.Failure("Token ONLYOFFICE invalide.");
        }

        byte[] payloadBytes;
        byte[] providedSignature;
        try
        {
            payloadBytes = Base64UrlDecode(parts[0]);
            providedSignature = Base64UrlDecode(parts[1]);
        }
        catch (FormatException)
        {
            return Result<(Guid, int, DateTimeOffset)>.Failure("Token ONLYOFFICE invalide.");
        }

        var expectedSignature = ComputeSignature(payloadBytes);
        if (providedSignature.Length != expectedSignature.Length || !CryptographicOperations.FixedTimeEquals(providedSignature, expectedSignature))
        {
            return Result<(Guid, int, DateTimeOffset)>.Failure("Token ONLYOFFICE invalide.");
        }

        var payload = Encoding.UTF8.GetString(payloadBytes);
        var values = payload.Split('|');
        if (values.Length != 3
            || !Guid.TryParseExact(values[0], "N", out var driveItemId)
            || !int.TryParse(values[1], out var version)
            || !long.TryParse(values[2], out var expiresUnix))
        {
            return Result<(Guid, int, DateTimeOffset)>.Failure("Token ONLYOFFICE invalide.");
        }

        return Result<(Guid, int, DateTimeOffset)>.Success((driveItemId, version, DateTimeOffset.FromUnixTimeSeconds(expiresUnix)));
    }

    private byte[] ComputeSignature(byte[] payload)
    {
        var secret = configuration["OnlyOffice:CallbackSecret"]
            ?? configuration["Secrets:EncryptionKey"]
            ?? configuration["Jwt:SigningKey"]
            ?? "CHANGE_ME_OCEANERP_ONLYOFFICE_CALLBACK_SECRET_32_CHARS_MINIMUM";
        return HMACSHA256.HashData(Encoding.UTF8.GetBytes(secret), payload);
    }

    private string CreateOnlyOfficeJwt(object payload)
    {
        var header = JsonSerializer.Serialize(new { alg = "HS256", typ = "JWT" }, JwtJsonOptions);
        var body = JsonSerializer.Serialize(payload, JwtJsonOptions);
        var headerSegment = Base64UrlEncode(Encoding.UTF8.GetBytes(header));
        var bodySegment = Base64UrlEncode(Encoding.UTF8.GetBytes(body));
        var signature = ComputeSignature(Encoding.UTF8.GetBytes($"{headerSegment}.{bodySegment}"));
        return $"{headerSegment}.{bodySegment}.{Base64UrlEncode(signature)}";
    }

    private static string Base64UrlEncode(byte[] value)
        => Convert.ToBase64String(value).TrimEnd('=').Replace('+', '-').Replace('/', '_');

    private static byte[] Base64UrlDecode(string value)
    {
        var padded = value.Replace('-', '+').Replace('_', '/');
        padded = padded.PadRight(padded.Length + (4 - padded.Length % 4) % 4, '=');
        return Convert.FromBase64String(padded);
    }
}
