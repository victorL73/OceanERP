using Erp.Application.Sales;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Erp.Api.Controllers;

[ApiController]
[Route("api/orders")]
[Authorize]
public sealed class SalesOrdersController(ISalesOrderService orders) : ControllerBase
{
    [HttpGet]
    [Authorize(Policy = "orders.read")]
    public async Task<ActionResult> Search([FromQuery] int page = 1, [FromQuery] int pageSize = 20, CancellationToken cancellationToken = default)
        => Ok(await orders.SearchAsync(page, pageSize, cancellationToken));

    [HttpGet("{id:guid}")]
    [Authorize(Policy = "orders.read")]
    public async Task<ActionResult<SalesOrderDto>> Get(Guid id, CancellationToken cancellationToken)
    {
        var result = await orders.GetAsync(id, cancellationToken);
        return result.Succeeded ? Ok(result.Value) : NotFound(new { error = result.Error });
    }

    [HttpPost]
    [Authorize(Policy = "orders.write")]
    public async Task<ActionResult<SalesOrderDto>> Create(CreateSalesOrderRequest request, CancellationToken cancellationToken)
    {
        var result = await orders.CreateAsync(request, cancellationToken);
        return result.Succeeded ? CreatedAtAction(nameof(Get), new { id = result.Value!.Id }, result.Value) : BadRequest(new { error = result.Error });
    }

    [HttpPost("from-quote")]
    [Authorize(Policy = "orders.write")]
    public async Task<ActionResult<SalesOrderDto>> CreateFromQuote(CreateSalesOrderFromQuoteRequest request, CancellationToken cancellationToken)
    {
        var result = await orders.CreateFromQuoteAsync(request, cancellationToken);
        return result.Succeeded ? CreatedAtAction(nameof(Get), new { id = result.Value!.Id }, result.Value) : BadRequest(new { error = result.Error });
    }

    [HttpPost("{id:guid}/status")]
    [Authorize(Policy = "orders.write")]
    public async Task<ActionResult<SalesOrderDto>> ChangeStatus(Guid id, UpdateSalesOrderStatusRequest request, CancellationToken cancellationToken)
    {
        var result = await orders.ChangeStatusAsync(id, request, cancellationToken);
        return result.Succeeded ? Ok(result.Value) : BadRequest(new { error = result.Error });
    }
}

