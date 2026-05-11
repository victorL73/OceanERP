using Erp.Application.Common;
using Erp.Application.Documents;
using Erp.Application.Invoices;
using Erp.Domain.FutureModules;
using Erp.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Erp.Infrastructure.Services;

public sealed class InvoiceService(
    ErpDbContext db,
    IInvoicePdfService invoicePdfService,
    IFileStorageService fileStorageService) : IInvoiceService
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

        if (order.Status is not ("Shipped" or "Completed"))
        {
            return Result<InvoiceDto>.Failure("Only shipped or completed orders can be invoiced.");
        }

        if (await db.Invoices.AnyAsync(x => x.SalesOrderId == order.Id, cancellationToken))
        {
            return Result<InvoiceDto>.Failure("Sales order is already invoiced.");
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
            SalesOrderId = order.Id,
            Status = "Issued",
            IssueDate = DateOnly.FromDateTime(DateTime.UtcNow),
            DueDate = request.DueDate ?? DateOnly.FromDateTime(DateTime.UtcNow.AddDays(30))
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
        if (request.Amount <= 0)
        {
            return Result<InvoiceDto>.Failure("Payment amount must be greater than zero.");
        }

        var invoice = await db.Invoices.FirstOrDefaultAsync(x => x.Id == invoiceId, cancellationToken);
        if (invoice is null)
        {
            return Result<InvoiceDto>.Failure("Invoice not found.");
        }

        var dto = await MapAsync(invoice, cancellationToken);
        if (request.Amount > dto.BalanceDue)
        {
            return Result<InvoiceDto>.Failure("Payment amount cannot exceed invoice balance.");
        }

        db.InvoicePayments.Add(new InvoicePayment { InvoiceId = invoiceId, Amount = request.Amount, PaidOn = request.PaidOn });
        await db.SaveChangesAsync(cancellationToken);

        var refreshed = await MapAsync(invoice, cancellationToken);
        var nextStatus = refreshed.BalanceDue == 0 ? "Paid" : "PartiallyPaid";
        if (invoice.Status != nextStatus)
        {
            invoice.Status = nextStatus;
            db.InvoiceStatusHistories.Add(new InvoiceStatusHistory { InvoiceId = invoice.Id, Status = invoice.Status });
            await db.SaveChangesAsync(cancellationToken);
        }

        return Result<InvoiceDto>.Success(await MapAsync(invoice, cancellationToken));
    }

    public async Task<Result<InvoiceDocumentDto>> GeneratePdfAsync(Guid id, CancellationToken cancellationToken)
    {
        var invoice = await db.Invoices.FirstOrDefaultAsync(x => x.Id == id, cancellationToken);
        if (invoice is null)
        {
            return Result<InvoiceDocumentDto>.Failure("Invoice not found.");
        }

        var dto = await MapAsync(invoice, cancellationToken);
        var customerName = await db.Customers.Where(x => x.Id == invoice.CustomerId).Select(x => x.CompanyName).FirstOrDefaultAsync(cancellationToken)
            ?? invoice.CustomerId.ToString();
        var model = new InvoicePdfModel(
            invoice.Number,
            customerName,
            invoice.IssueDate,
            invoice.DueDate,
            dto.Total,
            dto.PaidTotal,
            dto.BalanceDue,
            "EUR",
            dto.Lines.Select(x => new InvoicePdfLine(x.Description, x.Quantity, x.UnitPrice, x.LineTotal)).ToList());

        var pdfBytes = invoicePdfService.Generate(model);
        await using var stream = new MemoryStream(pdfBytes);
        var fileName = $"{invoice.Number}.pdf";
        var stored = await fileStorageService.SaveAsync("invoices", fileName, stream, cancellationToken);
        var document = new InvoiceDocument
        {
            InvoiceId = invoice.Id,
            FileName = fileName,
            MimeType = "application/pdf",
            StoragePath = stored.StoragePath,
            Size = stored.Size,
            Version = dto.Documents.Count + 1
        };

        db.InvoiceDocuments.Add(document);
        await db.SaveChangesAsync(cancellationToken);
        return Result<InvoiceDocumentDto>.Success(Map(document));
    }

    public async Task<Result<(Stream Content, string FileName, string MimeType)>> OpenDocumentAsync(Guid invoiceId, Guid documentId, CancellationToken cancellationToken)
    {
        var document = await db.InvoiceDocuments.FirstOrDefaultAsync(x => x.Id == documentId && x.InvoiceId == invoiceId, cancellationToken);
        if (document is null)
        {
            return Result<(Stream, string, string)>.Failure("Invoice document not found.");
        }

        var stream = await fileStorageService.OpenReadAsync(document.StoragePath, cancellationToken);
        return Result<(Stream, string, string)>.Success((stream, document.FileName, document.MimeType));
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
        var lineDtos = lines.Select(x => new InvoiceLineDto(x.Id, x.Description, x.Quantity, x.UnitPrice, decimal.Round(x.Quantity * x.UnitPrice, 2))).ToList();
        var total = lineDtos.Sum(x => x.LineTotal);
        var paid = await db.InvoicePayments.Where(x => x.InvoiceId == invoice.Id).SumAsync(x => x.Amount, cancellationToken);
        var documents = await db.InvoiceDocuments.Where(x => x.InvoiceId == invoice.Id).OrderByDescending(x => x.Version).ToListAsync(cancellationToken);
        return new InvoiceDto(
            invoice.Id,
            invoice.Number,
            invoice.CustomerId,
            invoice.SalesOrderId,
            invoice.Status,
            invoice.IssueDate,
            invoice.DueDate,
            total,
            paid,
            total - paid,
            lineDtos,
            documents.Select(Map).ToList());
    }

    private static InvoiceDocumentDto Map(InvoiceDocument document)
        => new(document.Id, document.FileName, document.MimeType, document.Size, document.Version, document.CreatedAt);
}
