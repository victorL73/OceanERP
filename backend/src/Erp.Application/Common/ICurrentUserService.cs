namespace Erp.Application.Common;

public interface ICurrentUserService
{
    Guid? UserId { get; }
    string? Email { get; }
}

