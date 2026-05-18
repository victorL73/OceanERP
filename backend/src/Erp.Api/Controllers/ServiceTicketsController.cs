using Erp.Application.ServiceTickets;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Erp.Api.Controllers;

[ApiController]
[Route("api/service-tickets")]
[Authorize]
public sealed class ServiceTicketsController(IServiceTicketService tickets) : ControllerBase
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
        return result.Succeeded ? CreatedAtAction(nameof(Get), new { id = result.Value!.Id }, result.Value) : BadRequest(new { error = result.Error });
    }

    [HttpPut("{id:guid}")]
    [Authorize(Policy = "service.write")]
    public async Task<ActionResult<ServiceTicketDto>> Update(Guid id, UpdateServiceTicketRequest request, CancellationToken cancellationToken)
    {
        var result = await tickets.UpdateAsync(id, request, cancellationToken);
        return result.Succeeded ? Ok(result.Value) : BadRequest(new { error = result.Error });
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
        return result.Succeeded ? Ok(result.Value) : BadRequest(new { error = result.Error });
    }
}
