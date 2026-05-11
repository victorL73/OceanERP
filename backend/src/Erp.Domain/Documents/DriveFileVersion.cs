using Erp.Domain.Common;

namespace Erp.Domain.Documents;

public sealed class DriveFileVersion : Entity
{
    public Guid DriveItemId { get; set; }
    public DriveItem? DriveItem { get; set; }
    public int Version { get; set; }
    public string StoragePath { get; set; } = string.Empty;
    public long Size { get; set; }
    public string Sha256 { get; set; } = string.Empty;
    public Guid? CreatedByUserId { get; set; }
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
}

