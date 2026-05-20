using Erp.Application.Backups;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace Erp.Infrastructure.Services;

public sealed class BackupScheduleWorker(IServiceScopeFactory scopeFactory, ILogger<BackupScheduleWorker> logger) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await RunIfDueAsync(stoppingToken);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                return;
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "Scheduled backup worker failed");
            }

            await Task.Delay(TimeSpan.FromMinutes(1), stoppingToken);
        }
    }

    private async Task RunIfDueAsync(CancellationToken cancellationToken)
    {
        await using var scope = scopeFactory.CreateAsyncScope();
        var backups = scope.ServiceProvider.GetRequiredService<IBackupService>();
        var now = DateTimeOffset.UtcNow;
        if (!await backups.IsScheduleDueAsync(now, cancellationToken))
        {
            return;
        }

        logger.LogInformation("Scheduled backup started");
        var result = await backups.CreateBackupAsync(cancellationToken);
        if (!result.Succeeded || result.Value is null || !result.Value.Succeeded)
        {
            var message = result.Error ?? result.Value?.Message ?? "Unknown scheduled backup error";
            logger.LogWarning("Scheduled backup failed: {Message}", message);
        }

        await backups.MarkScheduledRunAsync(DateTimeOffset.UtcNow, cancellationToken);
    }
}
