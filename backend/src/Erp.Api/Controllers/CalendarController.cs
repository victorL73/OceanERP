using Erp.Application.Calendar;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Erp.Api.Controllers;

[ApiController]
[Route("api/calendar/events")]
[Authorize]
public sealed class CalendarController(ICalendarService calendar) : ControllerBase
{
    [HttpGet]
    [Authorize(Policy = "calendar.read")]
    public async Task<ActionResult> Search([FromQuery] DateTimeOffset? from, [FromQuery] DateTimeOffset? to, [FromQuery] int page = 1, [FromQuery] int pageSize = 100, CancellationToken cancellationToken = default)
        => Ok(await calendar.SearchAsync(from, to, page, pageSize, cancellationToken));

    [HttpGet("{id:guid}")]
    [Authorize(Policy = "calendar.read")]
    public async Task<ActionResult<CalendarEventDto>> Get(Guid id, CancellationToken cancellationToken)
    {
        var result = await calendar.GetAsync(id, cancellationToken);
        return result.Succeeded ? Ok(result.Value) : NotFound(new { error = result.Error });
    }

    [HttpPost]
    [Authorize(Policy = "calendar.write")]
    public async Task<ActionResult<CalendarEventDto>> Create(CreateCalendarEventRequest request, CancellationToken cancellationToken)
    {
        var result = await calendar.CreateAsync(request, cancellationToken);
        return result.Succeeded ? CreatedAtAction(nameof(Get), new { id = result.Value!.Id }, result.Value) : BadRequest(new { error = result.Error });
    }

    [HttpPut("{id:guid}")]
    [Authorize(Policy = "calendar.write")]
    public async Task<ActionResult<CalendarEventDto>> Update(Guid id, UpdateCalendarEventRequest request, CancellationToken cancellationToken)
    {
        var result = await calendar.UpdateAsync(id, request, cancellationToken);
        return result.Succeeded ? Ok(result.Value) : BadRequest(new { error = result.Error });
    }

    [HttpDelete("{id:guid}")]
    [Authorize(Policy = "calendar.write")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken cancellationToken)
    {
        var result = await calendar.DeleteAsync(id, cancellationToken);
        return result.Succeeded ? NoContent() : NotFound(new { error = result.Error });
    }
}
