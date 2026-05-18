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

    public async Task NotifyNewServiceMessagesAsync(Guid connectionId, string shopUrl, IReadOnlyList<PrestashopImportedServiceTicketNotification> tickets, CancellationToken cancellationToken)
    {
        if (tickets.Count == 0)
        {
            return;
        }

        var messageCount = tickets.Sum(x => x.NewMessages);
        var title = tickets.Count == 1 ? "Nouveau message SAV PrestaShop" : "Nouveaux messages SAV PrestaShop";
        var ticketNumbers = string.Join(", ", tickets.Select(x => x.Number).Take(5));
        var suffix = tickets.Count > 5 ? $" et {tickets.Count - 5} autre(s)" : string.Empty;
        var message = tickets.Count == 1
            ? $"{messageCount} message(s) recu(s) sur {ticketNumbers} depuis {shopUrl}."
            : $"{messageCount} message(s) recu(s) sur {tickets.Count} tickets depuis {shopUrl}: {ticketNumbers}{suffix}.";

        await publisher.PublishAsync(new CreateNotificationRequest(null, "service.prestashop.new", title, message, "/service"), cancellationToken);
    }
}
