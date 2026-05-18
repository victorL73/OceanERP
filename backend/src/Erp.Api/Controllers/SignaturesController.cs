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

    [HttpGet("public/{token}")]
    [AllowAnonymous]
    public async Task<ActionResult<PublicSignatureDto>> GetPublic(string token, CancellationToken cancellationToken)
    {
        var result = await signatures.GetPublicAsync(token, cancellationToken);
        return result.Succeeded ? Ok(result.Value) : NotFound(new { error = result.Error });
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
}
