using Erp.Application.Common;

namespace Erp.Application.Notifications;

public interface INotificationService
{
    Task<IReadOnlyList<NotificationDto>> GetMineAsync(Guid? userId, CancellationToken cancellationToken);
    Task<Result<NotificationDto>> CreateAsync(CreateNotificationRequest request, CancellationToken cancellationToken);
    Task<Result> MarkReadAsync(Guid id, Guid? userId, CancellationToken cancellationToken);
}

