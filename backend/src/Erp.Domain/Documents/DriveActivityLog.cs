using Erp.Domain.Common;

namespace Erp.Domain.Documents;

public sealed class DriveActivityLog : Entity
{
    public Guid? DriveItemId { get; set; }
    public Guid? FolderId { get; set; }
    public Guid? UserId { get; set; }
    public string Action { get; set; } = string.Empty;
    public string? DetailsJson { get; set; }
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
}

