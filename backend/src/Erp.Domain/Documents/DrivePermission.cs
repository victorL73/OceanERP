using Erp.Domain.Common;

namespace Erp.Domain.Documents;

public sealed class DrivePermission : Entity
{
    public Guid? FolderId { get; set; }
    public Guid? DriveItemId { get; set; }
    public Guid? UserId { get; set; }
    public Guid? RoleId { get; set; }
    public bool CanRead { get; set; } = true;
    public bool CanWrite { get; set; }
    public bool CanShare { get; set; }
}

