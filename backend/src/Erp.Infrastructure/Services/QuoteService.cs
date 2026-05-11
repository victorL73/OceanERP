using Erp.Application.Common;
using Erp.Application.Documents;
using Erp.Application.Quotes;
using Erp.Domain.Quotes;
using Erp.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Erp.Infrastructure.Services;

public sealed class QuoteService(
    ErpDbContext db,
    IQuotePdfService quotePdfService,
    IFileStorageService fileStorageService) : IQuoteService
{
    public async Task<PagedResult<QuoteDto>> SearchAsync(string? search, int page, int pageSize, CancellationToken cancellationToken)
    {
        page = Math.Max(1, page);
        pageSize = Math.Clamp(pageSize, 1, 100);
        var query = db.Quotes.Include(x => x.Customer).Include(x => x.Lines).Include(x => x.Documents).AsQueryable();
        if (!string.IsNullOrWhiteSpace(search))
        {
            query = query.Where(x => x.Number.Contains(search) || x.Customer!.CompanyName.Contains(search));
        }

        var total = await query.CountAsync(cancellationToken);
        var quotes = await query.OrderByDescending(x => x.CreatedAt).Skip((page - 1) * pageSize).Take(pageSize).ToListAsync(cancellationToken);
        return new PagedResult<QuoteDto>(quotes.Select(Map).ToList(), total, page, pageSize);
    }

    public async Task<Result<QuoteDto>> GetAsync(Guid id, CancellationToken cancellationToken)
    {
        var quote = await LoadQuote().FirstOrDefaultAsync(x => x.Id == id, cancellationToken);
        return quote is null ? Result<QuoteDto>.Failure("Quote not found.") : Result<QuoteDto>.Success(Map(quote));
    }

    public async Task<Result<QuoteDto>> CreateAsync(CreateQuoteRequest request, CancellationToken cancellationToken)
    {
        if (!await db.Customers.AnyAsync(x => x.Id == request.CustomerId, cancellationToken))
        {
            return Result<QuoteDto>.Failure("Customer not found.");
        }

        if (request.Lines.Count == 0)
        {
            return Result<QuoteDto>.Failure("A quote requires at least one line.");
        }

        var quote = new Quote
        {
            Number = await NextQuoteNumberAsync(cancellationToken),
            CustomerId = request.CustomerId,
            ValidUntil = request.ValidUntil
        };

        foreach (var line in request.Lines)
        {
            quote.Lines.Add(new QuoteLine
            {
                ProductId = line.ProductId,
                Description = line.Description,
                Quantity = line.Quantity,
                UnitPrice = line.UnitPrice,
                DiscountRate = line.DiscountRate,
                VatRate = line.VatRate
            });
        }

        quote.RecalculateTotals();
        quote.StatusHistory.Add(new QuoteStatusHistory { QuoteId = quote.Id, Status = QuoteStatus.Draft, Comment = "Quote created" });
        db.Quotes.Add(quote);
        await db.SaveChangesAsync(cancellationToken);

        var pdf = await GeneratePdfInternalAsync(quote.Id, cancellationToken);
        if (!pdf.Succeeded)
        {
            return Result<QuoteDto>.Failure(pdf.Error ?? "Quote PDF generation failed.");
        }

        var loaded = await LoadQuote().FirstAsync(x => x.Id == quote.Id, cancellationToken);
        return Result<QuoteDto>.Success(Map(loaded));
    }

    public async Task<Result<QuoteDto>> ChangeStatusAsync(Guid id, UpdateQuoteStatusRequest request, CancellationToken cancellationToken)
    {
        var quote = await LoadQuote().FirstOrDefaultAsync(x => x.Id == id, cancellationToken);
        if (quote is null)
        {
            return Result<QuoteDto>.Failure("Quote not found.");
        }

        quote.ChangeStatus(request.Status, null, request.Comment);
        await db.SaveChangesAsync(cancellationToken);
        return Result<QuoteDto>.Success(Map(quote));
    }

    public Task<Result<QuoteDocumentDto>> GeneratePdfAsync(Guid id, CancellationToken cancellationToken)
        => GeneratePdfInternalAsync(id, cancellationToken);

    public async Task<Result<(Stream Content, string FileName, string MimeType)>> OpenDocumentAsync(Guid quoteId, Guid documentId, CancellationToken cancellationToken)
    {
        var document = await db.QuoteDocuments.FirstOrDefaultAsync(x => x.Id == documentId && x.QuoteId == quoteId, cancellationToken);
        if (document is null)
        {
            return Result<(Stream, string, string)>.Failure("Quote document not found.");
        }

        var stream = await fileStorageService.OpenReadAsync(document.StoragePath, cancellationToken);
        return Result<(Stream, string, string)>.Success((stream, document.FileName, document.MimeType));
    }

    private async Task<Result<QuoteDocumentDto>> GeneratePdfInternalAsync(Guid id, CancellationToken cancellationToken)
    {
        var quote = await LoadQuote().FirstOrDefaultAsync(x => x.Id == id, cancellationToken);
        if (quote is null)
        {
            return Result<QuoteDocumentDto>.Failure("Quote not found.");
        }

        quote.RecalculateTotals();
        var pdfBytes = quotePdfService.Generate(quote);
        await using var stream = new MemoryStream(pdfBytes);
        var fileName = $"{quote.Number}.pdf";
        var stored = await fileStorageService.SaveAsync("quotes", fileName, stream, cancellationToken);
        var document = new QuoteDocument
        {
            QuoteId = quote.Id,
            FileName = fileName,
            MimeType = "application/pdf",
            StoragePath = stored.StoragePath,
            Size = stored.Size,
            Version = quote.Documents.Count + 1
        };

        quote.Documents.Add(document);
        await db.SaveChangesAsync(cancellationToken);
        return Result<QuoteDocumentDto>.Success(Map(document));
    }

    private IQueryable<Quote> LoadQuote()
        => db.Quotes
            .Include(x => x.Customer)
            .Include(x => x.Lines)
            .Include(x => x.Documents)
            .Include(x => x.StatusHistory);

    private async Task<string> NextQuoteNumberAsync(CancellationToken cancellationToken)
    {
        var prefix = $"DEV-{DateTime.UtcNow:yyyy}-";
        var count = await db.Quotes.CountAsync(x => x.Number.StartsWith(prefix), cancellationToken);
        return $"{prefix}{count + 1:0000}";
    }

    private static QuoteDto Map(Quote quote)
        => new(
            quote.Id,
            quote.Number,
            quote.CustomerId,
            quote.Customer?.CompanyName,
            quote.Status,
            quote.IssueDate,
            quote.ValidUntil,
            quote.Subtotal,
            quote.VatTotal,
            quote.Total,
            quote.Currency,
            quote.Lines.Select(Map).ToList(),
            quote.Documents.OrderByDescending(x => x.Version).Select(Map).ToList());

    private static QuoteLineDto Map(QuoteLine line)
        => new(line.Id, line.ProductId, line.Description, line.Quantity, line.UnitPrice, line.DiscountRate, line.VatRate, line.LineNetTotal, line.LineVatTotal, line.LineTotal);

    private static QuoteDocumentDto Map(QuoteDocument document)
        => new(document.Id, document.FileName, document.MimeType, document.Size, document.Version, document.CreatedAt);
}
