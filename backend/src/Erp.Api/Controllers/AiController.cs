using Erp.Application.Ai;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Erp.Api.Controllers;

[ApiController]
[Route("api/ai")]
[Authorize(Roles = "Administrator")]
public sealed class AiController(IAiSettingsService aiSettings) : ControllerBase
{
    [HttpGet("settings")]
    public async Task<ActionResult<AiSettingsDto>> Settings(CancellationToken cancellationToken)
        => Ok(await aiSettings.GetAsync(cancellationToken));

    [HttpPut("settings")]
    public async Task<ActionResult<AiSettingsDto>> UpdateSettings(UpdateAiSettingsRequest request, CancellationToken cancellationToken)
    {
        var result = await aiSettings.UpdateAsync(request, cancellationToken);
        return result.Succeeded ? Ok(result.Value) : BadRequest(new { error = result.Error });
    }
}
