using Erp.Application.Common;

namespace Erp.Application.Prestashop;

public interface IPrestashopService
{
    Task<IReadOnlyList<PrestashopConnectionDto>> GetConnectionsAsync(CancellationToken cancellationToken);
    Task<Result<PrestashopConnectionDto>> CreateConnectionAsync(CreatePrestashopConnectionRequest request, CancellationToken cancellationToken);
    Task<Result<PrestashopConnectionDto>> UpdateConnectionAsync(Guid connectionId, UpdatePrestashopConnectionRequest request, CancellationToken cancellationToken);
    Task<IReadOnlyList<PrestashopSyncLogDto>> GetLogsAsync(CancellationToken cancellationToken);
    Task<Result<PrestashopSyncLogDto>> RunManualSyncAsync(Guid connectionId, CancellationToken cancellationToken);
    Task<Result<string?>> PublishServiceTicketMessageAsync(Guid serviceTicketId, string body, CancellationToken cancellationToken);
    Task<Result> CloseServiceTicketThreadAsync(Guid serviceTicketId, CancellationToken cancellationToken);
}
