using Erp.Application.Common;
using Erp.Application.Invoices;
using Erp.Domain.FutureModules;
using Erp.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Erp.Infrastructure.Services;

public sealed class InvoiceService(ErpDbContext db) : IInvoiceService
{
    public async Task<PagedResult<InvoiceDto>> SearchAsync(int page, int pageSize, CancellationToken cancellationToken)
    {
        page = Math.Max(1, page);
        pageSize = Math.Clamp(pageSize, 1, 100);
        var total = await db.Invoices.CountAsync(cancellationToken);
        var invoices = await db.Invoices.OrderByDescending(x => x.CreatedAt).Skip((page - 1) * pageSize).Take(pageSize).ToListAsync(cancellationToken);
        var items = new List<InvoiceDto>();
        foreach (var invoice in invoices)
        {
            items.Add(await MapAsync(invoice, cancellationToken));
        }
        return new PagedResult<InvoiceDto>(items, total, page, pageSize);
    }

    public async Task<Result<InvoiceDto>> GetAsync(Guid id, CancellationToken cancellationToken)
    {
        var invoice = await db.Invoices.FirstOrDefaultAsync(x => x.Id == id, cancellationToken);
        return invoice is null ? Result<InvoiceDto>.Failure("Invoice not found.") : Result<InvoiceDto>.Success(await MapAsync(invoice, cancellationToken));
    }

    public async Task<Result<InvoiceDto>> CreateFromOrderAsync(CreateInvoiceFromOrderRequest request, CancellationToken cancellationToken)
    {
        var order = await db.SalesOrders.FirstOrDefaultAsync(x => x.Id == request.SalesOrderId, cancellationToken);
        if (order is null)
        {
            return Result<InvoiceDto>.Failure("Sales order not found.");
        }

        var orderLines = await db.SalesOrderLines.Where(x => x.SalesOrderId == order.Id).ToListAsync(cancellationToken);
        if (orderLines.Count == 0)
        {
            return Result<InvoiceDto>.Failure("Sales order has no lines.");
        }

        var invoice = new Invoice
        {
            Number = await NextNumberAsync(cancellationToken),
            CustomerId = order.CustomerId,
            Status = "Issued"
        };
        db.Invoices.Add(invoice);
        foreach (var line in orderLines)
        {
            db.InvoiceLines.Add(new InvoiceLine { InvoiceId = invoice.Id, Description = line.Description, Quantity = line.Quantity, UnitPrice = line.UnitPrice });
        }
        db.InvoiceStatusHistories.Add(new InvoiceStatusHistory { InvoiceId = invoice.Id, Status = invoice.Status });
        await db.SaveChangesAsync(cancellationToken);
        return Result<InvoiceDto>.Success(await MapAsync(invoice, cancellationToken));
    }

    public async Task<Result<InvoiceDto>> AddPaymentAsync(Guid invoiceId, AddInvoicePaymentRequest request, CancellationToken cancellationToken)
    {
        var invoice = await db.Invoices.FirstOrDefaultAsync(x => x.Id == invoiceId, cancellationToken);
        if (invoice is null)
        {
            return Result<InvoiceDto>.Failure("Invoice not found.");
        }

        db.InvoicePayments.Add(new InvoicePayment { InvoiceId = invoiceId, Amount = request.Amount, PaidOn = request.PaidOn });
        await db.SaveChangesAsync(cancellationToken);

        var dto = await MapAsync(invoice, cancellationToken);
        var paid = await db.InvoicePayments.Where(x => x.InvoiceId == invoiceId).SumAsync(x => x.Amount, cancellationToken);
        invoice.Status = paid >= dto.Total ? "Paid" : "PartiallyPaid";
        db.InvoiceStatusHistories.Add(new InvoiceStatusHistory { InvoiceId = invoice.Id, Status = invoice.Status });
        await db.SaveChangesAsync(cancellationToken);
        return Result<InvoiceDto>.Success(await MapAsync(invoice, cancellationToken));
    }

    private async Task<string> NextNumberAsync(CancellationToken cancellationToken)
    {
        var prefix = $"FAC-{DateTime.UtcNow:yyyy}-";
        var count = await db.Invoices.CountAsync(x => x.Number.StartsWith(prefix), cancellationToken);
        return $"{prefix}{count + 1:0000}";
    }

    private async Task<InvoiceDto> MapAsync(Invoice invoice, CancellationToken cancellationToken)
    {
        var lines = await db.InvoiceLines.Where(x => x.InvoiceId == invoice.Id).OrderBy(x => x.Id).ToListAsync(cancellationToken);
        var lineDtos = lines.Select(x => new InvoiceLineDto(x.Id, x.Description, x.Quantity, x.UnitPrice)).ToList();
        var total = lines.Sum(x => x.Quantity * x.UnitPrice);
        return new InvoiceDto(invoice.Id, invoice.Number, invoice.CustomerId, invoice.Status, total, lineDtos);
    }
}

