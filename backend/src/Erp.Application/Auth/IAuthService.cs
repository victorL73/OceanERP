using Erp.Application.Common;

namespace Erp.Application.Auth;

public interface IAuthService
{
    Task<Result<AuthResponse>> LoginAsync(LoginRequest request, string? ipAddress, string? userAgent, CancellationToken cancellationToken);
    Task<Result<AuthResponse>> RefreshAsync(RefreshTokenRequest request, CancellationToken cancellationToken);
    Task<Result> LogoutAsync(string refreshToken, CancellationToken cancellationToken);
    Task<Result<UserDto>> GetUserAsync(Guid userId, CancellationToken cancellationToken);
    Task<Result<UserDto>> UpdateProfileAsync(Guid userId, UpdateProfileRequest request, CancellationToken cancellationToken);
    Task<Result> ChangePasswordAsync(Guid userId, ChangePasswordRequest request, CancellationToken cancellationToken);
    Task<Result<UserDto>> RegisterAsync(RegisterUserRequest request, CancellationToken cancellationToken);
    Task<Result<UserDto>> UpdateUserRolesAsync(Guid userId, UpdateUserRolesRequest request, CancellationToken cancellationToken);
    Task<IReadOnlyList<UserDto>> GetUsersAsync(CancellationToken cancellationToken);
    Task<IReadOnlyList<RoleDto>> GetRolesAsync(CancellationToken cancellationToken);
    Task<IReadOnlyList<PermissionDto>> GetPermissionsAsync(CancellationToken cancellationToken);
    Task<IReadOnlyList<AuditLogDto>> GetAuditLogsAsync(int take, CancellationToken cancellationToken);
    Task<Result<RoleDto>> CreateRoleAsync(CreateRoleRequest request, CancellationToken cancellationToken);
    Task<Result<RoleDto>> UpdateRoleAsync(Guid roleId, UpdateRoleRequest request, CancellationToken cancellationToken);
}
