using Erp.Domain.Common;

namespace Erp.Domain.Documents;

public sealed class DocumentLink : Entity
{
    public Guid DriveItemId { get; set; }
    public DriveItem? DriveItem { get; set; }
    public string Module { get; set; } = string.Empty;
    public Guid EntityId { get; set; }
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
}

