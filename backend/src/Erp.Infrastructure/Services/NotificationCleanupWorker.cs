using Erp.Application.Notifications;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace Erp.Infrastructure.Services;

public sealed class NotificationCleanupWorker(IServiceScopeFactory scopeFactory, ILogger<NotificationCleanupWorker> logger) : BackgroundService
{
    private static readonly TimeSpan Retention = TimeSpan.FromDays(7);
    private static readonly TimeSpan Interval = TimeSpan.FromHours(12);

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        await RunCleanupAsync(stoppingToken);

        using var timer = new PeriodicTimer(Interval);
        try
        {
            while (await timer.WaitForNextTickAsync(stoppingToken))
            {
                await RunCleanupAsync(stoppingToken);
            }
        }
        catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
        {
        }
    }

    private async Task RunCleanupAsync(CancellationToken cancellationToken)
    {
        try
        {
            using var scope = scopeFactory.CreateScope();
            var notifications = scope.ServiceProvider.GetRequiredService<INotificationService>();
            var deleted = await notifications.DeleteReadOlderThanAsync(Retention, cancellationToken);
            if (deleted > 0)
            {
                logger.LogInformation("Deleted {Count} read notifications older than {RetentionDays} days.", deleted, Retention.TotalDays);
            }
        }
        catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
        {
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Notification cleanup failed.");
        }
    }
}
