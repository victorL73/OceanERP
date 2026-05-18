using Erp.Application.Notifications;
using Erp.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Erp.Api.Services;

public sealed class CalendarReminderWorker(
    IServiceProvider serviceProvider,
    ILogger<CalendarReminderWorker> logger) : BackgroundService
{
    private static readonly TimeSpan InitialDelay = TimeSpan.FromSeconds(10);
    private static readonly TimeSpan PollDelay = TimeSpan.FromSeconds(30);

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        await DelaySafelyAsync(InitialDelay, stoppingToken);

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await PublishDueRemindersAsync(stoppingToken);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                break;
            }
            catch (Exception ex)
            {
                logger.LogWarning(ex, "Calendar reminder notification check failed.");
            }

            await DelaySafelyAsync(PollDelay, stoppingToken);
        }
    }

    private async Task PublishDueRemindersAsync(CancellationToken cancellationToken)
    {
        await using var scope = serviceProvider.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<ErpDbContext>();
        var publisher = scope.ServiceProvider.GetRequiredService<IRealtimeNotificationPublisher>();
        var now = DateTimeOffset.UtcNow;

        var reminders = await db.CalendarReminders
            .Where(x => !x.IsSent && x.RemindAt <= now)
            .OrderBy(x => x.RemindAt)
            .Take(50)
            .ToListAsync(cancellationToken);
        if (reminders.Count == 0)
        {
            return;
        }

        var eventIds = reminders.Select(x => x.CalendarEventId).Distinct().ToList();
        var events = await db.CalendarEvents
            .Where(x => eventIds.Contains(x.Id))
            .ToDictionaryAsync(x => x.Id, cancellationToken);

        foreach (var reminder in reminders)
        {
            if (!events.TryGetValue(reminder.CalendarEventId, out var calendarEvent))
            {
                reminder.IsSent = true;
                continue;
            }

            var start = calendarEvent.StartsAt.ToLocalTime().ToString("dd/MM/yyyy HH:mm");
            var location = string.IsNullOrWhiteSpace(calendarEvent.Location) ? string.Empty : $" - {calendarEvent.Location}";
            await publisher.PublishAsync(
                new CreateNotificationRequest(
                    calendarEvent.IsPrivate ? calendarEvent.CreatedByUserId : null,
                    "calendar.reminder",
                    "Rappel agenda",
                    $"{calendarEvent.Title} le {start}{location}",
                    "/calendar"),
                cancellationToken);

            reminder.IsSent = true;
        }

        await db.SaveChangesAsync(cancellationToken);
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
