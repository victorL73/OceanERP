using Erp.Application.Stock;
using Erp.Domain.Notifications;
using Erp.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Erp.Infrastructure.Services;

public sealed class LowStockAlertService(ErpDbContext db) : ILowStockAlertService
{
    private const string NotificationType = "stock.low.summary";
    private static readonly string[] ActivePurchaseStatuses = ["Ordered", "PartiallyReceived"];

    public async Task CheckAndNotifyAsync(CancellationToken cancellationToken)
    {
        var coveredProductIds = await db.PurchaseOrderLines
            .Join(db.PurchaseOrders, line => line.PurchaseOrderId, order => order.Id, (line, order) => new { line, order })
            .Where(x => x.line.ProductId.HasValue
                && x.line.Quantity > x.line.ReceivedQuantity
                && ActivePurchaseStatuses.Contains(x.order.Status))
            .Select(x => x.line.ProductId!.Value)
            .Distinct()
            .ToListAsync(cancellationToken);

        var coveredSet = coveredProductIds.ToHashSet();
        var lowStockProductIds = await db.StockItems
            .Join(db.Products, item => item.ProductId, product => product.Id, (item, product) => new { item, product })
            .Where(x => x.product.IsActive
                && x.item.AlertThreshold > 0
                && x.item.QuantityOnHand - x.item.QuantityReserved <= x.item.AlertThreshold)
            .Select(x => x.item.ProductId)
            .Distinct()
            .ToListAsync(cancellationToken);

        var start = DateTimeOffset.UtcNow.Date;
        var end = start.AddDays(1);

        var notification = await db.Notifications
            .FirstOrDefaultAsync(x => x.Type == NotificationType && x.UserId == null && x.CreatedAt >= start && x.CreatedAt < end, cancellationToken);

        var productIds = lowStockProductIds.Where(x => !coveredSet.Contains(x)).ToList();
        if (productIds.Count == 0)
        {
            if (notification is not null && !notification.IsRead)
            {
                notification.IsRead = true;
                notification.Message = "Tous les produits sous seuil sont couverts ou resolus.";
                await db.SaveChangesAsync(cancellationToken);
            }

            return;
        }

        var products = await db.Products
            .Where(x => productIds.Contains(x.Id) && x.IsActive)
            .OrderBy(x => x.Reference)
            .Select(x => new { x.Id, x.Reference, x.Name })
            .ToListAsync(cancellationToken);

        var orderedIds = products.Select(x => x.Id).ToList();
        var preview = string.Join(", ", products.Take(6).Select(x => x.Reference));
        var remaining = products.Count > 6 ? $" (+{products.Count - 6})" : string.Empty;
        var message = $"{products.Count} reference(s) sous le seuil sans commande fournisseur en cours: {preview}{remaining}.";
        var link = $"/stock?alert=low-uncovered&products={Uri.EscapeDataString(string.Join(",", orderedIds))}";

        if (notification is null)
        {
            db.Notifications.Add(new Notification
            {
                Type = NotificationType,
                Title = "Stock bas a traiter",
                Message = message,
                LinkUrl = link
            });
        }
        else
        {
            notification.Title = "Stock bas a traiter";
            notification.Message = message;
            notification.LinkUrl = link;
            notification.IsRead = false;
        }

        await db.SaveChangesAsync(cancellationToken);
    }
}
