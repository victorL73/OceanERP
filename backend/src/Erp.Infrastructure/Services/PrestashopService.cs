using Erp.Application.Common;
using Erp.Application.Prestashop;
using Erp.Domain.FutureModules;
using Erp.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using System.Net.Http.Headers;
using System.Security.Cryptography;
using System.Text;

namespace Erp.Infrastructure.Services;

public sealed class PrestashopService(ErpDbContext db, IConfiguration configuration, HttpClient httpClient) : IPrestashopService
{
    private static readonly string[] ProbeResources = ["products", "customers", "orders", "stock_availables"];

    public async Task<IReadOnlyList<PrestashopConnectionDto>> GetConnectionsAsync(CancellationToken cancellationToken)
    {
        var connections = await db.PrestashopConnections.OrderBy(x => x.ShopUrl).ToListAsync(cancellationToken);
        return connections.Select(MapConnection).ToList();
    }

    public async Task<Result<PrestashopConnectionDto>> CreateConnectionAsync(CreatePrestashopConnectionRequest request, CancellationToken cancellationToken)
    {
        var validation = ValidateShopUrl(request.ShopUrl);
        if (!validation.Succeeded)
        {
            return Result<PrestashopConnectionDto>.Failure(validation.Error!);
        }

        var connection = new PrestashopConnection
        {
            ShopUrl = NormalizeShopUrl(request.ShopUrl),
            IsActive = true
        };
        SetApiKey(connection, request.ApiKey, clearApiKey: false);
        db.PrestashopConnections.Add(connection);
        await db.SaveChangesAsync(cancellationToken);
        return Result<PrestashopConnectionDto>.Success(MapConnection(connection));
    }

    public async Task<Result<PrestashopConnectionDto>> UpdateConnectionAsync(Guid connectionId, UpdatePrestashopConnectionRequest request, CancellationToken cancellationToken)
    {
        var connection = await db.PrestashopConnections.FirstOrDefaultAsync(x => x.Id == connectionId, cancellationToken);
        if (connection is null)
        {
            return Result<PrestashopConnectionDto>.Failure("PrestaShop connection not found.");
        }

        var validation = ValidateShopUrl(request.ShopUrl);
        if (!validation.Succeeded)
        {
            return Result<PrestashopConnectionDto>.Failure(validation.Error!);
        }

        connection.ShopUrl = NormalizeShopUrl(request.ShopUrl);
        connection.IsActive = request.IsActive;
        SetApiKey(connection, request.ApiKey, request.ClearApiKey);

        await db.SaveChangesAsync(cancellationToken);
        return Result<PrestashopConnectionDto>.Success(MapConnection(connection));
    }

    public async Task<IReadOnlyList<PrestashopSyncLogDto>> GetLogsAsync(CancellationToken cancellationToken)
        => await db.PrestashopSyncLogs.OrderByDescending(x => x.CreatedAt).Take(100)
            .Select(x => new PrestashopSyncLogDto(x.Id, x.PrestashopConnectionId, x.Status, x.Message, x.CreatedAt, x.StartedAt, x.CompletedAt))
            .ToListAsync(cancellationToken);

    public async Task<Result<PrestashopSyncLogDto>> RunManualSyncAsync(Guid connectionId, CancellationToken cancellationToken)
    {
        var connection = await db.PrestashopConnections.FirstOrDefaultAsync(x => x.Id == connectionId, cancellationToken);
        if (connection is null)
        {
            return Result<PrestashopSyncLogDto>.Failure("PrestaShop connection not found.");
        }
        if (!connection.IsActive)
        {
            return Result<PrestashopSyncLogDto>.Failure("PrestaShop connection is inactive.");
        }
        var apiKeyResult = ResolveApiKey(connection);
        if (!apiKeyResult.Succeeded)
        {
            return Result<PrestashopSyncLogDto>.Failure(apiKeyResult.Error ?? "PrestaShop API key is not configured.");
        }

        var log = new PrestashopSyncLog
        {
            PrestashopConnectionId = connectionId,
            Status = "Running",
            Message = "Connexion a PrestaShop en cours.",
            StartedAt = DateTimeOffset.UtcNow
        };
        db.PrestashopSyncLogs.Add(log);
        await db.SaveChangesAsync(cancellationToken);

        try
        {
            var message = await ProbePrestashopAsync(connection, apiKeyResult.Value!, cancellationToken);
            log.Status = "Completed";
            log.Message = message;
        }
        catch (OperationCanceledException)
        {
            log.Status = "Failed";
            log.Message = "Synchronisation interrompue ou delai depasse.";
        }
        catch (Exception ex)
        {
            log.Status = "Failed";
            log.Message = ex.Message.Length > 1000 ? ex.Message[..1000] : ex.Message;
        }

        log.CompletedAt = DateTimeOffset.UtcNow;
        await db.SaveChangesAsync(cancellationToken);
        return Result<PrestashopSyncLogDto>.Success(MapLog(log));
    }

    private async Task<string> ProbePrestashopAsync(PrestashopConnection connection, string apiKey, CancellationToken cancellationToken)
    {
        httpClient.Timeout = TimeSpan.FromSeconds(30);
        httpClient.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue(
            "Basic",
            Convert.ToBase64String(Encoding.ASCII.GetBytes($"{apiKey}:")));

        await EnsureSuccessfulPrestashopRequestAsync($"{connection.ShopUrl}/api?output_format=JSON", "racine API", cancellationToken);

        var resourceStatuses = new List<string>();
        foreach (var resource in ProbeResources)
        {
            await EnsureSuccessfulPrestashopRequestAsync($"{connection.ShopUrl}/api/{resource}?display=[id]&limit=1&output_format=JSON", resource, cancellationToken);
            resourceStatuses.Add($"{resource}: OK");
        }

        return $"Connexion PrestaShop OK. {string.Join("; ", resourceStatuses)}.";
    }

