using Erp.Application.ExpenseReports;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Erp.Api.Controllers;

[ApiController]
[Route("api/expense-reports")]
[Authorize]
public sealed class ExpenseReportsController(IExpenseReportService expenseReports) : ControllerBase
{
    [HttpGet]
    [Authorize(Policy = "expenses.read")]
    public async Task<ActionResult<IReadOnlyList<ExpenseReportDto>>> List(CancellationToken cancellationToken)
    {
        return Ok(await expenseReports.ListAsync(cancellationToken));
    }

    [HttpGet("{id:guid}")]
    [Authorize(Policy = "expenses.read")]
    public async Task<ActionResult<ExpenseReportDto>> Get(Guid id, CancellationToken cancellationToken)
    {
        var result = await expenseReports.GetAsync(id, cancellationToken);
        return result.Succeeded ? Ok(result.Value) : NotFound(new { message = result.Error });
    }

    [HttpPost]
    [Authorize(Policy = "expenses.write")]
    public async Task<ActionResult<ExpenseReportDto>> Create(CreateExpenseReportRequest request, CancellationToken cancellationToken)
    {
        var result = await expenseReports.CreateAsync(request, cancellationToken);
        return result.Succeeded
            ? CreatedAtAction(nameof(Get), new { id = result.Value!.Id }, result.Value)
            : BadRequest(new { message = result.Error });
    }

    [HttpPut("{id:guid}")]
    [Authorize(Policy = "expenses.write")]
    public async Task<ActionResult<ExpenseReportDto>> Update(Guid id, UpdateExpenseReportRequest request, CancellationToken cancellationToken)
    {
        var result = await expenseReports.UpdateAsync(id, request, cancellationToken);
        return result.Succeeded ? Ok(result.Value) : BadRequest(new { message = result.Error });
    }

    [HttpPost("{id:guid}/status")]
    [Authorize(Policy = "expenses.approve")]
    public async Task<ActionResult<ExpenseReportDto>> ChangeStatus(Guid id, ChangeExpenseReportStatusRequest request, CancellationToken cancellationToken)
    {
        var result = await expenseReports.ChangeStatusAsync(id, request, cancellationToken);
        return result.Succeeded ? Ok(result.Value) : BadRequest(new { message = result.Error });
    }

    [HttpGet("{id:guid}/attachments")]
    [Authorize(Policy = "expenses.read")]
    public async Task<ActionResult<IReadOnlyList<ExpenseReportAttachmentDto>>> ListAttachments(Guid id, CancellationToken cancellationToken)
    {
        var result = await expenseReports.ListAttachmentsAsync(id, cancellationToken);
        return result.Succeeded ? Ok(result.Value) : NotFound(new { message = result.Error });
    }

    [HttpPost("{id:guid}/attachments")]
    [Authorize(Policy = "expenses.write")]
    [RequestSizeLimit(100_000_000)]
    public async Task<ActionResult<IReadOnlyList<ExpenseReportAttachmentDto>>> AddAttachments(Guid id, CancellationToken cancellationToken)
    {
        if (!Request.HasFormContentType)
        {
            return BadRequest(new { message = "Envoi multipart/form-data attendu." });
        }

        var form = await Request.ReadFormAsync(cancellationToken);
        var uploads = form.Files
            .Select(file => new ExpenseReportAttachmentUpload(
                file.FileName,
                string.IsNullOrWhiteSpace(file.ContentType) ? "application/octet-stream" : file.ContentType,
                file.Length,
                file.OpenReadStream()))
            .ToList();

        try
        {
            var result = await expenseReports.AddAttachmentsAsync(id, uploads, cancellationToken);
            return result.Succeeded ? Ok(result.Value) : BadRequest(new { message = result.Error });
        }
        finally
        {
            foreach (var upload in uploads)
            {
                await upload.Content.DisposeAsync();
            }
        }
    }

    [HttpGet("{id:guid}/attachments/{attachmentId:guid}/download")]
    [Authorize(Policy = "expenses.read")]
    public async Task<IActionResult> DownloadAttachment(Guid id, Guid attachmentId, CancellationToken cancellationToken)
    {
        var result = await expenseReports.OpenAttachmentAsync(id, attachmentId, cancellationToken);
        return result.Succeeded
            ? File(result.Value!.Content, result.Value.ContentType, result.Value.FileName)
            : NotFound(new { message = result.Error });
    }

    [HttpDelete("{id:guid}/attachments/{attachmentId:guid}")]
    [Authorize(Policy = "expenses.write")]
    public async Task<IActionResult> DeleteAttachment(Guid id, Guid attachmentId, CancellationToken cancellationToken)
    {
        var result = await expenseReports.DeleteAttachmentAsync(id, attachmentId, cancellationToken);
        return result.Succeeded ? NoContent() : NotFound(new { message = result.Error });
    }
}
