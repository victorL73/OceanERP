namespace Erp.Application.Dashboard;

public sealed record DashboardSummaryDto(
    decimal MonthlyRevenue,
    int PendingQuotes,
    int UnpaidInvoices,
    int OpenOrders,
    int LowStockItems,
    int OpenServiceTickets,
    int NewEmails,
    int RecentDocuments);

