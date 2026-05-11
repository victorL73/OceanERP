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

        return new DashboardSummaryDto(
            MonthlyRevenue: 0,
            PendingQuotes: pendingQuotes,
            UnpaidInvoices: 0,
            OpenOrders: 0,
            LowStockItems: 0,
            OpenServiceTickets: 0,
            NewEmails: newNotifications,
            RecentDocuments: recentDocuments);
    }
}

