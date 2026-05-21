using Erp.Application.Treasury;
using Erp.Domain.FutureModules;
using Erp.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Erp.Infrastructure.Services;

public sealed class TreasuryService(ErpDbContext db) : ITreasuryService
{
    private const decimal DefaultVatRate = 20m;

    public async Task<TreasurySummaryDto> GetSummaryAsync(CancellationToken cancellationToken)
    {
        var snapshot = await LoadSnapshotAsync(cancellationToken);
        var generatedAt = DateTimeOffset.UtcNow;
        var today = DateOnly.FromDateTime(generatedAt.UtcDateTime);
        var monthStart = new DateTimeOffset(generatedAt.Year, generatedAt.Month, 1, 0, 0, 0, TimeSpan.Zero);

        var invoiceSalesOrderIds = snapshot.Invoices
            .Where(x => x.SalesOrderId.HasValue && !IsCancelled(x.Status))
            .Select(x => x.SalesOrderId!.Value)
            .ToHashSet();

        var invoicePayments = snapshot.InvoicePayments.Sum(x => x.Amount);
        var paidOrders = snapshot.SalesOrders
            .Where(x => !invoiceSalesOrderIds.Contains(x.Id) && !IsCancelled(x.Status) && (x.PaidTotal ?? 0m) > 0m)
            .Sum(x => x.PaidTotal ?? 0m);

        var cashIn = invoicePayments + paidOrders;
        var committedPurchases = snapshot.PurchaseOrders.Where(x => IsCommittedPurchase(x.Status)).ToList();
        var cashOut = committedPurchases.Sum(snapshot.GetPurchaseGross);

        var vatCollected = snapshot.Invoices
            .Where(x => x.Kind == "Invoice" && !IsCancelled(x.Status))
            .Sum(snapshot.GetInvoiceVat)
            + snapshot.SalesOrders
                .Where(x => !invoiceSalesOrderIds.Contains(x.Id) && !IsCancelled(x.Status) && (x.PaidTotal ?? 0m) > 0m)
                .Sum(x => VatFromGross(x.PaidTotal ?? 0m));
        var vatDeductible = committedPurchases.Sum(snapshot.GetPurchaseVat);
        var vatToPay = Math.Max(0m, vatCollected - vatDeductible);

        var unpaidInvoices = snapshot.Invoices
            .Where(x => x.Kind == "Invoice" && !IsCancelled(x.Status) && !IsPaid(x.Status))
            .ToList();
        var overdueInvoices = unpaidInvoices.Where(x => x.DueDate < today).ToList();
        var unpaidInvoiceAmount = unpaidInvoices.Sum(snapshot.GetInvoiceOpenAmount);
        var overdueInvoiceAmount = overdueInvoices.Sum(snapshot.GetInvoiceOpenAmount);

        var openSalesOrders = snapshot.SalesOrders
            .Where(x => !invoiceSalesOrderIds.Contains(x.Id) && IsOpenSalesOrder(x.Status))
            .ToList();
        var openPurchaseOrders = snapshot.PurchaseOrders
            .Where(x => IsOpenPurchase(x.Status))
            .ToList();
        var expectedIncoming = unpaidInvoiceAmount + openSalesOrders.Sum(snapshot.GetSalesOrderGross);
        var expectedOutgoing = openPurchaseOrders.Sum(snapshot.GetPurchaseGross);

        var monthCashIn = snapshot.InvoicePayments
            .Where(x => ToUtc(x.PaidOn) >= monthStart)
            .Sum(x => x.Amount)
            + snapshot.SalesOrders
                .Where(x => !invoiceSalesOrderIds.Contains(x.Id) && !IsCancelled(x.Status) && (x.PaidTotal ?? 0m) > 0m && (x.OrderedAt ?? x.CreatedAt) >= monthStart)
                .Sum(x => x.PaidTotal ?? 0m);
        var monthCashOut = committedPurchases
            .Where(x => (x.OrderedAt ?? x.ReceivedAt ?? x.CreatedAt) >= monthStart)
            .Sum(snapshot.GetPurchaseGross);

        var availableBalance = cashIn - cashOut - vatToPay;
        var cashForecast = availableBalance + expectedIncoming - expectedOutgoing;

        return new TreasurySummaryDto(
            GeneratedAt: generatedAt,
            AvailableBalance: Round(availableBalance),
            CashIn: Round(cashIn),
            CashOut: Round(cashOut),
            VatCollected: Round(vatCollected),
            VatDeductible: Round(vatDeductible),
            VatToPay: Round(vatToPay),
            UnpaidInvoices: Round(unpaidInvoiceAmount),
            OverdueInvoices: Round(overdueInvoiceAmount),
            ExpectedIncoming: Round(expectedIncoming),
            ExpectedOutgoing: Round(expectedOutgoing),
            OpenSalesOrders: Round(openSalesOrders.Sum(snapshot.GetSalesOrderGross)),
            OpenPurchaseOrders: Round(expectedOutgoing),
            UnpaidInvoiceCount: unpaidInvoices.Count,
            OverdueInvoiceCount: overdueInvoices.Count,
            OpenSalesOrderCount: openSalesOrders.Count,
            OpenPurchaseOrderCount: openPurchaseOrders.Count,
            MonthCashIn: Round(monthCashIn),
            MonthCashOut: Round(monthCashOut),
            NetMonthCash: Round(monthCashIn - monthCashOut),
            CashForecast: Round(cashForecast));
    }

