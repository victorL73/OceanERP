using Erp.Application.Common;
using Erp.Application.Prestashop;
using Erp.Domain.FutureModules;
using Erp.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Erp.Infrastructure.Services;

public sealed class PrestashopService(ErpDbContext db) : IPrestashopService
{
    public async Task<IReadOnlyList<PrestashopConnectionDto>> GetConnectionsAsync(CancellationToken cancellationToken)
        => await db.PrestashopConnections.OrderBy(x => x.ShopUrl).Select(x => new PrestashopConnectionDto(x.Id, x.ShopUrl, x.ApiKeySecretName, x.IsActive)).ToListAsync(cancellationToken);

    public async Task<Result<PrestashopConnectionDto>> CreateConnectionAsync(CreatePrestashopConnectionRequest request, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.ShopUrl))
        {
            return Result<PrestashopConnectionDto>.Failure("Shop URL is required.");
        }

        var connection = new PrestashopConnection { ShopUrl = request.ShopUrl.Trim(), ApiKeySecretName = request.ApiKeySecretName.Trim(), IsActive = true };
        db.PrestashopConnections.Add(connection);
        await db.SaveChangesAsync(cancellationToken);
        return Result<PrestashopConnectionDto>.Success(new PrestashopConnectionDto(connection.Id, connection.ShopUrl, connection.ApiKeySecretName, connection.IsActive));
    }

    public async Task<IReadOnlyList<PrestashopSyncLogDto>> GetLogsAsync(CancellationToken cancellationToken)
        => await db.PrestashopSyncLogs.OrderByDescending(x => x.CreatedAt).Take(100)
            .Select(x => new PrestashopSyncLogDto(x.Id, x.PrestashopConnectionId, x.Status, x.CreatedAt))
            .ToListAsync(cancellationToken);

    public async Task<Result<PrestashopSyncLogDto>> RunManualSyncAsync(Guid connectionId, CancellationToken cancellationToken)
    {
        if (!await db.PrestashopConnections.AnyAsync(x => x.Id == connectionId, cancellationToken))
        {
            return Result<PrestashopSyncLogDto>.Failure("PrestaShop connection not found.");
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
}

