using Erp.Application.Common;

namespace Erp.Application.Flowcean;

public sealed record FlowceanWorkspaceSummaryDto(Guid Id, string Slug, string Name, int Version, bool IsPersonal, DateTimeOffset CreatedAt, DateTimeOffset? UpdatedAt);
public sealed record FlowceanWorkspaceDto(Guid Id, string Slug, string Name, int Version, bool IsPersonal, string DataJson, DateTimeOffset CreatedAt, DateTimeOffset? UpdatedAt);
public sealed record CreateFlowceanWorkspaceRequest(string Name);
public sealed record SaveFlowceanWorkspaceRequest(string DataJson, int Version, string? EventType = null);

public interface IFlowceanService
{
    Task<PagedResult<FlowceanWorkspaceSummaryDto>> SearchAsync(CancellationToken cancellationToken);
    Task<Result<FlowceanWorkspaceDto>> GetAsync(string slug, CancellationToken cancellationToken);
    Task<Result<FlowceanWorkspaceDto>> CreateAsync(CreateFlowceanWorkspaceRequest request, CancellationToken cancellationToken);
    Task<Result<FlowceanWorkspaceDto>> SaveAsync(string slug, SaveFlowceanWorkspaceRequest request, CancellationToken cancellationToken);
}
