using Erp.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace Erp.Infrastructure.Services;

internal sealed class PrestashopSyncWorker(
    IServiceProvider serviceProvider,
    IPrestashopSyncQueue queue,
    ILogger<PrestashopSyncWorker> logger) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        await RecoverPendingLogsAsync(stoppingToken);

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                var logId = await queue.DequeueAsync(stoppingToken);
                await ProcessAsync(logId, stoppingToken);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                break;
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "Unhandled PrestaShop sync worker error.");
            }
        }
    }

    private async Task RecoverPendingLogsAsync(CancellationToken cancellationToken)
    {
        using var scope = serviceProvider.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ErpDbContext>();
        var pendingLogIds = await db.PrestashopSyncLogs
            .Where(x => x.Status == "Queued" || x.Status == "Running")
            .OrderBy(x => x.CreatedAt)
            .Select(x => x.Id)
            .ToListAsync(cancellationToken);

        foreach (var logId in pendingLogIds)
        {
            await ProcessAsync(logId, cancellationToken);
        }
    }

    private async Task ProcessAsync(Guid logId, CancellationToken cancellationToken)
    {
        using var scope = serviceProvider.CreateScope();
        var executor = scope.ServiceProvider.GetRequiredService<PrestashopSyncExecutor>();
        await executor.ExecuteAsync(logId, cancellationToken);
    }
}
