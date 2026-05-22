namespace Erp.Application.Treasury;

public sealed record TreasurySummaryDto(
    DateTimeOffset GeneratedAt,
    decimal AvailableBalance,
    decimal CashIn,
    decimal CashOut,
    decimal VatCollected,
    decimal VatDeductible,
    decimal VatToPay,
    decimal UnpaidInvoices,
    decimal OverdueInvoices,
    decimal ExpectedIncoming,
    decimal ExpectedOutgoing,
    decimal OpenSalesOrders,
    decimal OpenPurchaseOrders,
    int UnpaidInvoiceCount,
    int OverdueInvoiceCount,
    int OpenSalesOrderCount,
    int OpenPurchaseOrderCount,
    decimal MonthCashIn,
    decimal MonthCashOut,
    decimal NetMonthCash,
    decimal CashForecast);

public sealed record TreasuryMovementDto(
    Guid Id,
    DateTimeOffset Date,
    string Label,
    string Module,
    string Reference,
    string Direction,
    decimal Amount,
    decimal VatAmount,
    string Status,
    string Category,
    string? Notes);

public sealed record TreasuryManualEntryCreateDto(
    string Label,
    string Direction,
    decimal Amount,
    decimal VatAmount,
    DateOnly OccurredOn,
    string? Note);
