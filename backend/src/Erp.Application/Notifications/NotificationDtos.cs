namespace Erp.Application.Notifications;

public sealed record NotificationDto(Guid Id, Guid? UserId, string Type, string Title, string Message, string? LinkUrl, bool IsRead, DateTimeOffset? ReadAt, DateTimeOffset CreatedAt);
public sealed record CreateNotificationRequest(Guid? UserId, string Type, string Title, string Message, string? LinkUrl);