    private async Task EnsureSuccessfulPrestashopRequestAsync(string url, string label, CancellationToken cancellationToken)
    {
        using var request = new HttpRequestMessage(HttpMethod.Get, url);
        request.Headers.Accept.Add(new MediaTypeWithQualityHeaderValue("application/json"));

        using var response = await httpClient.SendAsync(request, cancellationToken);
        if (response.IsSuccessStatusCode)
        {
            return;
        }

        var body = await response.Content.ReadAsStringAsync(cancellationToken);
        var detail = string.IsNullOrWhiteSpace(body) ? response.ReasonPhrase ?? response.StatusCode.ToString() : body.ReplaceLineEndings(" ");
        if (detail.Length > 240)
        {
            detail = detail[..240];
        }

        throw new InvalidOperationException($"PrestaShop {label}: HTTP {(int)response.StatusCode} {detail}");
    }

    private static Result ValidateShopUrl(string shopUrl)
    {
        if (string.IsNullOrWhiteSpace(shopUrl))
        {
            return Result.Failure("Shop URL is required.");
        }

        if (!Uri.TryCreate(shopUrl.Trim(), UriKind.Absolute, out var uri) || (uri.Scheme != Uri.UriSchemeHttp && uri.Scheme != Uri.UriSchemeHttps))
        {
            return Result.Failure("Shop URL must be a valid HTTP or HTTPS URL.");
        }

        return Result.Success();
    }

    private static string NormalizeShopUrl(string shopUrl)
        => shopUrl.Trim().TrimEnd('/');

    private void SetApiKey(PrestashopConnection connection, string? apiKey, bool clearApiKey)
    {
        if (clearApiKey)
        {
            connection.ApiKeyProtectedValue = null;
            connection.ApiKeySecretName = string.Empty;
            return;
        }

        if (string.IsNullOrWhiteSpace(apiKey))
        {
            return;
        }

        connection.ApiKeyProtectedValue = ProtectSecret(apiKey.Trim());
        connection.ApiKeySecretName = "DATABASE_PROTECTED";
    }

    private string ProtectSecret(string secret)
    {
        var key = GetEncryptionKey();
        var nonce = RandomNumberGenerator.GetBytes(12);
        var plaintext = Encoding.UTF8.GetBytes(secret);
        var ciphertext = new byte[plaintext.Length];
        var tag = new byte[16];

        using var aes = new AesGcm(key, tag.Length);
        aes.Encrypt(nonce, plaintext, ciphertext, tag);

        return string.Join('.',
            "v1",
            Convert.ToBase64String(nonce),
            Convert.ToBase64String(tag),
            Convert.ToBase64String(ciphertext));
    }

    private Result<string> ResolveApiKey(PrestashopConnection connection)
    {
        if (!string.IsNullOrWhiteSpace(connection.ApiKeyProtectedValue))
        {
            return UnprotectSecret(connection.ApiKeyProtectedValue);
        }

        if (!string.IsNullOrWhiteSpace(connection.ApiKeySecretName))
        {
            var secret = configuration[$"Secrets:{connection.ApiKeySecretName}"];
            return string.IsNullOrWhiteSpace(secret)
                ? Result<string>.Failure("PrestaShop API key is not configured.")
                : Result<string>.Success(secret);
        }

        return Result<string>.Failure("PrestaShop API key is not configured.");
    }

    private Result<string> UnprotectSecret(string protectedValue)
    {
        var parts = protectedValue.Split('.');
        if (parts.Length != 4 || parts[0] != "v1")
        {
            return Result<string>.Failure("Protected PrestaShop API key format is invalid.");
        }

        try
        {
            var key = GetEncryptionKey();
            var nonce = Convert.FromBase64String(parts[1]);
            var tag = Convert.FromBase64String(parts[2]);
            var ciphertext = Convert.FromBase64String(parts[3]);
            var plaintext = new byte[ciphertext.Length];

            using var aes = new AesGcm(key, tag.Length);
            aes.Decrypt(nonce, ciphertext, tag, plaintext);
            return Result<string>.Success(Encoding.UTF8.GetString(plaintext));
        }
        catch (CryptographicException)
        {
            return Result<string>.Failure("Protected PrestaShop API key cannot be decrypted. Check Secrets:EncryptionKey.");
        }
        catch (FormatException)
        {
            return Result<string>.Failure("Protected PrestaShop API key format is invalid.");
        }
    }

    private byte[] GetEncryptionKey()
        => SHA256.HashData(Encoding.UTF8.GetBytes(configuration["Secrets:EncryptionKey"] ?? configuration["Jwt:SigningKey"] ?? "OceanERP-development-secret-key"));

    private static bool HasApiKey(PrestashopConnection connection)
        => !string.IsNullOrWhiteSpace(connection.ApiKeyProtectedValue) || !string.IsNullOrWhiteSpace(connection.ApiKeySecretName);

    private static PrestashopConnectionDto MapConnection(PrestashopConnection connection)
        => new(connection.Id, connection.ShopUrl, connection.ApiKeySecretName, HasApiKey(connection), connection.IsActive);

    private static PrestashopSyncLogDto MapLog(PrestashopSyncLog log)
        => new(log.Id, log.PrestashopConnectionId, log.Status, log.Message, log.CreatedAt, log.StartedAt, log.CompletedAt);
}
