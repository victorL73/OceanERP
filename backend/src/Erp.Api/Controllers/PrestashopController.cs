using Erp.Application.Prestashop;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Erp.Api.Controllers;

[ApiController]
[Route("api/prestashop")]
[Authorize]
public sealed class PrestashopController(IPrestashopService prestashop) : ControllerBase
{
    [HttpGet("connections")]
    [Authorize(Policy = "prestashop.read")]
    public async Task<ActionResult<IReadOnlyList<PrestashopConnectionDto>>> Connections(CancellationToken cancellationToken)
        => Ok(await prestashop.GetConnectionsAsync(cancellationToken));

    [HttpPost("connections")]
    [Authorize(Policy = "prestashop.write")]
    public async Task<ActionResult<PrestashopConnectionDto>> CreateConnection(CreatePrestashopConnectionRequest request, CancellationToken cancellationToken)
    {
        var result = await prestashop.CreateConnectionAsync(request, cancellationToken);
        return result.Succeeded ? Ok(result.Value) : BadRequest(new { error = result.Error });
    }

    [HttpGet("sync-logs")]
    [Authorize(Policy = "prestashop.read")]
    public async Task<ActionResult<IReadOnlyList<PrestashopSyncLogDto>>> Logs(CancellationToken cancellationToken)
        => Ok(await prestashop.GetLogsAsync(cancellationToken));

    [HttpPost("connections/{id:guid}/sync")]
    [Authorize(Policy = "prestashop.write")]
    public async Task<ActionResult<PrestashopSyncLogDto>> Sync(Guid id, CancellationToken cancellationToken)
    {
        var result = await prestashop.RunManualSyncAsync(id, cancellationToken);
        return result.Succeeded ? Ok(result.Value) : BadRequest(new { error = result.Error });
    }
}

