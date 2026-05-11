using Erp.Application.Invoices;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Erp.Api.Controllers;

[ApiController]
[Route("api/invoices")]
[Authorize]
public sealed class InvoicesController(IInvoiceService invoices) : ControllerBase
{
    [HttpGet]
    [Authorize(Policy = "invoices.read")]
    public async Task<ActionResult> Search([FromQuery] int page = 1, [FromQuery] int pageSize = 20, CancellationToken cancellationToken = default)
        => Ok(await invoices.SearchAsync(page, pageSize, cancellationToken));

    [HttpGet("{id:guid}")]
    [Authorize(Policy = "invoices.read")]
    public async Task<ActionResult<InvoiceDto>> Get(Guid id, CancellationToken cancellationToken)
    {
        var result = await invoices.GetAsync(id, cancellationToken);
        return result.Succeeded ? Ok(result.Value) : NotFound(new { error = result.Error });
    }

    [HttpPost("from-order")]
    [Authorize(Policy = "invoices.write")]
    public async Task<ActionResult<InvoiceDto>> CreateFromOrder(CreateInvoiceFromOrderRequest request, CancellationToken cancellationToken)
    {
        var result = await invoices.CreateFromOrderAsync(request, cancellationToken);
        return result.Succeeded ? CreatedAtAction(nameof(Get), new { id = result.Value!.Id }, result.Value) : BadRequest(new { error = result.Error });
    }

    [HttpPost("{id:guid}/payments")]
    [Authorize(Policy = "invoices.write")]
    public async Task<ActionResult<InvoiceDto>> AddPayment(Guid id, AddInvoicePaymentRequest request, CancellationToken cancellationToken)
    {
        var result = await invoices.AddPaymentAsync(id, request, cancellationToken);
        return result.Succeeded ? Ok(result.Value) : BadRequest(new { error = result.Error });
    }
}

