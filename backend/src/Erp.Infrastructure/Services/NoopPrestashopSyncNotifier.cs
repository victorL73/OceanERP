using Erp.Application.Prestashop;

namespace Erp.Infrastructure.Services;

internal sealed class NoopPrestashopSyncNotifier : IPrestashopSyncNotifier
{
    public Task NotifyNewOrdersAsync(Guid connectionId, string shopUrl, IReadOnlyList<PrestashopImportedOrderNotification> orders, CancellationToken cancellationToken)
        => Task.CompletedTask;
}
