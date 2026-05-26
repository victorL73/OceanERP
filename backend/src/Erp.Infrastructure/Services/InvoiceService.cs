using Erp.Application.Common;
using Erp.Application.Documents;
using Erp.Application.Invoices;
using Erp.Domain.FutureModules;
using Erp.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using System.Xml.Linq;

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
            Kind = "Invoice",
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

    public async Task<Result<InvoiceDto>> CreateCreditNoteAsync(Guid invoiceId, CreateCreditNoteRequest request, CancellationToken cancellationToken)
    {
        var invoice = await db.Invoices.FirstOrDefaultAsync(x => x.Id == invoiceId, cancellationToken);
        if (invoice is null)
        {
            return Result<InvoiceDto>.Failure("Invoice not found.");
        }

        if (!string.Equals(invoice.Kind, "Invoice", StringComparison.OrdinalIgnoreCase))
        {
            return Result<InvoiceDto>.Failure("Credit notes can only be created from invoices.");
        }

        if (invoice.Status == "Cancelled")
        {
            return Result<InvoiceDto>.Failure("Cancelled invoices cannot generate credit notes.");
        }

        if (await db.Invoices.AnyAsync(x => x.CreditOfInvoiceId == invoice.Id && x.Status != "Cancelled", cancellationToken))
        {
            return Result<InvoiceDto>.Failure("A credit note already exists for this invoice.");
        }

        var lines = await db.InvoiceLines.Where(x => x.InvoiceId == invoice.Id).OrderBy(x => x.Id).ToListAsync(cancellationToken);
        if (lines.Count == 0)
        {
            return Result<InvoiceDto>.Failure("Invoice has no lines.");
        }

        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var credit = new Invoice
        {
            Number = await NextCreditNumberAsync(cancellationToken),
            Kind = "CreditNote",
            CustomerId = invoice.CustomerId,
            CreditOfInvoiceId = invoice.Id,
            Status = "Issued",
            IssueDate = today,
            DueDate = today,
            FacturXProfile = invoice.FacturXProfile
        };

        db.Invoices.Add(credit);
        foreach (var line in lines)
        {
            db.InvoiceLines.Add(new InvoiceLine
            {
                InvoiceId = credit.Id,
                Description = string.IsNullOrWhiteSpace(request.Reason) ? line.Description : $"{line.Description} - {request.Reason}",
                Quantity = line.Quantity,
                UnitPrice = line.UnitPrice
            });
        }

        db.InvoiceStatusHistories.Add(new InvoiceStatusHistory { InvoiceId = credit.Id, Status = credit.Status });
        await db.SaveChangesAsync(cancellationToken);
        return Result<InvoiceDto>.Success(await MapAsync(credit, cancellationToken));
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

        if (string.Equals(invoice.Kind, "CreditNote", StringComparison.OrdinalIgnoreCase))
        {
            return Result<InvoiceDto>.Failure("Credit notes cannot receive payments.");
        }

        if (invoice.Status == "Cancelled")
        {
            return Result<InvoiceDto>.Failure("Cancelled invoices cannot receive payments.");
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

    public async Task<Result<InvoiceDto>> CancelAsync(Guid invoiceId, CancellationToken cancellationToken)
    {
        var invoice = await db.Invoices.FirstOrDefaultAsync(x => x.Id == invoiceId, cancellationToken);
        if (invoice is null)
        {
            return Result<InvoiceDto>.Failure("Invoice not found.");
        }

        if (invoice.Status == "Cancelled")
        {
            return Result<InvoiceDto>.Success(await MapAsync(invoice, cancellationToken));
        }

        var paid = await db.InvoicePayments.Where(x => x.InvoiceId == invoiceId).SumAsync(x => x.Amount, cancellationToken);
        if (paid > 0)
        {
            return Result<InvoiceDto>.Failure("Invoices with payments cannot be cancelled directly. Create a credit note when the credit note module is enabled.");
        }

        invoice.Status = "Cancelled";
        db.InvoiceStatusHistories.Add(new InvoiceStatusHistory { InvoiceId = invoice.Id, Status = invoice.Status });
        await db.SaveChangesAsync(cancellationToken);
        return Result<InvoiceDto>.Success(await MapAsync(invoice, cancellationToken));
    }

    public async Task<Result> DeleteAsync(Guid invoiceId, CancellationToken cancellationToken)
    {
        var invoice = await db.Invoices.FirstOrDefaultAsync(x => x.Id == invoiceId, cancellationToken);
        if (invoice is null)
        {
            return Result.Failure("Facture introuvable.");
        }

        if (!string.Equals(invoice.Kind, "CreditNote", StringComparison.OrdinalIgnoreCase))
        {
            return Result.Failure("Seuls les avoirs peuvent etre supprimes. Les factures doivent etre annulees pour conserver la piste comptable.");
        }

        var payments = await db.InvoicePayments.Where(x => x.InvoiceId == invoiceId).ToListAsync(cancellationToken);
        if (payments.Count > 0)
        {
            return Result.Failure("Impossible de supprimer un avoir lie a un paiement.");
        }

        var documents = await db.InvoiceDocuments.Where(x => x.InvoiceId == invoiceId).ToListAsync(cancellationToken);
        var documentStoragePaths = documents.Select(x => x.StoragePath).Where(x => !string.IsNullOrWhiteSpace(x)).Distinct().ToList();
        var storagePathsKeptByDrive = await db.DriveItems
            .Where(x => documentStoragePaths.Contains(x.StoragePath))
            .Select(x => x.StoragePath)
            .ToListAsync(cancellationToken);
        var lines = await db.InvoiceLines.Where(x => x.InvoiceId == invoiceId).ToListAsync(cancellationToken);
        var history = await db.InvoiceStatusHistories.Where(x => x.InvoiceId == invoiceId).ToListAsync(cancellationToken);
        var emailLinks = await db.EmailLinks.Where(x => x.Module == "invoices" && x.EntityId == invoiceId).ToListAsync(cancellationToken);
        var documentLinks = await db.DocumentLinks.Where(x => x.Module == "invoices" && x.EntityId == invoiceId).ToListAsync(cancellationToken);

        db.InvoiceDocuments.RemoveRange(documents);
        db.InvoiceStatusHistories.RemoveRange(history);
        db.InvoicePayments.RemoveRange(payments);
        db.InvoiceLines.RemoveRange(lines);
        db.EmailLinks.RemoveRange(emailLinks);
        db.DocumentLinks.RemoveRange(documentLinks);
        db.Invoices.Remove(invoice);

        await db.SaveChangesAsync(cancellationToken);

        foreach (var storagePath in documentStoragePaths.Where(path => !storagePathsKeptByDrive.Contains(path)))
        {
            await fileStorageService.DeleteAsync(storagePath, cancellationToken);
        }

        return Result.Success();
    }

    public async Task<Result<InvoiceDocumentDto>> GeneratePdfAsync(Guid id, CancellationToken cancellationToken)
    {
        var invoice = await db.Invoices.FirstOrDefaultAsync(x => x.Id == id, cancellationToken);
        if (invoice is null)
        {
            return Result<InvoiceDocumentDto>.Failure("Invoice not found.");
        }

        var dto = await MapAsync(invoice, cancellationToken);
        var model = new InvoicePdfModel(
            invoice.Number,
            dto.Kind,
            dto.CustomerName,
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

    public async Task<Result<InvoiceFacturXExportDto>> GenerateFacturXXmlAsync(Guid invoiceId, CancellationToken cancellationToken)
    {
        var invoice = await db.Invoices.FirstOrDefaultAsync(x => x.Id == invoiceId, cancellationToken);
        if (invoice is null)
        {
            return Result<InvoiceFacturXExportDto>.Failure("Invoice not found.");
        }

        var dto = await MapAsync(invoice, cancellationToken);
        var customer = await db.Customers.FirstOrDefaultAsync(x => x.Id == invoice.CustomerId, cancellationToken);
        var billingAddress = await db.CustomerAddresses
            .Where(x => x.CustomerId == invoice.CustomerId && x.IsBilling)
            .OrderByDescending(x => x.Id)
            .FirstOrDefaultAsync(cancellationToken);

        var document = new XDocument(
            new XElement("FacturXPreparation",
                new XAttribute("profile", invoice.FacturXProfile),
                new XAttribute("generatedAt", DateTimeOffset.UtcNow.ToString("O")),
                new XElement("Invoice",
                    new XElement("Number", invoice.Number),
                    new XElement("Kind", invoice.Kind),
                    new XElement("Status", dto.Status),
                    new XElement("IssueDate", invoice.IssueDate.ToString("yyyy-MM-dd")),
                    new XElement("DueDate", invoice.DueDate.ToString("yyyy-MM-dd")),
                    new XElement("Currency", "EUR"),
                    new XElement("Total", dto.Total),
                    new XElement("PaidTotal", dto.PaidTotal),
                    new XElement("BalanceDue", dto.BalanceDue)),
                new XElement("Customer",
                    new XElement("Name", customer?.CompanyName ?? dto.CustomerName),
                    new XElement("LegalName", customer?.LegalName),
                    new XElement("Siren", customer?.SirenNumber),
                    new XElement("Siret", customer?.SiretNumber),
                    new XElement("VatNumber", customer?.VatNumber),
                    new XElement("Email", customer?.Email),
                    new XElement("Phone", customer?.Phone),
                    new XElement("BillingAddress",
                        new XElement("Line1", billingAddress?.Line1),
                        new XElement("Line2", billingAddress?.Line2),
                        new XElement("PostalCode", billingAddress?.PostalCode),
                        new XElement("City", billingAddress?.City),
                        new XElement("Country", billingAddress?.Country))),
                new XElement("Lines",
                    dto.Lines.Select(line =>
                        new XElement("Line",
                            new XElement("Description", line.Description),
                            new XElement("Quantity", line.Quantity),
                            new XElement("UnitPrice", line.UnitPrice),
                            new XElement("LineTotal", line.LineTotal))))));

        return Result<InvoiceFacturXExportDto>.Success(new InvoiceFacturXExportDto(
            $"{invoice.Number}-factur-x-preparation.xml",
            "application/xml",
            document.ToString(SaveOptions.DisableFormatting)));
    }

    private async Task<string> NextNumberAsync(CancellationToken cancellationToken)
    {
        var prefix = $"FAC-{DateTime.UtcNow:yyyy}-";
        var count = await db.Invoices.CountAsync(x => x.Number.StartsWith(prefix), cancellationToken);
        return $"{prefix}{count + 1:0000}";
    }

    private async Task<string> NextCreditNumberAsync(CancellationToken cancellationToken)
    {
        var prefix = $"AVO-{DateTime.UtcNow:yyyy}-";
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
        var history = await db.InvoiceStatusHistories.Where(x => x.InvoiceId == invoice.Id).OrderByDescending(x => x.ChangedAt).ToListAsync(cancellationToken);
        var balanceDue = total - paid;
        var customerName = await db.Customers.Where(x => x.Id == invoice.CustomerId).Select(x => x.CompanyName).FirstOrDefaultAsync(cancellationToken) ?? invoice.CustomerId.ToString();
        var salesOrderNumber = invoice.SalesOrderId is null
            ? null
            : await db.SalesOrders.Where(x => x.Id == invoice.SalesOrderId).Select(x => x.Number).FirstOrDefaultAsync(cancellationToken);
        var creditOfInvoiceNumber = invoice.CreditOfInvoiceId is null
            ? null
            : await db.Invoices.Where(x => x.Id == invoice.CreditOfInvoiceId).Select(x => x.Number).FirstOrDefaultAsync(cancellationToken);
        return new InvoiceDto(
            invoice.Id,
            invoice.Number,
            invoice.Kind,
            invoice.CustomerId,
            customerName,
            invoice.SalesOrderId,
            salesOrderNumber,
            invoice.CreditOfInvoiceId,
            creditOfInvoiceNumber,
            EffectiveStatus(invoice.Status, invoice.DueDate, balanceDue, invoice.Kind),
            invoice.IssueDate,
            invoice.DueDate,
            total,
            paid,
            balanceDue,
            invoice.FacturXProfile,
            !string.IsNullOrWhiteSpace(invoice.FacturXProfile),
            lineDtos,
            documents.Select(Map).ToList(),
            history.Select(x => new InvoiceStatusHistoryDto(x.Id, x.Status, x.ChangedAt)).ToList());
    }

    private static InvoiceDocumentDto Map(InvoiceDocument document)
        => new(document.Id, document.FileName, document.MimeType, document.Size, document.Version, document.CreatedAt);

    private static string EffectiveStatus(string status, DateOnly dueDate, decimal balanceDue, string kind)
    {
        if (string.Equals(kind, "CreditNote", StringComparison.OrdinalIgnoreCase))
        {
            return status;
        }

        if (status is "Cancelled" or "Paid")
        {
            return status;
        }

        if (balanceDue <= 0)
        {
            return "Paid";
        }

        return dueDate < DateOnly.FromDateTime(DateTime.UtcNow) ? "Overdue" : status;
    }
}
