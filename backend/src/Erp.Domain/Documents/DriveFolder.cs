using Erp.Domain.Common;

namespace Erp.Domain.Documents;

public sealed class DriveFolder : AuditableEntity
{
    public Guid? ParentFolderId { get; set; }
    public DriveFolder? ParentFolder { get; set; }
    public string Name { get; set; } = string.Empty;
    public bool IsTrashed { get; set; }
    public ICollection<DriveFolder> Children { get; set; } = new List<DriveFolder>();
    public ICollection<DriveItem> Files { get; set; } = new List<DriveItem>();
}

