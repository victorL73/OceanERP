using Erp.Application.Dashboard;
using Erp.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Erp.Infrastructure.Services;

public sealed class DashboardService(ErpDbContext db) : IDashboardService
{
    public async Task<DashboardSummaryDto> GetSummaryAsync(CancellationToken cancellationToken)
    {
        var pendingQuotes = await db.Quotes.CountAsync(x => x.Status == Erp.Domain.Quotes.QuoteStatus.Draft || x.Status == Erp.Domain.Quotes.QuoteStatus.Sent, cancellationToken);
        var recentDocuments = await db.DriveItems.CountAsync(x => !x.IsTrashed, cancellationToken);
        var newNotifications = await db.Notifications.CountAsync(x => !x.IsRead, cancellationToken);
        var openOrders = await db.SalesOrders.CountAsync(x => x.Status != "Completed" && x.Status != "Cancelled", cancellationToken);
        var unpaidInvoices = await db.Invoices.CountAsync(x => x.Status != "Paid" && x.Status != "Cancelled", cancellationToken);
        var lowStock = await db.StockItems.CountAsync(x => x.QuantityOnHand <= x.AlertThreshold, cancellationToken);
        var newEmails = await db.EmailMessages.CountAsync(cancellationToken);

        return new DashboardSummaryDto(
            MonthlyRevenue: 0,
            PendingQuotes: pendingQuotes,
            UnpaidInvoices: unpaidInvoices,
            OpenOrders: openOrders,
            LowStockItems: lowStock,
            OpenServiceTickets: 0,
            NewEmails: newEmails + newNotifications,
            RecentDocuments: recentDocuments);
    }
}
