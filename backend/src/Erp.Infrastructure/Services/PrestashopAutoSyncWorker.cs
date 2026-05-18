using Erp.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace Erp.Infrastructure.Services;

internal sealed class PrestashopAutoSyncWorker(
    IServiceProvider serviceProvider,
    ILogger<PrestashopAutoSyncWorker> logger) : BackgroundService
{
    private static readonly TimeSpan InitialDelay = TimeSpan.FromSeconds(10);
    private static readonly TimeSpan SyncInterval = TimeSpan.FromSeconds(30);

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        await DelaySafelyAsync(InitialDelay, stoppingToken);

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await SyncActiveConnectionsAsync(stoppingToken);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                break;
            }
            catch (Exception ex)
            {
                logger.LogWarning(ex, "Automatic PrestaShop synchronization failed.");
            }

            await DelaySafelyAsync(SyncInterval, stoppingToken);
        }
    }

    private async Task SyncActiveConnectionsAsync(CancellationToken cancellationToken)
    {
        var connectionIds = await GetConnectionIdsToSynchronizeAsync(cancellationToken);
        foreach (var connectionId in connectionIds)
        {
            await using var scope = serviceProvider.CreateAsyncScope();
            var executor = scope.ServiceProvider.GetRequiredService<PrestashopSyncExecutor>();
            var result = await executor.ExecuteConnectionAsync(connectionId, cancellationToken);
            if (string.Equals(result.Status, "Failed", StringComparison.OrdinalIgnoreCase))
            {
                logger.LogWarning("Automatic PrestaShop synchronization failed for {ConnectionId}: {Message}", connectionId, result.Message);
            }
        }
    }

    private async Task<IReadOnlyList<Guid>> GetConnectionIdsToSynchronizeAsync(CancellationToken cancellationToken)
    {
        await using var scope = serviceProvider.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<ErpDbContext>();
        var runningConnectionIds = await db.PrestashopSyncLogs
            .Where(x => x.Status == "Queued" || x.Status == "Running")
            .Select(x => x.PrestashopConnectionId)
            .Distinct()
            .ToListAsync(cancellationToken);

        return await db.PrestashopConnections
            .Where(x => x.IsActive && !runningConnectionIds.Contains(x.Id))
            .OrderBy(x => x.ShopUrl)
            .Select(x => x.Id)
            .ToListAsync(cancellationToken);
    }

    private static async Task DelaySafelyAsync(TimeSpan delay, CancellationToken cancellationToken)
    {
        try
        {
            await Task.Delay(delay, cancellationToken);
        }
        catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
        {
        }
    }
}
