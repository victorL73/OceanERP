using Erp.Application.Common;
using Erp.Application.Prestashop;
using Erp.Domain.FutureModules;
using Erp.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;

namespace Erp.Infrastructure.Services;

public sealed class PrestashopService(ErpDbContext db, IConfiguration configuration, IPrestashopSyncQueue queue) : IPrestashopService
{
    private const string DefaultPrestashopWarehouseName = "Entrepot principal";

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
            ColissimoLabelEndpointTemplate = NormalizeOptional(request.ColissimoLabelEndpointTemplate),
            IsActive = true,
            WarehouseId = request.WarehouseId ?? await GetOrCreateDefaultPrestashopWarehouseIdAsync(cancellationToken)
        };
        var warehouseValidation = await ValidateWarehouseAsync(connection.WarehouseId, cancellationToken);
        if (!warehouseValidation.Succeeded)
        {
            return Result<PrestashopConnectionDto>.Failure(warehouseValidation.Error!);
        }

        SetApiKey(connection, request.ApiKey, clearApiKey: false);
        SetProtectedSecret(
            value => connection.ColissimoBridgeTokenProtectedValue = value,
            request.ColissimoBridgeToken,
            clearSecret: false);
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
        connection.ColissimoLabelEndpointTemplate = NormalizeOptional(request.ColissimoLabelEndpointTemplate);
        connection.IsActive = request.IsActive;
        connection.WarehouseId = request.WarehouseId ?? await GetOrCreateDefaultPrestashopWarehouseIdAsync(cancellationToken);
        var warehouseValidation = await ValidateWarehouseAsync(connection.WarehouseId, cancellationToken);
        if (!warehouseValidation.Succeeded)
        {
            return Result<PrestashopConnectionDto>.Failure(warehouseValidation.Error!);
        }

        SetApiKey(connection, request.ApiKey, request.ClearApiKey);
        SetProtectedSecret(
            value => connection.ColissimoBridgeTokenProtectedValue = value,
            request.ColissimoBridgeToken,
            request.ClearColissimoBridgeToken);

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
        if (!HasApiKey(connection))
        {
            return Result<PrestashopSyncLogDto>.Failure("PrestaShop API key is not configured.");
        }

        var log = new PrestashopSyncLog
        {
            PrestashopConnectionId = connectionId,
            Status = "Queued",
            Message = "Synchronisation ajoutee a la file."
        };
        db.PrestashopSyncLogs.Add(log);
        await db.SaveChangesAsync(cancellationToken);
        await queue.EnqueueAsync(log.Id, cancellationToken);
        return Result<PrestashopSyncLogDto>.Success(MapLog(log));
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
    {
        var normalized = shopUrl.Trim().TrimEnd('/');
        return normalized.EndsWith("/api", StringComparison.OrdinalIgnoreCase)
            ? normalized[..^4]
            : normalized;
    }

    private async Task<Result> ValidateWarehouseAsync(Guid? warehouseId, CancellationToken cancellationToken)
    {
        if (!warehouseId.HasValue)
        {
            return Result.Success();
        }

        if (db.Warehouses.Local.Any(x => x.Id == warehouseId.Value))
        {
            return Result.Success();
        }

        return await db.Warehouses.AnyAsync(x => x.Id == warehouseId.Value, cancellationToken)
            ? Result.Success()
            : Result.Failure("Warehouse not found.");
    }

    private async Task<Guid> GetOrCreateDefaultPrestashopWarehouseIdAsync(CancellationToken cancellationToken)
    {
        var warehouse = await db.Warehouses.FirstOrDefaultAsync(x => x.Name == DefaultPrestashopWarehouseName, cancellationToken);
        if (warehouse is null)
        {
            warehouse = new Warehouse { Name = DefaultPrestashopWarehouseName };
            db.Warehouses.Add(warehouse);
        }

        return warehouse.Id;
    }

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

        connection.ApiKeyProtectedValue = PrestashopSecretProtector.ProtectSecret(configuration, apiKey.Trim());
        connection.ApiKeySecretName = "DATABASE_PROTECTED";
    }

    private void SetProtectedSecret(Action<string?> assignProtectedValue, string? secret, bool clearSecret)
    {
        if (clearSecret)
        {
            assignProtectedValue(null);
            return;
        }

        if (string.IsNullOrWhiteSpace(secret))
        {
            return;
        }

        assignProtectedValue(PrestashopSecretProtector.ProtectSecret(configuration, secret.Trim()));
    }

    private static string? NormalizeOptional(string? value)
        => string.IsNullOrWhiteSpace(value) ? null : value.Trim();

    private static bool HasApiKey(PrestashopConnection connection)
        => !string.IsNullOrWhiteSpace(connection.ApiKeyProtectedValue) || !string.IsNullOrWhiteSpace(connection.ApiKeySecretName);

    private static bool HasColissimoBridgeToken(PrestashopConnection connection)
        => !string.IsNullOrWhiteSpace(connection.ColissimoBridgeTokenProtectedValue);

    private static PrestashopConnectionDto MapConnection(PrestashopConnection connection)
        => new(
            connection.Id,
            connection.ShopUrl,
            connection.ApiKeySecretName,
            HasApiKey(connection),
            connection.IsActive,
            connection.WarehouseId,
            connection.ColissimoLabelEndpointTemplate,
            HasColissimoBridgeToken(connection));

    private static PrestashopSyncLogDto MapLog(PrestashopSyncLog log)
        => new(log.Id, log.PrestashopConnectionId, log.Status, log.Message, log.CreatedAt, log.StartedAt, log.CompletedAt);
}
