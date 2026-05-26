using Erp.Application.Quotes;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Erp.Api.Controllers;

[ApiController]
[Route("api/quotes")]
[Authorize]
public sealed class QuotesController(IQuoteService quotes, IQuoteSettingsService quoteSettings) : ControllerBase
{
    [HttpGet("settings")]
    [Authorize(Policy = "quotes.read")]
    public async Task<ActionResult<QuoteSettingsDto>> Settings(CancellationToken cancellationToken)
        => Ok(await quoteSettings.GetAsync(cancellationToken));

    [HttpPut("settings")]
    [Authorize(Policy = "quotes.write")]
    public async Task<ActionResult<QuoteSettingsDto>> UpdateSettings(UpdateQuoteSettingsRequest request, CancellationToken cancellationToken)
    {
        var result = await quoteSettings.UpdateAsync(request, cancellationToken);
        return result.Succeeded ? Ok(result.Value) : BadRequest(new { error = result.Error });
    }

    [HttpPost("settings/logo")]
    [Authorize(Policy = "quotes.write")]
    [RequestSizeLimit(2_000_000)]
    public async Task<ActionResult<QuoteSettingsDto>> UploadLogo([FromForm] IFormFile file, CancellationToken cancellationToken)
    {
        await using var stream = file.OpenReadStream();
        var result = await quoteSettings.UploadLogoAsync(file.FileName, file.ContentType, stream, file.Length, cancellationToken);
        return result.Succeeded ? Ok(result.Value) : BadRequest(new { error = result.Error });
    }

    [HttpDelete("settings/logo")]
    [Authorize(Policy = "quotes.write")]
    public async Task<ActionResult<QuoteSettingsDto>> DeleteLogo(CancellationToken cancellationToken)
    {
        var result = await quoteSettings.DeleteLogoAsync(cancellationToken);
        return result.Succeeded ? Ok(result.Value) : BadRequest(new { error = result.Error });
    }

    [HttpGet]
    [Authorize(Policy = "quotes.read")]
    public async Task<ActionResult> Search([FromQuery] string? search, [FromQuery] int page = 1, [FromQuery] int pageSize = 20, CancellationToken cancellationToken = default)
        => Ok(await quotes.SearchAsync(search, page, pageSize, cancellationToken));

    [HttpGet("{id:guid}")]
    [Authorize(Policy = "quotes.read")]
    public async Task<ActionResult<QuoteDto>> Get(Guid id, CancellationToken cancellationToken)
    {
        var result = await quotes.GetAsync(id, cancellationToken);
        return result.Succeeded ? Ok(result.Value) : NotFound(new { error = result.Error });
    }

    [HttpPost]
    [Authorize(Policy = "quotes.write")]
    public async Task<ActionResult<QuoteDto>> Create(CreateQuoteRequest request, CancellationToken cancellationToken)
    {
        var result = await quotes.CreateAsync(request, cancellationToken);
        return result.Succeeded ? CreatedAtAction(nameof(Get), new { id = result.Value!.Id }, result.Value) : BadRequest(new { error = result.Error });
    }

    [HttpPut("{id:guid}")]
    [Authorize(Policy = "quotes.write")]
    public async Task<ActionResult<QuoteDto>> Update(Guid id, UpdateQuoteRequest request, CancellationToken cancellationToken)
    {
        var result = await quotes.UpdateAsync(id, request, cancellationToken);
        return result.Succeeded ? Ok(result.Value) : BadRequest(new { error = result.Error });
    }

    [HttpDelete("{id:guid}")]
    [Authorize(Roles = "Administrator")]
    public async Task<ActionResult> Delete(Guid id, CancellationToken cancellationToken)
    {
        var result = await quotes.DeleteAsync(id, cancellationToken);
        return result.Succeeded ? NoContent() : BadRequest(new { error = result.Error });
    }

    [HttpPost("{id:guid}/status")]
    [Authorize(Policy = "quotes.write")]
    public async Task<ActionResult<QuoteDto>> ChangeStatus(Guid id, UpdateQuoteStatusRequest request, CancellationToken cancellationToken)
    {
        var result = await quotes.ChangeStatusAsync(id, request, cancellationToken);
        return result.Succeeded ? Ok(result.Value) : BadRequest(new { error = result.Error });
    }

    [HttpPost("{id:guid}/reserve-stock")]
    [Authorize(Policy = "quotes.write")]
    public async Task<ActionResult<QuoteDto>> ReserveStock(Guid id, ReserveQuoteStockRequest request, CancellationToken cancellationToken)
    {
        var result = await quotes.ReserveStockAsync(id, request, cancellationToken);
        return result.Succeeded ? Ok(result.Value) : BadRequest(new { error = result.Error });
    }

    [HttpPost("{id:guid}/release-stock")]
    [Authorize(Policy = "quotes.write")]
    public async Task<ActionResult<QuoteDto>> ReleaseStock(Guid id, CancellationToken cancellationToken)
    {
        var result = await quotes.ReleaseStockAsync(id, cancellationToken);
        return result.Succeeded ? Ok(result.Value) : BadRequest(new { error = result.Error });
    }

    [HttpPost("{id:guid}/pdf")]
    [Authorize(Policy = "quotes.write")]
    public async Task<ActionResult<QuoteDocumentDto>> GeneratePdf(Guid id, CancellationToken cancellationToken)
    {
        var result = await quotes.GeneratePdfAsync(id, cancellationToken);
        return result.Succeeded ? Ok(result.Value) : BadRequest(new { error = result.Error });
    }

    [HttpPost("{id:guid}/email")]
    [Authorize(Policy = "quotes.write")]
    public async Task<ActionResult<QuoteDto>> SendByEmail(Guid id, SendQuoteEmailRequest request, CancellationToken cancellationToken)
    {
        var result = await quotes.SendByEmailAsync(id, request, cancellationToken);
        return result.Succeeded ? Ok(result.Value) : BadRequest(new { error = result.Error });
    }

    [HttpGet("{id:guid}/documents/{documentId:guid}/download")]
    [Authorize(Policy = "quotes.read")]
    public async Task<IActionResult> DownloadDocument(Guid id, Guid documentId, CancellationToken cancellationToken)
    {
        var result = await quotes.OpenDocumentAsync(id, documentId, cancellationToken);
        if (!result.Succeeded)
        {
            return NotFound(new { error = result.Error });
        }

        var file = result.Value!;
        return File(file.Content, file.MimeType, file.FileName);
    }
}
