using Erp.Application.Signatures;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Erp.Api.Controllers;

[ApiController]
[Route("api/signatures")]
public sealed class SignaturesController(ISignatureService signatures) : ControllerBase
{
    [HttpGet]
    [Authorize(Policy = "signatures.read")]
    public async Task<ActionResult> Search([FromQuery] int page = 1, [FromQuery] int pageSize = 50, CancellationToken cancellationToken = default)
        => Ok(await signatures.SearchAsync(page, pageSize, cancellationToken));

    [HttpGet("{id:guid}")]
    [Authorize(Policy = "signatures.read")]
    public async Task<ActionResult<SignatureRequestDto>> Get(Guid id, CancellationToken cancellationToken)
    {
        var result = await signatures.GetAsync(id, cancellationToken);
        return result.Succeeded ? Ok(result.Value) : NotFound(new { error = result.Error });
    }

    [HttpPost]
    [Authorize(Policy = "signatures.write")]
    public async Task<ActionResult<SignatureRequestDto>> Create(CreateSignatureRequestRequest request, CancellationToken cancellationToken)
    {
        var result = await signatures.CreateAsync(request, PublicBaseUrl(), cancellationToken);
        return result.Succeeded ? CreatedAtAction(nameof(Get), new { id = result.Value!.Id }, result.Value) : BadRequest(new { error = result.Error });
    }

    [HttpPost("{id:guid}/status")]
    [Authorize(Policy = "signatures.write")]
    public async Task<ActionResult<SignatureRequestDto>> ChangeStatus(Guid id, [FromBody] ChangeSignatureStatusRequest request, CancellationToken cancellationToken)
    {
        var result = await signatures.ChangeStatusAsync(id, request.Status, cancellationToken);
        return result.Succeeded ? Ok(result.Value) : BadRequest(new { error = result.Error });
    }

    [HttpDelete("{id:guid}")]
    [Authorize(Policy = "signatures.write")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken cancellationToken)
    {
        var result = await signatures.DeleteAsync(id, cancellationToken);
        return result.Succeeded ? NoContent() : BadRequest(new { error = result.Error });
    }

    [HttpGet("{id:guid}/document")]
    [Authorize(Policy = "signatures.read")]
    public async Task<IActionResult> Document(Guid id, CancellationToken cancellationToken)
    {
        var result = await signatures.OpenDocumentAsync(id, cancellationToken);
        if (!result.Succeeded)
        {
            return NotFound(new { error = result.Error });
        }

        var file = result.Value!;
        return File(file.Content, file.MimeType);
    }

    [HttpGet("{id:guid}/signed-documents/{signedDocumentId:guid}/download")]
    [Authorize(Policy = "signatures.read")]
    public async Task<IActionResult> SignedDocument(Guid id, Guid signedDocumentId, CancellationToken cancellationToken)
    {
        var result = await signatures.OpenSignedDocumentAsync(id, signedDocumentId, cancellationToken);
        if (!result.Succeeded)
        {
            return NotFound(new { error = result.Error });
        }

        var file = result.Value!;
        return File(file.Content, file.MimeType, file.FileName);
    }

    [HttpGet("public/{token}")]
    [AllowAnonymous]
    public async Task<ActionResult<PublicSignatureDto>> GetPublic(string token, CancellationToken cancellationToken)
    {
        var result = await signatures.GetPublicAsync(token, cancellationToken);
        return result.Succeeded ? Ok(result.Value) : NotFound(new { error = result.Error });
    }

    [HttpGet("public/{token}/document")]
    [AllowAnonymous]
    public async Task<IActionResult> PublicDocument(string token, [FromQuery] bool signed = false, CancellationToken cancellationToken = default)
    {
        var result = await signatures.OpenPublicDocumentAsync(token, signed, cancellationToken);
        if (!result.Succeeded)
        {
            return NotFound(new { error = result.Error });
        }

        var file = result.Value!;
        return File(file.Content, file.MimeType);
    }

    [HttpPost("public/{token}/accept")]
    [AllowAnonymous]
    public async Task<ActionResult<SignatureRequestDto>> Accept(string token, AcceptSignatureRequest request, CancellationToken cancellationToken)
    {
        var result = await signatures.AcceptAsync(token, request, HttpContext.Connection.RemoteIpAddress?.ToString(), Request.Headers.UserAgent.ToString(), cancellationToken);
        return result.Succeeded ? Ok(result.Value) : BadRequest(new { error = result.Error });
    }

    private string PublicBaseUrl()
        => $"{Request.Scheme}://{Request.Host}";

    public sealed record ChangeSignatureStatusRequest(string Status);
}
