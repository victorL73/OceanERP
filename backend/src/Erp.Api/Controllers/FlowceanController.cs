using Erp.Application.Flowcean;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Erp.Api.Controllers;

[ApiController]
[Route("api/flowcean/workspaces")]
[Authorize]
public sealed class FlowceanController(IFlowceanService flowcean) : ControllerBase
{
    [HttpGet]
    [Authorize(Policy = "flowcean.read")]
    public async Task<ActionResult> Search(CancellationToken cancellationToken)
        => Ok(await flowcean.SearchAsync(cancellationToken));

    [HttpGet("{slug}")]
    [Authorize(Policy = "flowcean.read")]
    public async Task<ActionResult<FlowceanWorkspaceDto>> Get(string slug, CancellationToken cancellationToken)
    {
        var result = await flowcean.GetAsync(slug, cancellationToken);
        return result.Succeeded ? Ok(result.Value) : NotFound(new { error = result.Error });
    }

    [HttpPost]
    [Authorize(Policy = "flowcean.write")]
    public async Task<ActionResult<FlowceanWorkspaceDto>> Create(CreateFlowceanWorkspaceRequest request, CancellationToken cancellationToken)
    {
        var result = await flowcean.CreateAsync(request, cancellationToken);
        return result.Succeeded
            ? CreatedAtAction(nameof(Get), new { slug = result.Value!.Slug }, result.Value)
            : BadRequest(new { error = result.Error });
    }

    [HttpPut("{slug}")]
    [Authorize(Policy = "flowcean.write")]
    public async Task<ActionResult<FlowceanWorkspaceDto>> Save(string slug, SaveFlowceanWorkspaceRequest request, CancellationToken cancellationToken)
    {
        var result = await flowcean.SaveAsync(slug, request, cancellationToken);
        return result.Succeeded ? Ok(result.Value) : BadRequest(new { error = result.Error });
    }
}
