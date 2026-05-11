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

    [HttpGet("roles")]
    [Authorize(Policy = "auth.users.read")]
    public async Task<ActionResult<IReadOnlyList<RoleDto>>> GetRoles(CancellationToken cancellationToken)
        => Ok(await authService.GetRolesAsync(cancellationToken));
}

