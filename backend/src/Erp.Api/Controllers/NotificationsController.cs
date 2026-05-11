using Erp.Api.Hubs;
using Erp.Application.Common;
using Erp.Application.Notifications;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;

namespace Erp.Api.Controllers;

[ApiController]
[Route("api/notifications")]
[Authorize]
public sealed class NotificationsController(
    INotificationService notifications,
    ICurrentUserService currentUser,
    IHubContext<NotificationHub> hubContext) : ControllerBase
{
    [HttpGet]
    [Authorize(Policy = "notifications.read")]
    public async Task<ActionResult<IReadOnlyList<NotificationDto>>> Mine(CancellationToken cancellationToken)
        => Ok(await notifications.GetMineAsync(currentUser.UserId, cancellationToken));

    [HttpPost]
    [Authorize(Policy = "notifications.write")]
    public async Task<ActionResult<NotificationDto>> Create(CreateNotificationRequest request, CancellationToken cancellationToken)
    {
        var result = await notifications.CreateAsync(request, cancellationToken);
        if (!result.Succeeded)
        {
            return BadRequest(new { error = result.Error });
        }

        if (result.Value!.UserId is Guid userId)
        {
            await hubContext.Clients.Group($"user:{userId}").SendAsync("notificationCreated", result.Value, cancellationToken);
        }
        else
        {
            await hubContext.Clients.All.SendAsync("notificationCreated", result.Value, cancellationToken);
        }

        return Ok(result.Value);
    }

    [HttpPost("{id:guid}/read")]
    [Authorize(Policy = "notifications.read")]
    public async Task<IActionResult> MarkRead(Guid id, CancellationToken cancellationToken)
    {
        var result = await notifications.MarkReadAsync(id, currentUser.UserId, cancellationToken);
        return result.Succeeded ? NoContent() : NotFound(new { error = result.Error });
    }
}

