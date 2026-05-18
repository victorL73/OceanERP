using Erp.Application.Documents;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Erp.Api.Controllers;

[ApiController]
[Route("api/onlyoffice")]
public sealed class OnlyOfficeController(IOnlyOfficeService onlyOffice) : ControllerBase
{
    [HttpGet("files/{driveItemId:guid}/config")]
    [Authorize(Policy = "onlyoffice.read")]
    public async Task<ActionResult<OnlyOfficeConfigDto>> Config(Guid driveItemId, CancellationToken cancellationToken)
    {
        var baseUri = new Uri($"{Request.Scheme}://{Request.Host}");
        var result = await onlyOffice.GetConfigAsync(driveItemId, baseUri, cancellationToken);
        return result.Succeeded ? Ok(result.Value) : BadRequest(new { error = result.Error });
    }

    [HttpGet("files/{driveItemId:guid}/download")]
    [AllowAnonymous]
    public async Task<IActionResult> Download(Guid driveItemId, [FromQuery] string? token, CancellationToken cancellationToken)
    {
        var result = await onlyOffice.OpenDocumentAsync(driveItemId, token, cancellationToken);
        if (!result.Succeeded)
        {
            return Unauthorized(new { error = result.Error });
        }

        return File(result.Value!.Content, result.Value.MimeType, result.Value.FileName);
    }

    [HttpPost("files/{driveItemId:guid}/callback")]
    [AllowAnonymous]
    public async Task<ActionResult> Callback(Guid driveItemId, [FromQuery] string? token, OnlyOfficeCallbackRequest request, CancellationToken cancellationToken)
    {
        var result = await onlyOffice.HandleCallbackAsync(driveItemId, token, request, cancellationToken);
        return result.Succeeded ? Ok(new { error = 0 }) : BadRequest(new { error = 1, message = result.Error });
    }
}
