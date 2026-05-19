using Erp.Api.Services;
using Erp.Application.Notifications;
using Erp.Application.ServiceTickets;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Erp.Api.Controllers;

[ApiController]
[Route("api/service-tickets")]
[Authorize]
public sealed class ServiceTicketsController(IServiceTicketService tickets, IRealtimeNotificationPublisher notifications) : ControllerBase
{
    [HttpGet]
    [Authorize(Policy = "service.read")]
    public async Task<ActionResult> Search([FromQuery] string? search, [FromQuery] string? status, [FromQuery] int page = 1, [FromQuery] int pageSize = 50, CancellationToken cancellationToken = default)
        => Ok(await tickets.SearchAsync(search, status, page, pageSize, cancellationToken));

    [HttpGet("{id:guid}")]
    [Authorize(Policy = "service.read")]
    public async Task<ActionResult<ServiceTicketDto>> Get(Guid id, CancellationToken cancellationToken)
    {
        var result = await tickets.GetAsync(id, cancellationToken);
        return result.Succeeded ? Ok(result.Value) : NotFound(new { error = result.Error });
    }

    [HttpPost]
    [Authorize(Policy = "service.write")]
    public async Task<ActionResult<ServiceTicketDto>> Create(CreateServiceTicketRequest request, CancellationToken cancellationToken)
    {
        var result = await tickets.CreateAsync(request, cancellationToken);
        if (!result.Succeeded)
        {
            return BadRequest(new { error = result.Error });
        }

        await NotifyTicketCreatedAsync(result.Value!, cancellationToken);
        return CreatedAtAction(nameof(Get), new { id = result.Value!.Id }, result.Value);
    }

    [HttpPut("{id:guid}")]
    [Authorize(Policy = "service.write")]
    public async Task<ActionResult<ServiceTicketDto>> Update(Guid id, UpdateServiceTicketRequest request, CancellationToken cancellationToken)
    {
        var result = await tickets.UpdateAsync(id, request, cancellationToken);
        return result.Succeeded ? Ok(result.Value) : BadRequest(new { error = result.Error });
    }

    [HttpPost("{id:guid}/assignment")]
    [Authorize(Policy = "service.write")]
    public async Task<ActionResult<ServiceTicketDto>> Assign(Guid id, AssignServiceTicketRequest request, CancellationToken cancellationToken)
    {
        var result = await tickets.AssignAsync(id, request, cancellationToken);
        if (!result.Succeeded)
        {
            return BadRequest(new { error = result.Error });
        }

        if (result.Value!.AssignedUserId.HasValue)
        {
            await PublishToUsersAsync(
                [result.Value.AssignedUserId.Value],
                "service.assigned",
                "Ticket SAV attribue",
                $"{result.Value.Number} - {result.Value.Subject}",
                "/service",
                cancellationToken);
        }

        return Ok(result.Value);
    }

    [HttpPost("{id:guid}/status")]
    [Authorize(Policy = "service.write")]
    public async Task<ActionResult<ServiceTicketDto>> ChangeStatus(Guid id, UpdateServiceTicketStatusRequest request, CancellationToken cancellationToken)
    {
        var result = await tickets.ChangeStatusAsync(id, request, cancellationToken);
        return result.Succeeded ? Ok(result.Value) : BadRequest(new { error = result.Error });
    }

    [HttpPost("{id:guid}/messages")]
    [Authorize(Policy = "service.write")]
    public async Task<ActionResult<ServiceTicketMessageDto>> AddMessage(Guid id, CreateServiceTicketMessageRequest request, CancellationToken cancellationToken)
    {
        var result = await tickets.AddMessageAsync(id, request, cancellationToken);
        if (!result.Succeeded)
        {
            return BadRequest(new { error = result.Error });
        }

        var ticket = await tickets.GetAsync(id, cancellationToken);
        if (ticket.Succeeded && ticket.Value is not null)
        {
            await NotifyTicketMessageAsync(ticket.Value, cancellationToken);
        }

        return Ok(result.Value);
    }

    [HttpGet("settings/assignment")]
    [Authorize(Policy = "auth.users.write")]
    public async Task<ActionResult<ServiceTicketAssignmentSettingsDto>> GetAssignmentSettings(CancellationToken cancellationToken)
        => Ok(await tickets.GetAssignmentSettingsAsync(cancellationToken));

    [HttpPut("settings/assignment")]
    [Authorize(Policy = "auth.users.write")]
    public async Task<ActionResult<ServiceTicketAssignmentSettingsDto>> UpdateAssignmentSettings(UpdateServiceTicketAssignmentSettingsRequest request, CancellationToken cancellationToken)
    {
        var result = await tickets.UpdateAssignmentSettingsAsync(request, cancellationToken);
        return result.Succeeded ? Ok(result.Value) : BadRequest(new { error = result.Error });
    }

    private async Task NotifyTicketCreatedAsync(ServiceTicketDto ticket, CancellationToken cancellationToken)
    {
        var title = ticket.AssignedUserId.HasValue ? "Nouveau ticket SAV attribue" : "Nouveau ticket SAV a attribuer";
        await NotifyTicketStakeholdersAsync(ticket, "service.created", title, cancellationToken);
    }

    private async Task NotifyTicketMessageAsync(ServiceTicketDto ticket, CancellationToken cancellationToken)
        => await NotifyTicketStakeholdersAsync(ticket, "service.message", "Nouveau message SAV", cancellationToken);

    private async Task NotifyTicketStakeholdersAsync(ServiceTicketDto ticket, string type, string title, CancellationToken cancellationToken)
    {
        var recipients = ticket.AssignedUserId.HasValue
            ? [ticket.AssignedUserId.Value]
            : (await tickets.GetAssignmentSettingsAsync(cancellationToken)).InitialResponderUserIds;

        var message = $"{ticket.Number} - {ticket.Subject}";
        if (recipients.Count == 0)
        {
            await notifications.PublishAsync(new CreateNotificationRequest(null, type, title, message, "/service"), cancellationToken);
            return;
        }

        await PublishToUsersAsync(recipients, type, title, message, "/service", cancellationToken);
    }

    private async Task PublishToUsersAsync(IReadOnlyList<Guid> userIds, string type, string title, string message, string linkUrl, CancellationToken cancellationToken)
    {
        foreach (var userId in userIds.Distinct())
        {
            await notifications.PublishAsync(new CreateNotificationRequest(userId, type, title, message, linkUrl), cancellationToken);
        }
    }
}
