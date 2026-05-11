using Erp.Application.Stock;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Erp.Api.Controllers;

[ApiController]
[Route("api/stock")]
[Authorize]
public sealed class StockController(IStockService stock) : ControllerBase
{
    [HttpGet("warehouses")]
    [Authorize(Policy = "stock.read")]
    public async Task<ActionResult<IReadOnlyList<WarehouseDto>>> Warehouses(CancellationToken cancellationToken)
        => Ok(await stock.GetWarehousesAsync(cancellationToken));

    [HttpPost("warehouses")]
    [Authorize(Policy = "stock.write")]
    public async Task<ActionResult<WarehouseDto>> CreateWarehouse(CreateWarehouseRequest request, CancellationToken cancellationToken)
    {
        var result = await stock.CreateWarehouseAsync(request, cancellationToken);
        return result.Succeeded ? Ok(result.Value) : BadRequest(new { error = result.Error });
    }

    [HttpGet("items")]
    [Authorize(Policy = "stock.read")]
    public async Task<ActionResult<IReadOnlyList<StockItemDto>>> Items(CancellationToken cancellationToken)
        => Ok(await stock.GetStockItemsAsync(cancellationToken));

    [HttpGet("movements")]
    [Authorize(Policy = "stock.read")]
    public async Task<ActionResult<IReadOnlyList<StockMovementDto>>> Movements([FromQuery] Guid? productId, CancellationToken cancellationToken)
        => Ok(await stock.GetMovementsAsync(productId, cancellationToken));

    [HttpPost("adjustments")]
    [Authorize(Policy = "stock.write")]
    public async Task<ActionResult<StockMovementDto>> Adjust(AdjustStockRequest request, CancellationToken cancellationToken)
    {
        var result = await stock.AdjustAsync(request, cancellationToken);
        return result.Succeeded ? Ok(result.Value) : BadRequest(new { error = result.Error });
    }
}
