using Erp.Domain.Common;

namespace Erp.Domain.Notifications;

public sealed class NotificationPreference : Entity
{
    public Guid UserId { get; set; }
    public string NotificationType { get; set; } = string.Empty;
    public bool InAppEnabled { get; set; } = true;
    public bool BrowserEnabled { get; set; } = true;
    public bool EmailEnabled { get; set; }
    public bool DesktopEnabled { get; set; } = true;
}

