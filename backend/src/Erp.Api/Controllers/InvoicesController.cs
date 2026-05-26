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

    [HttpPost("{id:guid}/credit-note")]
    [Authorize(Policy = "invoices.write")]
    public async Task<ActionResult<InvoiceDto>> CreateCreditNote(Guid id, CreateCreditNoteRequest request, CancellationToken cancellationToken)
    {
        var result = await invoices.CreateCreditNoteAsync(id, request, cancellationToken);
        return result.Succeeded ? CreatedAtAction(nameof(Get), new { id = result.Value!.Id }, result.Value) : BadRequest(new { error = result.Error });
    }

    [HttpPost("{id:guid}/cancel")]
    [Authorize(Policy = "invoices.write")]
    public async Task<ActionResult<InvoiceDto>> Cancel(Guid id, CancellationToken cancellationToken)
    {
        var result = await invoices.CancelAsync(id, cancellationToken);
        return result.Succeeded ? Ok(result.Value) : BadRequest(new { error = result.Error });
    }

    [HttpDelete("{id:guid}")]
    [Authorize(Policy = "invoices.write")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken cancellationToken)
    {
        var result = await invoices.DeleteAsync(id, cancellationToken);
        return result.Succeeded ? NoContent() : BadRequest(new { error = result.Error });
    }

    [HttpPost("{id:guid}/pdf")]
    [Authorize(Policy = "invoices.write")]
    public async Task<ActionResult<InvoiceDocumentDto>> GeneratePdf(Guid id, CancellationToken cancellationToken)
    {
        var result = await invoices.GeneratePdfAsync(id, cancellationToken);
        return result.Succeeded ? Ok(result.Value) : BadRequest(new { error = result.Error });
    }

    [HttpGet("{id:guid}/factur-x/xml")]
    [Authorize(Policy = "invoices.read")]
    public async Task<IActionResult> FacturXXml(Guid id, CancellationToken cancellationToken)
    {
        var result = await invoices.GenerateFacturXXmlAsync(id, cancellationToken);
        if (!result.Succeeded)
        {
            return NotFound(new { error = result.Error });
        }

        var export = result.Value!;
        return File(System.Text.Encoding.UTF8.GetBytes(export.Xml), export.MimeType, export.FileName);
    }

    [HttpGet("{invoiceId:guid}/documents/{documentId:guid}/download")]
    [Authorize(Policy = "invoices.read")]
    public async Task<IActionResult> DownloadDocument(Guid invoiceId, Guid documentId, CancellationToken cancellationToken)
    {
        var result = await invoices.OpenDocumentAsync(invoiceId, documentId, cancellationToken);
        if (!result.Succeeded)
        {
            return NotFound(new { error = result.Error });
        }

        var file = result.Value!;
        return File(file.Content, file.MimeType, file.FileName);
    }
}
