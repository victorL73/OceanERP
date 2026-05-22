using Erp.Application.Notifications;
using Erp.Application.Prestashop;
using Erp.Api.Hubs;
using Erp.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.AspNetCore.SignalR;

namespace Erp.Api.Services;

public sealed class PrestashopRealtimeSyncNotifier(IRealtimeNotificationPublisher publisher, IHubContext<NotificationHub> hubContext, ErpDbContext db) : IPrestashopSyncNotifier
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
        var linkUrl = $"/orders?search={Uri.EscapeDataString(orderNumbers)}";

        await publisher.PublishAsync(new CreateNotificationRequest(null, "prestashop.orders.new", title, message, linkUrl), cancellationToken);
    }

    public async Task NotifyNewServiceMessagesAsync(Guid connectionId, string shopUrl, IReadOnlyList<PrestashopImportedServiceTicketNotification> tickets, CancellationToken cancellationToken)
    {
        if (tickets.Count == 0)
        {
            return;
        }

        var title = tickets.Count == 1 ? "Nouveau message SAV PrestaShop" : "Nouveaux messages SAV PrestaShop";
        var initialResponders = await db.ServiceTicketInitialResponders
            .Select(x => x.UserId)
            .ToListAsync(cancellationToken);

        foreach (var ticket in tickets)
        {
            var assignedUserId = await db.ServiceTickets
                .Where(x => x.Id == ticket.ServiceTicketId)
                .Select(x => x.AssignedUserId)
                .FirstOrDefaultAsync(cancellationToken);

            var message = $"{ticket.Number} - {ticket.Subject}: {ticket.NewMessages} nouveau(x) message(s) depuis {shopUrl}.";
            var linkUrl = $"/service?search={Uri.EscapeDataString($"{ticket.Number} {ticket.Subject}")}";
            await PublishServiceNotificationAsync(assignedUserId, initialResponders, title, message, linkUrl, cancellationToken);
        }
    }

    public async Task NotifySyncCompletedAsync(PrestashopSyncCompletedEvent syncEvent, CancellationToken cancellationToken)
    {
        if (syncEvent.Resources.Count == 0)
        {
            return;
        }

        await hubContext.Clients.All.SendAsync("prestashopSyncCompleted", syncEvent, cancellationToken);
    }

    private async Task PublishServiceNotificationAsync(Guid? assignedUserId, IReadOnlyList<Guid> initialResponders, string title, string message, string linkUrl, CancellationToken cancellationToken)
    {
        if (assignedUserId.HasValue)
        {
            await publisher.PublishAsync(new CreateNotificationRequest(assignedUserId.Value, "service.prestashop.new", title, message, linkUrl), cancellationToken);
            return;
        }

        if (initialResponders.Count == 0)
        {
            await publisher.PublishAsync(new CreateNotificationRequest(null, "service.prestashop.new", title, message, linkUrl), cancellationToken);
            return;
        }

        foreach (var userId in initialResponders.Distinct())
        {
            await publisher.PublishAsync(new CreateNotificationRequest(userId, "service.prestashop.new", title, message, linkUrl), cancellationToken);
        }
    }
}
