using Erp.Api.Hubs;
using Erp.Application.Notifications;
using Microsoft.AspNetCore.SignalR;

namespace Erp.Api.Services;

public interface IRealtimeNotificationPublisher
{
    Task<NotificationDto?> PublishAsync(CreateNotificationRequest request, CancellationToken cancellationToken);
}

public sealed class RealtimeNotificationPublisher(
    INotificationService notifications,
    IHubContext<NotificationHub> hubContext) : IRealtimeNotificationPublisher
{
    public async Task<NotificationDto?> PublishAsync(CreateNotificationRequest request, CancellationToken cancellationToken)
    {
        var result = await notifications.CreateAsync(request, cancellationToken);
        if (!result.Succeeded || result.Value is null)
        {
            return null;
        }

        if (result.Value.UserId is Guid userId)
        {
            await hubContext.Clients.Group($"user:{userId}").SendAsync("notificationCreated", result.Value, cancellationToken);
        }
        else
        {
            await hubContext.Clients.All.SendAsync("notificationCreated", result.Value, cancellationToken);
        }

        return result.Value;
    }
}
