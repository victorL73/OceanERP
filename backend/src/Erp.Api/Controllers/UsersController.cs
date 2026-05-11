using Erp.Application.Auth;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Erp.Api.Controllers;

[ApiController]
[Route("api/users")]
[Authorize]
public sealed class UsersController(IAuthService authService) : ControllerBase
{
    [HttpGet]
    [Authorize(Policy = "auth.users.read")]
    public async Task<ActionResult<IReadOnlyList<UserDto>>> GetUsers(CancellationToken cancellationToken)
        => Ok(await authService.GetUsersAsync(cancellationToken));

    [HttpPost]
    [Authorize(Policy = "auth.users.write")]
    public async Task<ActionResult<UserDto>> Register(RegisterUserRequest request, CancellationToken cancellationToken)
    {
        var result = await authService.RegisterAsync(request, cancellationToken);
        return result.Succeeded ? CreatedAtAction(nameof(GetUsers), result.Value) : BadRequest(new { error = result.Error });
    }

    [HttpPut("{id:guid}/roles")]
    [Authorize(Policy = "auth.users.write")]
    public async Task<ActionResult<UserDto>> UpdateUserRoles(Guid id, UpdateUserRolesRequest request, CancellationToken cancellationToken)
    {
        var result = await authService.UpdateUserRolesAsync(id, request, cancellationToken);
        return result.Succeeded ? Ok(result.Value) : BadRequest(new { error = result.Error });
    }

    [HttpGet("roles")]
    [Authorize(Policy = "auth.users.read")]
    public async Task<ActionResult<IReadOnlyList<RoleDto>>> GetRoles(CancellationToken cancellationToken)
        => Ok(await authService.GetRolesAsync(cancellationToken));

    [HttpPost("roles")]
    [Authorize(Policy = "auth.users.write")]
    public async Task<ActionResult<RoleDto>> CreateRole(CreateRoleRequest request, CancellationToken cancellationToken)
    {
        var result = await authService.CreateRoleAsync(request, cancellationToken);
        return result.Succeeded ? Ok(result.Value) : BadRequest(new { error = result.Error });
    }

    [HttpPut("roles/{id:guid}")]
    [Authorize(Policy = "auth.users.write")]
    public async Task<ActionResult<RoleDto>> UpdateRole(Guid id, UpdateRoleRequest request, CancellationToken cancellationToken)
    {
        var result = await authService.UpdateRoleAsync(id, request, cancellationToken);
        return result.Succeeded ? Ok(result.Value) : BadRequest(new { error = result.Error });
    }

    [HttpGet("permissions")]
    [Authorize(Policy = "auth.users.read")]
    public async Task<ActionResult<IReadOnlyList<PermissionDto>>> GetPermissions(CancellationToken cancellationToken)
        => Ok(await authService.GetPermissionsAsync(cancellationToken));
}
