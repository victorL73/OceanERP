using Erp.Application.Notifications;
using Erp.Application.Prestashop;

namespace Erp.Api.Services;

public sealed class PrestashopRealtimeSyncNotifier(IRealtimeNotificationPublisher publisher) : IPrestashopSyncNotifier
{
    public async Task NotifyNewOrdersAsync(Guid connectionId, string shopUrl, IReadOnlyList<PrestashopImportedOrderNotification> orders, CancellationToken cancellationToken)
    {
        if (orders.Count == 0)
        {
            return;
        }

        var title = orders.Count == 1 ? "Nouvelle commande PrestaShop" : "Nouvelles commandes PrestaShop";
        var orderNumbers = string.Join(", ", orders.Select(x => x.Number).Take(5));
        var suffix = orders.Count > 5 ? $" et {orders.Count - 5} autre(s)" : string.Empty;
        var message = orders.Count == 1
            ? $"La commande {orderNumbers} est descendue depuis {shopUrl}."
            : $"{orders.Count} commandes sont descendues depuis {shopUrl}: {orderNumbers}{suffix}.";

        await publisher.PublishAsync(new CreateNotificationRequest(null, "prestashop.orders.new", title, message, "/orders"), cancellationToken);
    }
}
