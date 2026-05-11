using Erp.Application.Auth;
using Erp.Application.Common;
using Erp.Domain.Auth;
using Erp.Infrastructure.Persistence;
using Erp.Infrastructure.Security;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace Erp.Infrastructure.Services;

public sealed class AuthService(
    ErpDbContext db,
    IPasswordHasher<User> passwordHasher,
    ITokenService tokenService,
    IOptions<JwtOptions> jwtOptions) : IAuthService
{
    private readonly JwtOptions _jwt = jwtOptions.Value;

    public async Task<Result<AuthResponse>> LoginAsync(LoginRequest request, string? ipAddress, string? userAgent, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.Email) || string.IsNullOrWhiteSpace(request.Password))
        {
            return Result<AuthResponse>.Failure("Email and password are required.");
        }

        var user = await LoadUserGraph().FirstOrDefaultAsync(x => x.Email == request.Email.ToLower(), cancellationToken);
        if (user is null || !user.IsActive)
        {
            AddAudit(null, "auth.login.failed", "User", null, ipAddress, userAgent);
            await db.SaveChangesAsync(cancellationToken);
            return Result<AuthResponse>.Failure("Invalid credentials.");
        }

        var verification = passwordHasher.VerifyHashedPassword(user, user.PasswordHash, request.Password);
        if (verification == PasswordVerificationResult.Failed)
        {
            AddAudit(user.Id, "auth.login.failed", "User", user.Id.ToString(), ipAddress, userAgent);
            await db.SaveChangesAsync(cancellationToken);
            return Result<AuthResponse>.Failure("Invalid credentials.");
        }

        user.LastLoginAt = DateTimeOffset.UtcNow;
        var response = await CreateTokenPairAsync(user, cancellationToken);
        AddAudit(user.Id, "auth.login.succeeded", "User", user.Id.ToString(), ipAddress, userAgent);
        await db.SaveChangesAsync(cancellationToken);

        return Result<AuthResponse>.Success(response);
    }

    public async Task<Result<AuthResponse>> RefreshAsync(RefreshTokenRequest request, CancellationToken cancellationToken)
    {
        var tokenHash = tokenService.HashToken(request.RefreshToken);
        var refreshToken = await db.RefreshTokens
            .Include(x => x.User).ThenInclude(x => x!.UserRoles).ThenInclude(x => x.Role).ThenInclude(x => x!.Permissions)
            .FirstOrDefaultAsync(x => x.TokenHash == tokenHash, cancellationToken);

        if (refreshToken is null || !refreshToken.IsActive || refreshToken.User is null || !refreshToken.User.IsActive)
        {
            return Result<AuthResponse>.Failure("Invalid refresh token.");
        }

        refreshToken.RevokedAt = DateTimeOffset.UtcNow;
        var response = await CreateTokenPairAsync(refreshToken.User, cancellationToken);
        refreshToken.ReplacedByTokenHash = tokenService.HashToken(response.RefreshToken);
        await db.SaveChangesAsync(cancellationToken);

        return Result<AuthResponse>.Success(response);
    }

    public async Task<Result> LogoutAsync(string refreshToken, CancellationToken cancellationToken)
    {
        var tokenHash = tokenService.HashToken(refreshToken);
        var entity = await db.RefreshTokens.FirstOrDefaultAsync(x => x.TokenHash == tokenHash, cancellationToken);
        if (entity is not null)
        {
            entity.RevokedAt = DateTimeOffset.UtcNow;
            await db.SaveChangesAsync(cancellationToken);
        }

        return Result.Success();
    }

    public async Task<Result<UserDto>> RegisterAsync(RegisterUserRequest request, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.Email) || string.IsNullOrWhiteSpace(request.Password) || request.Password.Length < 12)
        {
            return Result<UserDto>.Failure("Email and a strong password of at least 12 characters are required.");
        }

        var email = request.Email.Trim().ToLowerInvariant();
        if (await db.Users.AnyAsync(x => x.Email == email, cancellationToken))
        {
            return Result<UserDto>.Failure("A user with this email already exists.");
        }

        var user = new User { Email = email, DisplayName = request.DisplayName.Trim(), IsActive = true };
        user.PasswordHash = passwordHasher.HashPassword(user, request.Password);

        var roleNames = request.Roles is { Count: > 0 } ? request.Roles : ["Sales"];
        var roles = await db.Roles.Where(x => roleNames.Contains(x.Name)).ToListAsync(cancellationToken);
        foreach (var role in roles)
        {
            user.UserRoles.Add(new UserRole { UserId = user.Id, RoleId = role.Id });
        }

        db.Users.Add(user);
        await db.SaveChangesAsync(cancellationToken);

        var loaded = await LoadUserGraph().FirstAsync(x => x.Id == user.Id, cancellationToken);
        return Result<UserDto>.Success(MapUser(loaded));
    }

    public async Task<IReadOnlyList<UserDto>> GetUsersAsync(CancellationToken cancellationToken)
    {
        var users = await LoadUserGraph().OrderBy(x => x.Email).ToListAsync(cancellationToken);
        return users.Select(MapUser).ToList();
    }

    public async Task<IReadOnlyList<RoleDto>> GetRolesAsync(CancellationToken cancellationToken)
        => await db.Roles.Include(x => x.Permissions)
            .OrderBy(x => x.Name)
            .Select(x => new RoleDto(x.Id, x.Name, x.Description, x.Permissions.Select(p => p.Code).OrderBy(code => code).ToList()))
            .ToListAsync(cancellationToken);

    private IQueryable<User> LoadUserGraph()
        => db.Users
            .Include(x => x.UserRoles)
            .ThenInclude(x => x.Role)
            .ThenInclude(x => x!.Permissions);

    private async Task<AuthResponse> CreateTokenPairAsync(User user, CancellationToken cancellationToken)
    {
        var roles = user.UserRoles.Select(x => x.Role?.Name).Where(x => x is not null).Cast<string>().Distinct().ToList();
        var permissions = user.UserRoles.SelectMany(x => x.Role?.Permissions ?? []).Select(x => x.Code).Distinct().ToList();
        var expiresAt = DateTimeOffset.UtcNow.AddMinutes(_jwt.AccessTokenMinutes);
        var accessToken = tokenService.CreateAccessToken(user, roles, permissions, expiresAt);
        var refreshToken = tokenService.CreateRefreshToken();
        var tokenHash = tokenService.HashToken(refreshToken);

        db.RefreshTokens.Add(new RefreshToken
        {
            UserId = user.Id,
            TokenHash = tokenHash,
            ExpiresAt = DateTimeOffset.UtcNow.AddDays(_jwt.RefreshTokenDays)
        });

        await Task.CompletedTask;
        return new AuthResponse(accessToken, refreshToken, expiresAt, MapUser(user));
    }

    private void AddAudit(Guid? userId, string action, string entityName, string? entityId, string? ipAddress, string? userAgent)
    {
        db.AuditLogs.Add(new AuditLog
        {
            UserId = userId,
            Action = action,
            EntityName = entityName,
            EntityId = entityId,
            IpAddress = ipAddress,
            UserAgent = userAgent
        });
    }

    private static UserDto MapUser(User user)
    {
        var roles = user.UserRoles.Select(x => x.Role?.Name).Where(x => x is not null).Cast<string>().Distinct().OrderBy(x => x).ToList();
        var permissions = user.UserRoles.SelectMany(x => x.Role?.Permissions ?? []).Select(x => x.Code).Distinct().OrderBy(x => x).ToList();
        return new UserDto(user.Id, user.Email, user.DisplayName, user.IsActive, roles, permissions);
    }
}
