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

    [HttpPost("files/{driveItemId:guid}/callback")]
    [AllowAnonymous]
    public async Task<ActionResult> Callback(Guid driveItemId, OnlyOfficeCallbackRequest request, CancellationToken cancellationToken)
    {
        var result = await onlyOffice.HandleCallbackAsync(driveItemId, request, cancellationToken);
        return result.Succeeded ? Ok(new { error = 0 }) : BadRequest(new { error = 1, message = result.Error });
    }
}
