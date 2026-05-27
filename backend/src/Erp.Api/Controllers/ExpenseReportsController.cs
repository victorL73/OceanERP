using Erp.Application.ExpenseReports;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Erp.Api.Controllers;

[ApiController]
[Route("api/expense-reports")]
[Authorize]
public sealed class ExpenseReportsController(IExpenseReportService expenseReports) : ControllerBase
{
    [HttpGet]
    [Authorize(Policy = "expenses.read")]
    public async Task<ActionResult<IReadOnlyList<ExpenseReportDto>>> List(CancellationToken cancellationToken)
    {
        return Ok(await expenseReports.ListAsync(cancellationToken));
    }

    [HttpGet("{id:guid}")]
    [Authorize(Policy = "expenses.read")]
    public async Task<ActionResult<ExpenseReportDto>> Get(Guid id, CancellationToken cancellationToken)
    {
        var result = await expenseReports.GetAsync(id, cancellationToken);
        return result.Succeeded ? Ok(result.Value) : NotFound(new { message = result.Error });
    }

    [HttpPost]
    [Authorize(Policy = "expenses.write")]
    public async Task<ActionResult<ExpenseReportDto>> Create(CreateExpenseReportRequest request, CancellationToken cancellationToken)
    {
        var result = await expenseReports.CreateAsync(request, cancellationToken);
        return result.Succeeded
            ? CreatedAtAction(nameof(Get), new { id = result.Value!.Id }, result.Value)
            : BadRequest(new { message = result.Error });
    }

    [HttpPut("{id:guid}")]
    [Authorize(Policy = "expenses.write")]
    public async Task<ActionResult<ExpenseReportDto>> Update(Guid id, UpdateExpenseReportRequest request, CancellationToken cancellationToken)
    {
        var result = await expenseReports.UpdateAsync(id, request, cancellationToken);
        return result.Succeeded ? Ok(result.Value) : BadRequest(new { message = result.Error });
    }

    [HttpPost("{id:guid}/status")]
    [Authorize(Policy = "expenses.approve")]
    public async Task<ActionResult<ExpenseReportDto>> ChangeStatus(Guid id, ChangeExpenseReportStatusRequest request, CancellationToken cancellationToken)
    {
        var result = await expenseReports.ChangeStatusAsync(id, request, cancellationToken);
        return result.Succeeded ? Ok(result.Value) : BadRequest(new { message = result.Error });
    }
}