    public async Task<IReadOnlyList<TreasuryMovementDto>> GetMovementsAsync(CancellationToken cancellationToken)
    {
        var snapshot = await LoadSnapshotAsync(cancellationToken);
        var invoiceById = snapshot.Invoices.ToDictionary(x => x.Id);
        var invoiceSalesOrderIds = snapshot.Invoices
            .Where(x => x.SalesOrderId.HasValue && !IsCancelled(x.Status))
            .Select(x => x.SalesOrderId!.Value)
            .ToHashSet();

        var movements = new List<TreasuryMovementDto>();

        foreach (var payment in snapshot.InvoicePayments)
        {
            invoiceById.TryGetValue(payment.InvoiceId, out var invoice);
            movements.Add(new TreasuryMovementDto(
                payment.Id,
                ToUtc(payment.PaidOn),
                $"Paiement facture {invoice?.Number ?? payment.InvoiceId.ToString()}",
                "Factures",
                invoice?.Number ?? payment.InvoiceId.ToString(),
                "In",
                Round(payment.Amount),
                Round(VatFromGross(payment.Amount)),
                invoice?.Status ?? "Paid"));
        }

        foreach (var order in snapshot.SalesOrders.Where(x => !invoiceSalesOrderIds.Contains(x.Id) && !IsCancelled(x.Status) && (x.PaidTotal ?? 0m) > 0m))
        {
            var amount = order.PaidTotal ?? 0m;
            movements.Add(new TreasuryMovementDto(
                order.Id,
                order.OrderedAt ?? order.CreatedAt,
                $"Paiement commande {order.Number}",
                "Commandes",
                order.Number,
                "In",
                Round(amount),
                Round(VatFromGross(amount)),
                order.Status));
        }

        foreach (var invoice in snapshot.Invoices.Where(x => x.Kind == "Invoice" && !IsCancelled(x.Status) && !IsPaid(x.Status)))
        {
            var amount = snapshot.GetInvoiceOpenAmount(invoice);
            if (amount <= 0m)
            {
                continue;
            }

            movements.Add(new TreasuryMovementDto(
                invoice.Id,
                ToUtc(invoice.DueDate),
                $"Facture a encaisser {invoice.Number}",
                "Factures",
                invoice.Number,
                "In",
                Round(amount),
                Round(snapshot.GetInvoiceVat(invoice)),
                invoice.Status));
        }

        foreach (var order in snapshot.SalesOrders.Where(x => !invoiceSalesOrderIds.Contains(x.Id) && IsOpenSalesOrder(x.Status)))
        {
            var amount = snapshot.GetSalesOrderGross(order);
            if (amount <= 0m)
            {
                continue;
            }

            movements.Add(new TreasuryMovementDto(
                order.Id,
                order.OrderedAt ?? order.CreatedAt,
                $"Commande en cours {order.Number}",
                "Commandes",
                order.Number,
                "In",
                Round(amount),
                Round(VatFromGross(amount)),
                order.Status));
        }

        foreach (var purchaseOrder in snapshot.PurchaseOrders.Where(x => IsCommittedPurchase(x.Status) || IsOpenPurchase(x.Status)))
        {
            var amount = snapshot.GetPurchaseGross(purchaseOrder);
            if (amount <= 0m)
            {
                continue;
            }

            movements.Add(new TreasuryMovementDto(
                purchaseOrder.Id,
                purchaseOrder.OrderedAt ?? purchaseOrder.ReceivedAt ?? purchaseOrder.CreatedAt,
                $"Commande fournisseur {purchaseOrder.Number}",
                "Achats",
                purchaseOrder.Number,
                "Out",
                Round(amount),
                Round(snapshot.GetPurchaseVat(purchaseOrder)),
                purchaseOrder.Status));
        }

        return movements
            .OrderByDescending(x => x.Date)
            .ThenBy(x => x.Reference)
            .Take(250)
            .ToList();
    }

