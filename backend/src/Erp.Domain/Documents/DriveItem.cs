using Erp.Domain.Common;

namespace Erp.Domain.Documents;

public sealed class DriveItem : AuditableEntity
{
    public Guid? FolderId { get; set; }
    public DriveFolder? Folder { get; set; }
    public string Name { get; set; } = string.Empty;
    public string MimeType { get; set; } = "application/octet-stream";
    public long Size { get; set; }
    public string StoragePath { get; set; } = string.Empty;
    public int CurrentVersion { get; set; } = 1;
    public bool IsTrashed { get; set; }
    public ICollection<DriveFileVersion> Versions { get; set; } = new List<DriveFileVersion>();
    public ICollection<DocumentLink> Links { get; set; } = new List<DocumentLink>();
}

