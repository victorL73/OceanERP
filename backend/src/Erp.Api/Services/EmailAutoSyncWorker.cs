using Erp.Application.Emails;
using Erp.Application.Notifications;

namespace Erp.Api.Services;

public sealed class EmailAutoSyncWorker(
    IServiceProvider serviceProvider,
    ILogger<EmailAutoSyncWorker> logger) : BackgroundService
{
    private const int SyncLimit = 100;
    private static readonly TimeSpan FastSyncDelay = TimeSpan.FromSeconds(15);

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        await DelaySafelyAsync(TimeSpan.FromSeconds(5), stoppingToken);

        while (!stoppingToken.IsCancellationRequested)
        {
            var delay = TimeSpan.FromMinutes(5);
            try
            {
                delay = await SyncOnceAsync(stoppingToken);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                break;
            }
            catch (Exception ex)
            {
                logger.LogWarning(ex, "Automatic IMAP synchronization failed.");
            }

            await DelaySafelyAsync(delay, stoppingToken);
        }
    }

    private async Task<TimeSpan> SyncOnceAsync(CancellationToken cancellationToken)
    {
        await using var scope = serviceProvider.CreateAsyncScope();
        var emails = scope.ServiceProvider.GetRequiredService<IEmailService>();
        var settings = await emails.GetServerSettingsAsync(cancellationToken);
        var delay = ResolveDelay(settings.ImapSyncIntervalMinutes);

        if (!settings.IsConfigured || !settings.ImapAutoSyncEnabled)
        {
            return delay;
        }

        var summary = await emails.SyncActiveImapAsync(SyncLimit, cancellationToken);
        if (summary.Imported > 0)
        {
            await NotifyImportedMessagesAsync(scope.ServiceProvider, summary, cancellationToken);
        }

        return delay;
    }

    private static TimeSpan ResolveDelay(int configuredMinutes)
        => configuredMinutes <= 0
            ? FastSyncDelay
            : TimeSpan.FromMinutes(Math.Clamp(configuredMinutes, 1, 1440));

    private static async Task NotifyImportedMessagesAsync(IServiceProvider services, EmailSyncSummaryDto summary, CancellationToken cancellationToken)
    {
        var publisher = services.GetRequiredService<IRealtimeNotificationPublisher>();
        foreach (var account in summary.Accounts.Where(x => x.Imported > 0))
        {
            var message = account.Imported == 1
                ? $"1 nouveau mail dans {account.Email}."
                : $"{account.Imported} nouveaux mails dans {account.Email}.";
            var linkUrl = $"/emails?search={Uri.EscapeDataString(account.Email)}";

            if (account.NotificationUserIds.Count == 0)
            {
                await publisher.PublishAsync(new CreateNotificationRequest(null, "emails.new", "Nouveaux emails", message, linkUrl), cancellationToken);
                continue;
            }

            foreach (var userId in account.NotificationUserIds)
            {
                await publisher.PublishAsync(new CreateNotificationRequest(userId, "emails.new", "Nouveaux emails", message, linkUrl), cancellationToken);
            }
        }
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