    private async Task<TreasurySnapshot> LoadSnapshotAsync(CancellationToken cancellationToken)
    {
        var invoices = await db.Invoices.AsNoTracking().ToListAsync(cancellationToken);
        var invoiceLines = await db.InvoiceLines.AsNoTracking().ToListAsync(cancellationToken);
        var invoicePayments = await db.InvoicePayments.AsNoTracking().ToListAsync(cancellationToken);
        var salesOrders = await db.SalesOrders.AsNoTracking().ToListAsync(cancellationToken);
        var salesOrderLines = await db.SalesOrderLines.AsNoTracking().ToListAsync(cancellationToken);
        var purchaseOrders = await db.PurchaseOrders.AsNoTracking().ToListAsync(cancellationToken);
        var purchaseOrderLines = await db.PurchaseOrderLines.AsNoTracking().ToListAsync(cancellationToken);
        var purchaseOrderCharges = await db.PurchaseOrderCharges.AsNoTracking().ToListAsync(cancellationToken);

        return new TreasurySnapshot(
            invoices,
            invoiceLines,
            invoicePayments,
            salesOrders,
            salesOrderLines,
            purchaseOrders,
            purchaseOrderLines,
            purchaseOrderCharges);
    }

    private static bool IsCancelled(string status) => status.Equals("Cancelled", StringComparison.OrdinalIgnoreCase)
        || status.Equals("Canceled", StringComparison.OrdinalIgnoreCase)
        || status.Equals("Annulee", StringComparison.OrdinalIgnoreCase);

    private static bool IsPaid(string status) => status.Equals("Paid", StringComparison.OrdinalIgnoreCase)
        || status.Equals("Payee", StringComparison.OrdinalIgnoreCase);

    private static bool IsOpenSalesOrder(string status) => !status.Equals("Draft", StringComparison.OrdinalIgnoreCase)
        && !status.Equals("Brouillon", StringComparison.OrdinalIgnoreCase)
        && !status.Equals("Completed", StringComparison.OrdinalIgnoreCase)
        && !status.Equals("Terminee", StringComparison.OrdinalIgnoreCase)
        && !status.Equals("Cancelled", StringComparison.OrdinalIgnoreCase)
        && !status.Equals("Canceled", StringComparison.OrdinalIgnoreCase)
        && !status.Equals("Annulee", StringComparison.OrdinalIgnoreCase);

    private static bool IsOpenPurchase(string status) => status.Equals("Ordered", StringComparison.OrdinalIgnoreCase)
        || status.Equals("PartiallyReceived", StringComparison.OrdinalIgnoreCase);

    private static bool IsCommittedPurchase(string status) => status.Equals("Ordered", StringComparison.OrdinalIgnoreCase)
        || status.Equals("PartiallyReceived", StringComparison.OrdinalIgnoreCase)
        || status.Equals("Received", StringComparison.OrdinalIgnoreCase);

    private static decimal VatFromGross(decimal gross) => gross <= 0m ? 0m : gross * DefaultVatRate / (100m + DefaultVatRate);

    private static DateTimeOffset ToUtc(DateOnly date) => new(date.ToDateTime(TimeOnly.MinValue), TimeSpan.Zero);

    private static decimal Round(decimal amount) => Math.Round(amount, 2, MidpointRounding.AwayFromZero);

