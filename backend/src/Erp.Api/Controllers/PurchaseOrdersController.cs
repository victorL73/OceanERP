using Erp.Application.Purchases;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Erp.Api.Controllers;

[ApiController]
[Route("api/purchases/orders")]
[Authorize]
public sealed class PurchaseOrdersController(IPurchaseOrderService purchaseOrders) : ControllerBase
{
    [HttpGet]
    [Authorize(Policy = "purchases.read")]
    public async Task<ActionResult> Search([FromQuery] int page = 1, [FromQuery] int pageSize = 100, CancellationToken cancellationToken = default)
        => Ok(await purchaseOrders.SearchAsync(page, pageSize, cancellationToken));

    [HttpGet("{id:guid}")]
    [Authorize(Policy = "purchases.read")]
    public async Task<ActionResult<PurchaseOrderDto>> Get(Guid id, CancellationToken cancellationToken)
    {
        var result = await purchaseOrders.GetAsync(id, cancellationToken);
        return result.Succeeded ? Ok(result.Value) : NotFound(new { error = result.Error });
    }

    [HttpPost]
    [Authorize(Policy = "purchases.write")]
    public async Task<ActionResult<PurchaseOrderDto>> Create(CreatePurchaseOrderRequest request, CancellationToken cancellationToken)
    {
        var result = await purchaseOrders.CreateAsync(request, cancellationToken);
        return result.Succeeded ? CreatedAtAction(nameof(Get), new { id = result.Value!.Id }, result.Value) : BadRequest(new { error = result.Error });
    }

    [HttpPost("{id:guid}/status")]
    [Authorize(Policy = "purchases.write")]
    public async Task<ActionResult<PurchaseOrderDto>> ChangeStatus(Guid id, UpdatePurchaseOrderStatusRequest request, CancellationToken cancellationToken)
    {
        var result = await purchaseOrders.ChangeStatusAsync(id, request, cancellationToken);
        return result.Succeeded ? Ok(result.Value) : BadRequest(new { error = result.Error });
    }

    [HttpPut("{id:guid}/expected-date")]
    [Authorize(Policy = "purchases.write")]
    public async Task<ActionResult<PurchaseOrderDto>> UpdateExpectedAt(Guid id, UpdatePurchaseOrderExpectedAtRequest request, CancellationToken cancellationToken)
    {
        var result = await purchaseOrders.UpdateExpectedAtAsync(id, request, cancellationToken);
        return result.Succeeded ? Ok(result.Value) : BadRequest(new { error = result.Error });
    }
}
