using Erp.Application.Treasury;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Erp.Api.Controllers;

[ApiController]
[Route("api/treasury")]
[Authorize]
public sealed class TreasuryController(ITreasuryService treasury) : ControllerBase
{
    [HttpGet("summary")]
    [Authorize(Policy = "treasury.read")]
    public async Task<ActionResult<TreasurySummaryDto>> Summary(CancellationToken cancellationToken)
    {
        return Ok(await treasury.GetSummaryAsync(cancellationToken));
    }

    [HttpGet("movements")]
    [Authorize(Policy = "treasury.read")]
    public async Task<ActionResult<IReadOnlyList<TreasuryMovementDto>>> Movements(CancellationToken cancellationToken)
    {
        return Ok(await treasury.GetMovementsAsync(cancellationToken));
    }
}
