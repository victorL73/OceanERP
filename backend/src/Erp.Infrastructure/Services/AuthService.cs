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

    public async Task<Result<UserDto>> GetUserAsync(Guid userId, CancellationToken cancellationToken)
    {
        var user = await LoadUserGraph().FirstOrDefaultAsync(x => x.Id == userId, cancellationToken);
        return user is null
            ? Result<UserDto>.Failure("User not found.")
            : Result<UserDto>.Success(MapUser(user));
    }

    public async Task<Result<UserDto>> UpdateProfileAsync(Guid userId, UpdateProfileRequest request, CancellationToken cancellationToken)
    {
        var user = await LoadUserGraph().FirstOrDefaultAsync(x => x.Id == userId, cancellationToken);
        if (user is null)
        {
            return Result<UserDto>.Failure("User not found.");
        }

        if (string.IsNullOrWhiteSpace(request.Email) || !request.Email.Contains('@', StringComparison.Ordinal))
        {
            return Result<UserDto>.Failure("A valid email is required.");
        }

        var email = request.Email.Trim().ToLowerInvariant();
        var displayName = string.IsNullOrWhiteSpace(request.DisplayName) ? email : request.DisplayName.Trim();
        if (await db.Users.AnyAsync(x => x.Id != userId && x.Email == email, cancellationToken))
        {
            return Result<UserDto>.Failure("A user with this email already exists.");
        }

        user.Email = email;
        user.DisplayName = displayName;
        AddAudit(user.Id, "auth.profile.updated", "User", user.Id.ToString(), null, null);
        await db.SaveChangesAsync(cancellationToken);

        var loaded = await LoadUserGraph().FirstAsync(x => x.Id == user.Id, cancellationToken);
        return Result<UserDto>.Success(MapUser(loaded));
    }

    public async Task<Result> ChangePasswordAsync(Guid userId, ChangePasswordRequest request, CancellationToken cancellationToken)
    {
        var user = await db.Users.Include(x => x.RefreshTokens).FirstOrDefaultAsync(x => x.Id == userId, cancellationToken);
        if (user is null)
        {
            return Result.Failure("User not found.");
        }

        if (string.IsNullOrWhiteSpace(request.CurrentPassword) || string.IsNullOrWhiteSpace(request.NewPassword))
        {
            return Result.Failure("Current password and new password are required.");
        }

        var verification = passwordHasher.VerifyHashedPassword(user, user.PasswordHash, request.CurrentPassword);
        if (verification == PasswordVerificationResult.Failed)
        {
            AddAudit(user.Id, "auth.password.change.failed", "User", user.Id.ToString(), null, null);
            await db.SaveChangesAsync(cancellationToken);
            return Result.Failure("Current password is invalid.");
        }

        if (string.IsNullOrWhiteSpace(request.NewPassword) || request.NewPassword.Length < 12)
        {
            return Result.Failure("A strong password of at least 12 characters is required.");
        }

        user.PasswordHash = passwordHasher.HashPassword(user, request.NewPassword);
        foreach (var refreshToken in user.RefreshTokens.Where(x => x.IsActive))
        {
            refreshToken.RevokedAt = DateTimeOffset.UtcNow;
        }

        AddAudit(user.Id, "auth.password.changed", "User", user.Id.ToString(), null, null);
        await db.SaveChangesAsync(cancellationToken);
        return Result.Success();
    }

    public async Task<Result<UserDto>> RegisterAsync(RegisterUserRequest request, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.Email) || string.IsNullOrWhiteSpace(request.Password) || request.Password.Length < 12)
        {
            return Result<UserDto>.Failure("Email and a strong password of at least 12 characters are required.");
        }

        var email = request.Email.Trim().ToLowerInvariant();
        var displayName = string.IsNullOrWhiteSpace(request.DisplayName) ? email : request.DisplayName.Trim();
        if (await db.Users.AnyAsync(x => x.Email == email, cancellationToken))
        {
            return Result<UserDto>.Failure("A user with this email already exists.");
        }

        var user = new User { Email = email, DisplayName = displayName, IsActive = true };
        user.PasswordHash = passwordHasher.HashPassword(user, request.Password);

        var roleNames = request.Roles is { Count: > 0 }
            ? request.Roles.Where(x => !string.IsNullOrWhiteSpace(x)).Select(x => x.Trim()).Distinct(StringComparer.OrdinalIgnoreCase).ToList()
            : new List<string> { "Sales" };
        if (roleNames.Count == 0)
        {
            roleNames.Add("Sales");
        }
        var roles = await db.Roles.Where(x => roleNames.Contains(x.Name)).ToListAsync(cancellationToken);
        if (roles.Count != roleNames.Distinct(StringComparer.OrdinalIgnoreCase).Count())
        {
            return Result<UserDto>.Failure("One or more roles were not found.");
        }

        foreach (var role in roles)
        {
            user.UserRoles.Add(new UserRole { UserId = user.Id, RoleId = role.Id });
        }

        db.Users.Add(user);
        await db.SaveChangesAsync(cancellationToken);

        var loaded = await LoadUserGraph().FirstAsync(x => x.Id == user.Id, cancellationToken);
        return Result<UserDto>.Success(MapUser(loaded));
    }

    public async Task<Result<UserDto>> UpdateUserRolesAsync(Guid userId, UpdateUserRolesRequest request, CancellationToken cancellationToken)
    {
        var user = await LoadUserGraph().FirstOrDefaultAsync(x => x.Id == userId, cancellationToken);
        if (user is null)
        {
            return Result<UserDto>.Failure("User not found.");
        }

        if (request.Roles is null || request.Roles.Count == 0)
        {
            return Result<UserDto>.Failure("A user requires at least one role.");
        }

        var requestedRoles = request.Roles.Where(x => !string.IsNullOrWhiteSpace(x)).Select(x => x.Trim()).Distinct(StringComparer.OrdinalIgnoreCase).ToList();
        var roles = await db.Roles.Where(x => requestedRoles.Contains(x.Name)).ToListAsync(cancellationToken);
        if (roles.Count != requestedRoles.Count)
        {
            return Result<UserDto>.Failure("One or more roles were not found.");
        }

        user.IsActive = request.IsActive;
        user.UserRoles.Clear();
        foreach (var role in roles)
        {
            user.UserRoles.Add(new UserRole { UserId = user.Id, RoleId = role.Id });
        }

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

    public async Task<IReadOnlyList<PermissionDto>> GetPermissionsAsync(CancellationToken cancellationToken)
        => await db.Permissions
            .OrderBy(x => x.Module)
            .ThenBy(x => x.Action)
            .Select(x => new PermissionDto(x.Id, x.Module, x.Action, x.Code))
            .ToListAsync(cancellationToken);

    public async Task<IReadOnlyList<AuditLogDto>> GetAuditLogsAsync(int take, CancellationToken cancellationToken)
    {
        var limit = Math.Clamp(take, 1, 300);
        var logs = await (
            from audit in db.AuditLogs
            join user in db.Users on audit.UserId equals user.Id into userJoin
            from user in userJoin.DefaultIfEmpty()
            orderby audit.CreatedAt descending
            select new AuditLogDto(
                audit.Id,
                audit.UserId,
                user == null ? null : user.Email,
                user == null ? null : user.DisplayName,
                audit.Action,
                audit.EntityName,
                audit.EntityId,
                audit.IpAddress,
                audit.UserAgent,
                audit.MetadataJson,
                audit.CreatedAt))
            .Take(limit)
            .ToListAsync(cancellationToken);

        return logs;
    }

    public async Task<Result<RoleDto>> CreateRoleAsync(CreateRoleRequest request, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.Name))
        {
            return Result<RoleDto>.Failure("Role name is required.");
        }

        var name = request.Name.Trim();
        if (await db.Roles.AnyAsync(x => x.Name == name, cancellationToken))
        {
            return Result<RoleDto>.Failure("A role with this name already exists.");
        }

        var permissions = await ResolvePermissionsAsync(request.Permissions, cancellationToken);
        if (!permissions.Succeeded)
        {
            return Result<RoleDto>.Failure(permissions.Error!);
        }

        var role = new Role { Name = name, Description = request.Description?.Trim() ?? string.Empty };
        foreach (var permission in permissions.Value!)
        {
            role.Permissions.Add(permission);
        }

        db.Roles.Add(role);
        await db.SaveChangesAsync(cancellationToken);
        return Result<RoleDto>.Success(MapRole(role));
    }

    public async Task<Result<RoleDto>> UpdateRoleAsync(Guid roleId, UpdateRoleRequest request, CancellationToken cancellationToken)
    {
        var role = await db.Roles.Include(x => x.Permissions).FirstOrDefaultAsync(x => x.Id == roleId, cancellationToken);
        if (role is null)
        {
            return Result<RoleDto>.Failure("Role not found.");
        }

        var permissions = await ResolvePermissionsAsync(request.Permissions, cancellationToken);
        if (!permissions.Succeeded)
        {
            return Result<RoleDto>.Failure(permissions.Error!);
        }

        role.Description = request.Description?.Trim() ?? string.Empty;
        role.Permissions.Clear();
        foreach (var permission in permissions.Value!)
        {
            role.Permissions.Add(permission);
        }

        await db.SaveChangesAsync(cancellationToken);
        return Result<RoleDto>.Success(MapRole(role));
    }

    private async Task<Result<IReadOnlyList<Permission>>> ResolvePermissionsAsync(IReadOnlyList<string>? permissionCodes, CancellationToken cancellationToken)
    {
        var codes = (permissionCodes ?? [])
            .Where(x => !string.IsNullOrWhiteSpace(x))
            .Select(x => x.Trim())
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToList();
        if (codes.Count == 0)
        {
            return Result<IReadOnlyList<Permission>>.Failure("A role requires at least one permission.");
        }

        var permissions = await db.Permissions.Where(x => codes.Contains(x.Code)).ToListAsync(cancellationToken);
        if (permissions.Count != codes.Count)
        {
            return Result<IReadOnlyList<Permission>>.Failure("One or more permissions were not found.");
        }

        return Result<IReadOnlyList<Permission>>.Success(permissions);
    }

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

    private static RoleDto MapRole(Role role)
        => new(role.Id, role.Name, role.Description, role.Permissions.Select(x => x.Code).OrderBy(x => x).ToList());
}