    private sealed class TreasurySnapshot(
        IReadOnlyList<Invoice> invoices,
        IReadOnlyList<InvoiceLine> invoiceLines,
        IReadOnlyList<InvoicePayment> invoicePayments,
        IReadOnlyList<SalesOrder> salesOrders,
        IReadOnlyList<SalesOrderLine> salesOrderLines,
        IReadOnlyList<PurchaseOrder> purchaseOrders,
        IReadOnlyList<PurchaseOrderLine> purchaseOrderLines,
        IReadOnlyList<PurchaseOrderCharge> purchaseOrderCharges)
    {
        private readonly Dictionary<Guid, decimal> _invoiceNetTotals = invoiceLines
            .GroupBy(x => x.InvoiceId)
            .ToDictionary(x => x.Key, x => x.Sum(line => line.Quantity * line.UnitPrice));

        private readonly Dictionary<Guid, decimal> _invoicePayments = invoicePayments
            .GroupBy(x => x.InvoiceId)
            .ToDictionary(x => x.Key, x => x.Sum(payment => payment.Amount));

        private readonly Dictionary<Guid, decimal> _salesOrderNetTotals = salesOrderLines
            .GroupBy(x => x.SalesOrderId)
            .ToDictionary(x => x.Key, x => x.Sum(line => line.Quantity * line.UnitPrice));

        private readonly Dictionary<Guid, decimal> _purchaseNetTotals = purchaseOrderLines
            .GroupBy(x => x.PurchaseOrderId)
            .ToDictionary(x => x.Key, x => x.Sum(line => line.Quantity * line.UnitPrice));

        private readonly Dictionary<Guid, decimal> _purchaseVatTotals = purchaseOrderLines
            .GroupBy(x => x.PurchaseOrderId)
            .ToDictionary(x => x.Key, x => x.Sum(line => line.Quantity * line.UnitPrice * line.VatRate / 100m));

        private readonly Dictionary<Guid, decimal> _purchaseChargeTotals = purchaseOrderCharges
            .GroupBy(x => x.PurchaseOrderId)
            .ToDictionary(x => x.Key, x => x.Sum(charge => charge.Amount));

        private readonly Dictionary<Guid, decimal> _purchaseChargeVatTotals = purchaseOrderCharges
            .GroupBy(x => x.PurchaseOrderId)
            .ToDictionary(x => x.Key, x => x.Sum(charge => charge.Amount * charge.VatRate / 100m));

        public IReadOnlyList<Invoice> Invoices { get; } = invoices;

        public IReadOnlyList<InvoicePayment> InvoicePayments { get; } = invoicePayments;

        public IReadOnlyList<SalesOrder> SalesOrders { get; } = salesOrders;

        public IReadOnlyList<PurchaseOrder> PurchaseOrders { get; } = purchaseOrders;

        public decimal GetInvoiceGross(Invoice invoice)
        {
            var net = _invoiceNetTotals.GetValueOrDefault(invoice.Id);
            if (net <= 0m)
            {
                return _invoicePayments.GetValueOrDefault(invoice.Id);
            }

            return invoice.Kind == "CreditNote" ? -WithVat(net, DefaultVatRate) : WithVat(net, DefaultVatRate);
        }

        public decimal GetInvoiceVat(Invoice invoice)
        {
            var net = _invoiceNetTotals.GetValueOrDefault(invoice.Id);
            if (net <= 0m)
            {
                return VatFromGross(_invoicePayments.GetValueOrDefault(invoice.Id));
            }

            var vat = net * DefaultVatRate / 100m;
            return invoice.Kind == "CreditNote" ? -vat : vat;
        }

        public decimal GetInvoiceOpenAmount(Invoice invoice)
        {
            var gross = GetInvoiceGross(invoice);
            var paid = _invoicePayments.GetValueOrDefault(invoice.Id);
            return Math.Max(0m, gross - paid);
        }

        public decimal GetSalesOrderGross(SalesOrder order)
        {
            if ((order.PaidTotal ?? 0m) > 0m)
            {
                return order.PaidTotal!.Value;
            }

            var explicitTotal = (order.ProductsTotal ?? 0m) + (order.ShippingTotal ?? 0m);
            if (explicitTotal > 0m)
            {
                return explicitTotal;
            }

            var net = _salesOrderNetTotals.GetValueOrDefault(order.Id);
            return net > 0m ? WithVat(net, DefaultVatRate) : 0m;
        }

        public decimal GetPurchaseGross(PurchaseOrder purchaseOrder)
        {
            var net = _purchaseNetTotals.GetValueOrDefault(purchaseOrder.Id) + _purchaseChargeTotals.GetValueOrDefault(purchaseOrder.Id);
            return net + GetPurchaseVat(purchaseOrder);
        }

        public decimal GetPurchaseVat(PurchaseOrder purchaseOrder)
        {
            return _purchaseVatTotals.GetValueOrDefault(purchaseOrder.Id) + _purchaseChargeVatTotals.GetValueOrDefault(purchaseOrder.Id);
        }

        private static decimal WithVat(decimal net, decimal vatRate) => net + net * vatRate / 100m;
    }
}
