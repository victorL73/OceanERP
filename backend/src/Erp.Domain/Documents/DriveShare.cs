using Erp.Domain.Common;

namespace Erp.Domain.Documents;

public sealed class DriveShare : Entity
{
    public Guid DriveItemId { get; set; }
    public Guid SharedByUserId { get; set; }
    public Guid SharedWithUserId { get; set; }
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset? ExpiresAt { get; set; }
}

