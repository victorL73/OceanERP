using Erp.Application.Common;

namespace Erp.Application.Auth;

public interface IAuthService
{
    Task<Result<AuthResponse>> LoginAsync(LoginRequest request, string? ipAddress, string? userAgent, CancellationToken cancellationToken);
    Task<Result<AuthResponse>> RefreshAsync(RefreshTokenRequest request, CancellationToken cancellationToken);
    Task<Result> LogoutAsync(string refreshToken, CancellationToken cancellationToken);
    Task<Result<UserDto>> RegisterAsync(RegisterUserRequest request, CancellationToken cancellationToken);
    Task<IReadOnlyList<UserDto>> GetUsersAsync(CancellationToken cancellationToken);
    Task<IReadOnlyList<RoleDto>> GetRolesAsync(CancellationToken cancellationToken);
}

