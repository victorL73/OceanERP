using Erp.Application.Common;
using Erp.Application.Prestashop;
using Erp.Domain.FutureModules;
using Erp.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using System.Security.Cryptography;
using System.Text;

namespace Erp.Infrastructure.Services;

public sealed class PrestashopService(ErpDbContext db, IConfiguration configuration) : IPrestashopService
{
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
            .Select(x => new PrestashopSyncLogDto(x.Id, x.PrestashopConnectionId, x.Status, x.CreatedAt))
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
        if (!HasApiKey(connection))
        {
            return Result<PrestashopSyncLogDto>.Failure("PrestaShop API key is not configured.");
        }

        var log = new PrestashopSyncLog
        {
            PrestashopConnectionId = connectionId,
            Status = "Queued"
        };
        db.PrestashopSyncLogs.Add(log);
        await db.SaveChangesAsync(cancellationToken);
        return Result<PrestashopSyncLogDto>.Success(new PrestashopSyncLogDto(log.Id, log.PrestashopConnectionId, log.Status, log.CreatedAt));
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
        var key = SHA256.HashData(Encoding.UTF8.GetBytes(configuration["Secrets:EncryptionKey"] ?? configuration["Jwt:SigningKey"] ?? "OceanERP-development-secret-key"));
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

    private static bool HasApiKey(PrestashopConnection connection)
        => !string.IsNullOrWhiteSpace(connection.ApiKeyProtectedValue) || !string.IsNullOrWhiteSpace(connection.ApiKeySecretName);

    private static PrestashopConnectionDto MapConnection(PrestashopConnection connection)
        => new(connection.Id, connection.ShopUrl, connection.ApiKeySecretName, HasApiKey(connection), connection.IsActive);
}
