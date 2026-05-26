namespace Erp.Application.Auth;

public sealed record LoginRequest(string Email, string Password);
public sealed record RefreshTokenRequest(string RefreshToken);
public sealed record RegisterUserRequest(string Email, string DisplayName, string Password, IReadOnlyList<string>? Roles, string? Phone = null, string? JobTitle = null, string? Workplace = null);
public sealed record UpdateProfileRequest(string Email, string DisplayName, string? Phone = null, string? JobTitle = null, string? Workplace = null);
public sealed record ChangePasswordRequest(string CurrentPassword, string NewPassword);
public sealed record UpdateUserRolesRequest(IReadOnlyList<string> Roles, bool IsActive, string? Phone = null, string? JobTitle = null, string? Workplace = null);
public sealed record CreateRoleRequest(string Name, string Description, IReadOnlyList<string> Permissions);
public sealed record UpdateRoleRequest(string Description, IReadOnlyList<string> Permissions);
public sealed record AuthResponse(string AccessToken, string RefreshToken, DateTimeOffset ExpiresAt, UserDto User);
public sealed record UserDto(Guid Id, string Email, string DisplayName, bool IsActive, IReadOnlyList<string> Roles, IReadOnlyList<string> Permissions, string? Phone, string? JobTitle, string? Workplace);
public sealed record RoleDto(Guid Id, string Name, string Description, IReadOnlyList<string> Permissions);
public sealed record PermissionDto(Guid Id, string Module, string Action, string Code);
public sealed record AuditLogDto(Guid Id, Guid? UserId, string? UserEmail, string? UserDisplayName, string Action, string EntityName, string? EntityId, string? IpAddress, string? UserAgent, string? MetadataJson, DateTimeOffset CreatedAt);
