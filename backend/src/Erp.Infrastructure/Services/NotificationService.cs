using Erp.Application.Common;
using Erp.Application.Notifications;
using Erp.Domain.Notifications;
using Erp.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Erp.Infrastructure.Services;

public sealed class NotificationService(ErpDbContext db) : INotificationService
{
    private static readonly HashSet<string> RecurrentNotificationTypes = new(StringComparer.OrdinalIgnoreCase)
    {
        "emails.new",
        "stock.low.summary"
    };

    public async Task<IReadOnlyList<NotificationDto>> GetMineAsync(Guid? userId, CancellationToken cancellationToken)
    {
        var items = await db.Notifications
            .Where(x => x.UserId == userId || x.UserId == null)
            .OrderByDescending(x => x.CreatedAt)
            .Take(200)
            .ToListAsync(cancellationToken);

        var seenRecurringKeys = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        return items
            .Where(item => !IsRecurrent(item.Type) || seenRecurringKeys.Add(RecurringKey(item)))
            .Take(50)
            .Select(Map)
            .ToList();
    }

    public async Task<Result<NotificationDto>> CreateAsync(CreateNotificationRequest request, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.Title))
        {
            return Result<NotificationDto>.Failure("Notification title is required.");
        }

        if (IsRecurrent(request.Type))
        {
            var existing = await db.Notifications
                .Where(x => x.Type == request.Type && x.UserId == request.UserId)
                .OrderByDescending(x => x.CreatedAt)
                .FirstOrDefaultAsync(cancellationToken);

            if (existing is not null)
            {
                existing.Title = request.Title;
                existing.Message = request.Message;
                existing.LinkUrl = request.LinkUrl;
                existing.IsRead = false;
                existing.CreatedAt = DateTimeOffset.UtcNow;
                await db.SaveChangesAsync(cancellationToken);
                return Result<NotificationDto>.Success(Map(existing));
            }
        }

        var notification = new Notification
        {
            UserId = request.UserId,
            Type = request.Type,
            Title = request.Title,
            Message = request.Message,
            LinkUrl = request.LinkUrl
        };

        db.Notifications.Add(notification);
        await db.SaveChangesAsync(cancellationToken);
        return Result<NotificationDto>.Success(Map(notification));
    }

    public async Task<Result> MarkReadAsync(Guid id, Guid? userId, CancellationToken cancellationToken)
    {
        var notification = await db.Notifications.FirstOrDefaultAsync(x => x.Id == id && (x.UserId == userId || x.UserId == null), cancellationToken);
        if (notification is null)
        {
            return Result.Failure("Notification not found.");
        }

        notification.IsRead = true;
        await db.SaveChangesAsync(cancellationToken);
        return Result.Success();
    }

    private static NotificationDto Map(Notification notification)
        => new(notification.Id, notification.UserId, notification.Type, notification.Title, notification.Message, notification.LinkUrl, notification.IsRead, notification.CreatedAt);

    private static bool IsRecurrent(string type)
        => RecurrentNotificationTypes.Contains(type);

    private static string RecurringKey(Notification notification)
        => $"{notification.Type}:{notification.UserId?.ToString() ?? "all"}";
}
