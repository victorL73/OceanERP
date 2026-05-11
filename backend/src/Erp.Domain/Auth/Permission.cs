using Erp.Domain.Common;

namespace Erp.Domain.Auth;

public sealed class Permission : Entity
{
    public string Module { get; set; } = string.Empty;
    public string Action { get; set; } = string.Empty;
    public string Code { get; set; } = string.Empty;
    public ICollection<Role> Roles { get; set; } = new List<Role>();
}

