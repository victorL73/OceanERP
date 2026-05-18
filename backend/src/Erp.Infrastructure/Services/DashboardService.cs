using Erp.Application.Dashboard;
using Erp.Domain.Quotes;
using Erp.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Erp.Infrastructure.Services;

public sealed class DashboardService(ErpDbContext db) : IDashboardService
{
    public async Task<DashboardSummaryDto> GetSummaryAsync(CancellationToken cancellationToken)
    {
        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var soon = today.AddDays(7);
        var recentSince = DateTimeOffset.UtcNow.AddDays(-7);
        var activePurchaseStatuses = new[] { "Ordered", "PartiallyReceived" };

        var pendingQuotes = await db.Quotes.CountAsync(x => x.Status == QuoteStatus.Draft || x.Status == QuoteStatus.Sent, cancellationToken);
        var draftQuotes = await db.Quotes.CountAsync(x => x.Status == QuoteStatus.Draft, cancellationToken);
        var sentQuotes = await db.Quotes.CountAsync(x => x.Status == QuoteStatus.Sent, cancellationToken);
        var signedQuotes = await db.Quotes.CountAsync(x => x.Status == QuoteStatus.Signed, cancellationToken);
        var expiredQuotes = await db.Quotes.CountAsync(x => x.Status == QuoteStatus.Expired, cancellationToken);
        var quotesToExpireSoon = await db.Quotes.CountAsync(x => (x.Status == QuoteStatus.Draft || x.Status == QuoteStatus.Sent) && x.ValidUntil <= soon, cancellationToken);
        var pendingQuoteAmount = await db.Quotes.Where(x => x.Status == QuoteStatus.Draft || x.Status == QuoteStatus.Sent).SumAsync(x => x.Total, cancellationToken);

        var recentDocuments = await db.DriveItems.CountAsync(x => !x.IsTrashed && x.CreatedAt >= recentSince, cancellationToken);
        var totalDocuments = await db.DriveItems.CountAsync(x => !x.IsTrashed, cancellationToken);
        var trashedDocuments = await db.DriveItems.CountAsync(x => x.IsTrashed, cancellationToken);
        var newNotifications = await db.Notifications.CountAsync(x => !x.IsRead, cancellationToken);
        var openOrders = await db.SalesOrders.CountAsync(x => x.Status != "Completed" && x.Status != "Cancelled", cancellationToken);
        var draftOrders = await db.SalesOrders.CountAsync(x => x.Status == "Draft", cancellationToken);
        var confirmedOrders = await db.SalesOrders.CountAsync(x => x.Status == "Confirmed", cancellationToken);
        var preparingOrders = await db.SalesOrders.CountAsync(x => x.Status == "Preparing", cancellationToken);
        var shippedOrders = await db.SalesOrders.CountAsync(x => x.Status == "Shipped", cancellationToken);
        var openPurchaseOrders = await db.PurchaseOrders.CountAsync(x => activePurchaseStatuses.Contains(x.Status), cancellationToken);
        var purchaseOrdersExpectedSoon = await db.PurchaseOrders.CountAsync(x => activePurchaseStatuses.Contains(x.Status) && x.ExpectedAt.HasValue && x.ExpectedAt.Value <= soon, cancellationToken);
        var unpaidInvoices = await db.Invoices.CountAsync(x => x.Kind == "Invoice" && x.Status != "Paid" && x.Status != "Cancelled", cancellationToken);
        var overdueInvoices = await db.Invoices.CountAsync(x => x.Kind == "Invoice" && x.Status != "Paid" && x.Status != "Cancelled" && x.DueDate < today, cancellationToken);
        var lowStock = await db.StockItems
            .Join(db.Products, item => item.ProductId, product => product.Id, (item, product) => new { item, product })
            .CountAsync(x => x.product.IsActive && x.item.AlertThreshold > 0 && x.item.QuantityOnHand - x.item.QuantityReserved <= x.item.AlertThreshold, cancellationToken);
        var outOfStock = await db.StockItems
            .Join(db.Products, item => item.ProductId, product => product.Id, (item, product) => new { item, product })
            .CountAsync(x => x.product.IsActive && x.item.QuantityOnHand - x.item.QuantityReserved <= 0, cancellationToken);
        var stockQuantityOnHand = await db.StockItems.SumAsync(x => x.QuantityOnHand, cancellationToken);
        var stockQuantityReserved = await db.StockItems.SumAsync(x => x.QuantityReserved, cancellationToken);
        var openServiceTickets = await db.ServiceTickets.CountAsync(x => x.Status != "Resolved" && x.Status != "Closed", cancellationToken);
        var newEmails = await db.EmailMessages.CountAsync(x => !x.IsDeleted && !x.IsRead, cancellationToken);
        var monthStart = new DateOnly(DateTime.UtcNow.Year, DateTime.UtcNow.Month, 1);
        var monthlyRevenue = await db.InvoicePayments.Where(x => x.PaidOn >= monthStart).SumAsync(x => x.Amount, cancellationToken);
        var totalCustomers = await db.Customers.CountAsync(cancellationToken);
        var activeCustomers = await db.Customers.CountAsync(x => x.IsActive, cancellationToken);
        var totalProducts = await db.Products.CountAsync(cancellationToken);
        var activeProducts = await db.Products.CountAsync(x => x.IsActive, cancellationToken);
        var inactiveProducts = await db.Products.CountAsync(x => !x.IsActive, cancellationToken);
        var suppliers = await db.ProductSuppliers.CountAsync(cancellationToken);
        var warehouses = await db.Warehouses.CountAsync(cancellationToken);
        var mailAccounts = await db.MailAccounts.CountAsync(cancellationToken);
        var activePrestashopConnections = await db.PrestashopConnections.CountAsync(x => x.IsActive, cancellationToken);

        return new DashboardSummaryDto(
            MonthlyRevenue: monthlyRevenue,
            PendingQuotes: pendingQuotes,
            DraftQuotes: draftQuotes,
            SentQuotes: sentQuotes,
            SignedQuotes: signedQuotes,
            ExpiredQuotes: expiredQuotes,
            QuotesToExpireSoon: quotesToExpireSoon,
            PendingQuoteAmount: pendingQuoteAmount,
            UnpaidInvoices: unpaidInvoices,
            OverdueInvoices: overdueInvoices,
            OpenOrders: openOrders,
            DraftOrders: draftOrders,
            ConfirmedOrders: confirmedOrders,
            PreparingOrders: preparingOrders,
            ShippedOrders: shippedOrders,
            OpenPurchaseOrders: openPurchaseOrders,
            PurchaseOrdersExpectedSoon: purchaseOrdersExpectedSoon,
            LowStockItems: lowStock,
            OutOfStockItems: outOfStock,
            StockQuantityOnHand: stockQuantityOnHand,
            StockQuantityReserved: stockQuantityReserved,
            OpenServiceTickets: openServiceTickets,
            NewEmails: newEmails,
            UnreadNotifications: newNotifications,
            RecentDocuments: recentDocuments,
            TotalDocuments: totalDocuments,
            TrashedDocuments: trashedDocuments,
            TotalCustomers: totalCustomers,
            ActiveCustomers: activeCustomers,
            TotalProducts: totalProducts,
            ActiveProducts: activeProducts,
            InactiveProducts: inactiveProducts,
            Suppliers: suppliers,
            Warehouses: warehouses,
            MailAccounts: mailAccounts,
            ActivePrestashopConnections: activePrestashopConnections);
    }
}
