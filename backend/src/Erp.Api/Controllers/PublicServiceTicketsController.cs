using Erp.Api.Services;
using Erp.Application.Notifications;
using Erp.Application.ServiceTickets;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Erp.Api.Controllers;

[ApiController]
[AllowAnonymous]
[Route("api/public/service-tickets")]
public sealed class PublicServiceTicketsController(IServiceTicketService tickets, IRealtimeNotificationPublisher notifications) : ControllerBase
{
    [HttpGet("{token}")]
    public async Task<ActionResult<PublicServiceTicketDto>> Get(string token, CancellationToken cancellationToken)
    {
        var result = await tickets.GetPublicAsync(token, cancellationToken);
        return result.Succeeded ? Ok(result.Value) : NotFound(new { error = result.Error });
    }

    [HttpPost("{token}/messages")]
    public async Task<ActionResult<ServiceTicketMessageDto>> AddMessage(string token, CreatePublicServiceTicketMessageRequest request, CancellationToken cancellationToken)
    {
        var result = await tickets.AddPublicMessageAsync(token, request, cancellationToken);
        if (!result.Succeeded)
        {
            return BadRequest(new { error = result.Error });
        }

        var ticket = await tickets.GetInternalByPublicTokenAsync(token, cancellationToken);
        if (ticket.Succeeded && ticket.Value is not null)
        {
            await NotifyInternalAsync(ticket.Value, cancellationToken);
        }

        return Ok(result.Value);
    }

    private async Task NotifyInternalAsync(ServiceTicketDto ticket, CancellationToken cancellationToken)
    {
        var recipients = new HashSet<Guid>(ticket.Watchers.Select(x => x.UserId));
        if (ticket.AssignedUserId.HasValue)
        {
            recipients.Add(ticket.AssignedUserId.Value);
        }

        if (recipients.Count == 0)
        {
            var settings = await tickets.GetAssignmentSettingsAsync(cancellationToken);
            foreach (var userId in settings.InitialResponderUserIds)
            {
                recipients.Add(userId);
            }
        }

        foreach (var userId in recipients)
        {
            var linkUrl = $"/service?search={Uri.EscapeDataString(ticket.Number)}";
            await notifications.PublishAsync(
                new CreateNotificationRequest(userId, "service.message.public", "Reponse client SAV", $"Le client a repondu sur {ticket.Number}.", linkUrl),
                cancellationToken);
        }
    }
}
