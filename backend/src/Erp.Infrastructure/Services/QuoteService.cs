using Erp.Application.Common;
using Erp.Application.Documents;
using Erp.Application.Emails;
using Erp.Application.Quotes;
using Erp.Domain.Quotes;
using Erp.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Erp.Infrastructure.Services;

public sealed class QuoteService(
    ErpDbContext db,
    IQuotePdfService quotePdfService,
    IFileStorageService fileStorageService,
    IEmailService emailService,
    ICurrentUserService currentUser) : IQuoteService
{
    private static readonly IReadOnlyDictionary<QuoteStatus, QuoteStatus[]> AllowedTransitions = new Dictionary<QuoteStatus, QuoteStatus[]>
    {
        [QuoteStatus.Draft] = [QuoteStatus.Sent, QuoteStatus.Refused, QuoteStatus.Expired],
        [QuoteStatus.Sent] = [QuoteStatus.Draft, QuoteStatus.Signed, QuoteStatus.Refused, QuoteStatus.Expired],
        [QuoteStatus.Signed] = [QuoteStatus.ConvertedToOrder],
        [QuoteStatus.Refused] = [QuoteStatus.Draft],
        [QuoteStatus.Expired] = [QuoteStatus.Draft],
        [QuoteStatus.ConvertedToOrder] = []
    };

    public async Task<PagedResult<QuoteDto>> SearchAsync(string? search, int page, int pageSize, CancellationToken cancellationToken)
    {
        await ExpireOutdatedQuotesAsync(cancellationToken);

        page = Math.Max(1, page);
        pageSize = Math.Clamp(pageSize, 1, 100);
        var query = LoadQuote().AsNoTracking();
        if (!string.IsNullOrWhiteSpace(search))
        {
            var term = search.Trim();
            query = query.Where(x =>
                x.Number.Contains(term)
                || x.Customer!.CompanyName.Contains(term)
                || x.Status.ToString().Contains(term));
        }

        var total = await query.CountAsync(cancellationToken);
        var quotes = await query.OrderByDescending(x => x.CreatedAt).Skip((page - 1) * pageSize).Take(pageSize).ToListAsync(cancellationToken);
        return new PagedResult<QuoteDto>(await MapManyAsync(quotes, cancellationToken), total, page, pageSize);
    }

    public async Task<Result<QuoteDto>> GetAsync(Guid id, CancellationToken cancellationToken)
    {
        await ExpireOutdatedQuotesAsync(cancellationToken);

        var quote = await LoadQuote().AsNoTracking().FirstOrDefaultAsync(x => x.Id == id, cancellationToken);
        return quote is null ? Result<QuoteDto>.Failure("Devis introuvable.") : Result<QuoteDto>.Success(await MapAsync(quote, cancellationToken));
    }

    public async Task<Result<QuoteDto>> CreateAsync(CreateQuoteRequest request, CancellationToken cancellationToken)
    {
        if (!await db.Customers.AnyAsync(x => x.Id == request.CustomerId && x.IsActive, cancellationToken))
        {
            return Result<QuoteDto>.Failure("Client introuvable ou inactif.");
        }

        if (request.ValidUntil < DateOnly.FromDateTime(DateTime.UtcNow.Date))
        {
            return Result<QuoteDto>.Failure("La date de validite du devis ne peut pas etre dans le passe.");
        }

        if (request.Lines.Count == 0)
        {
            return Result<QuoteDto>.Failure("Un devis requiert au moins une ligne.");
        }

        var quote = new Quote
        {
            Number = await NextQuoteNumberAsync(cancellationToken),
            CustomerId = request.CustomerId,
            ValidUntil = request.ValidUntil
        };

        foreach (var line in request.Lines)
        {
            var built = await BuildLineAsync(quote.Id, line, cancellationToken);
            if (!built.Succeeded)
            {
                return Result<QuoteDto>.Failure(built.Error!);
            }

            quote.Lines.Add(built.Value!);
        }

        quote.RecalculateTotals();
        AddHistory(quote, QuoteStatus.Draft, "Devis cree");
        db.Quotes.Add(quote);
        await db.SaveChangesAsync(cancellationToken);

        var pdf = await CreatePdfDocumentAsync(quote.Id, cancellationToken);
        if (!pdf.Succeeded)
        {
            return Result<QuoteDto>.Failure(pdf.Error ?? "Generation PDF du devis impossible.");
        }

        var loaded = await LoadQuote().AsNoTracking().FirstAsync(x => x.Id == quote.Id, cancellationToken);
        return Result<QuoteDto>.Success(await MapAsync(loaded, cancellationToken));
    }

    public async Task<Result<QuoteDto>> UpdateAsync(Guid id, UpdateQuoteRequest request, CancellationToken cancellationToken)
    {
        var quote = await db.Quotes
            .Include(x => x.StatusHistory)
            .FirstOrDefaultAsync(x => x.Id == id, cancellationToken);
        if (quote is null)
        {
            return Result<QuoteDto>.Failure("Devis introuvable.");
        }

        if (quote.Status is QuoteStatus.Signed or QuoteStatus.ConvertedToOrder)
        {
            return Result<QuoteDto>.Failure("Un devis signe ou transforme en commande ne peut plus etre modifie.");
        }

        if (!await db.Customers.AnyAsync(x => x.Id == request.CustomerId && x.IsActive, cancellationToken))
        {
            return Result<QuoteDto>.Failure("Client introuvable ou inactif.");
        }

        if (request.ValidUntil < DateOnly.FromDateTime(DateTime.UtcNow.Date))
        {
            return Result<QuoteDto>.Failure("La date de validite du devis ne peut pas etre dans le passe.");
        }

        if (request.Lines.Count == 0)
        {
            return Result<QuoteDto>.Failure("Un devis requiert au moins une ligne.");
        }

        var nextLines = new List<QuoteLine>();
        foreach (var line in request.Lines)
        {
            var built = await BuildLineAsync(quote.Id, line, cancellationToken);
            if (!built.Succeeded)
            {
                return Result<QuoteDto>.Failure(built.Error!);
            }

            nextLines.Add(built.Value!);
        }

        var oldLineIds = await db.QuoteLines
            .AsNoTracking()
            .Where(x => x.QuoteId == quote.Id)
            .Select(x => x.Id)
            .ToListAsync(cancellationToken);
        db.QuoteLines.RemoveRange(oldLineIds.Select(lineId => new QuoteLine { Id = lineId }));
        db.QuoteLines.AddRange(nextLines);

        quote.CustomerId = request.CustomerId;
        quote.ValidUntil = request.ValidUntil;
        quote.RecalculateTotalsFrom(nextLines);

        if (quote.Status == QuoteStatus.Draft)
        {
            AddHistory(quote, QuoteStatus.Draft, "Devis modifie");
        }
        else
        {
            quote.SetStatus(QuoteStatus.Draft);
            AddHistory(quote, QuoteStatus.Draft, "Devis modifie et repasse en brouillon");
        }

        await db.SaveChangesAsync(cancellationToken);

        var pdf = await CreatePdfDocumentAsync(quote.Id, cancellationToken);
        if (!pdf.Succeeded)
        {
            return Result<QuoteDto>.Failure(pdf.Error ?? "Generation PDF du devis impossible.");
        }

        var loaded = await LoadQuote().AsNoTracking().FirstAsync(x => x.Id == quote.Id, cancellationToken);
        return Result<QuoteDto>.Success(await MapAsync(loaded, cancellationToken));
    }

    public async Task<Result<QuoteDto>> ChangeStatusAsync(Guid id, UpdateQuoteStatusRequest request, CancellationToken cancellationToken)
    {
        await ExpireOutdatedQuotesAsync(cancellationToken);

        var nextStatus = NormalizeStatus(request.Status);
        if (nextStatus is null)
        {
            return Result<QuoteDto>.Failure("Statut de devis inconnu.");
        }

        var quote = await LoadQuote().FirstOrDefaultAsync(x => x.Id == id, cancellationToken);
        if (quote is null)
        {
            return Result<QuoteDto>.Failure("Devis introuvable.");
        }

        if (quote.Status == nextStatus)
        {
            AddHistory(quote, nextStatus.Value, NormalizeOptional(request.Comment) ?? "Statut confirme");
            await db.SaveChangesAsync(cancellationToken);
            return Result<QuoteDto>.Success(await MapAsync(quote, cancellationToken));
        }

        if (!AllowedTransitions.TryGetValue(quote.Status, out var allowed) || !allowed.Contains(nextStatus.Value))
        {
            return Result<QuoteDto>.Failure($"Transition invalide de {quote.Status} vers {nextStatus}.");
        }

        quote.SetStatus(nextStatus.Value);
        AddHistory(quote, nextStatus.Value, NormalizeOptional(request.Comment));
        await db.SaveChangesAsync(cancellationToken);
        return Result<QuoteDto>.Success(await MapAsync(quote, cancellationToken));
    }

    public async Task<Result<QuoteDocumentDto>> GeneratePdfAsync(Guid id, CancellationToken cancellationToken)
    {
        var document = await CreatePdfDocumentAsync(id, cancellationToken);
        return document.Succeeded ? Result<QuoteDocumentDto>.Success(Map(document.Value!)) : Result<QuoteDocumentDto>.Failure(document.Error!);
    }

    public async Task<Result<QuoteDto>> SendByEmailAsync(Guid id, SendQuoteEmailRequest request, CancellationToken cancellationToken)
    {
        var quote = await LoadQuote().FirstOrDefaultAsync(x => x.Id == id, cancellationToken);
        if (quote is null)
        {
            return Result<QuoteDto>.Failure("Devis introuvable.");
        }

        if (quote.Status is QuoteStatus.Refused or QuoteStatus.Expired or QuoteStatus.ConvertedToOrder)
        {
            return Result<QuoteDto>.Failure("Ce devis ne peut plus etre envoye par email dans son statut actuel.");
        }

        if (string.IsNullOrWhiteSpace(request.To))
        {
            return Result<QuoteDto>.Failure("Destinataire email obligatoire.");
        }

        var documentResult = quote.Documents.Count == 0
            ? await CreatePdfDocumentAsync(quote.Id, cancellationToken)
            : Result<QuoteDocument>.Success(quote.Documents.OrderByDescending(x => x.Version).First());
        if (!documentResult.Succeeded)
        {
            return Result<QuoteDto>.Failure(documentResult.Error!);
        }

        var document = documentResult.Value!;
        var subject = NormalizeOptional(request.Subject) ?? $"Devis {quote.Number}";
        var body = NormalizeOptional(request.Body)
            ?? $"Bonjour,\n\nVeuillez trouver ci-joint le devis {quote.Number} d'un montant total de {quote.Total:0.00} {quote.Currency}.\n\nCordialement,\nOceanERP";

        var sendResult = await emailService.SendAsync(
            new SendEmailRequest(request.MailAccountId, request.To, subject, body),
            [new StoredEmailAttachment(document.FileName, document.MimeType, document.StoragePath)],
            [new EmailLinkTarget("quotes", quote.Id)],
            cancellationToken);
        if (!sendResult.Succeeded)
        {
            return Result<QuoteDto>.Failure(sendResult.Error!);
        }

        if (quote.Status == QuoteStatus.Draft)
        {
            quote.SetStatus(QuoteStatus.Sent);
            AddHistory(quote, QuoteStatus.Sent, $"Envoye par email a {request.To.Trim()}");
        }
        else
        {
            AddHistory(quote, quote.Status, $"Email renvoye a {request.To.Trim()}");
        }

        await db.SaveChangesAsync(cancellationToken);
        var loaded = await LoadQuote().AsNoTracking().FirstAsync(x => x.Id == quote.Id, cancellationToken);
        return Result<QuoteDto>.Success(await MapAsync(loaded, cancellationToken));
    }

    public async Task<Result<(Stream Content, string FileName, string MimeType)>> OpenDocumentAsync(Guid quoteId, Guid documentId, CancellationToken cancellationToken)
    {
        var document = await db.QuoteDocuments.FirstOrDefaultAsync(x => x.Id == documentId && x.QuoteId == quoteId, cancellationToken);
        if (document is null)
        {
            return Result<(Stream, string, string)>.Failure("Document de devis introuvable.");
        }

        var stream = await fileStorageService.OpenReadAsync(document.StoragePath, cancellationToken);
        return Result<(Stream, string, string)>.Success((stream, document.FileName, document.MimeType));
    }

    private async Task<Result<QuoteLine>> BuildLineAsync(Guid quoteId, UpsertQuoteLineRequest request, CancellationToken cancellationToken)
    {
        if (request.Quantity <= 0)
        {
            return Result<QuoteLine>.Failure("La quantite doit etre superieure a zero.");
        }

        if (request.UnitPrice < 0)
        {
            return Result<QuoteLine>.Failure("Le prix unitaire ne peut pas etre negatif.");
        }

        if (request.DiscountRate is < 0 or > 100)
        {
            return Result<QuoteLine>.Failure("La remise doit etre comprise entre 0 et 100.");
        }

        if (request.VatRate is < 0 or > 100)
        {
            return Result<QuoteLine>.Failure("Le taux de TVA doit etre compris entre 0 et 100.");
        }

        var description = NormalizeOptional(request.Description);
        var unitPrice = request.UnitPrice;
        var vatRate = request.VatRate;
        if (request.ProductId.HasValue)
        {
            var product = await db.Products.FirstOrDefaultAsync(x => x.Id == request.ProductId.Value && x.IsActive, cancellationToken);
            if (product is null)
            {
                return Result<QuoteLine>.Failure("Produit introuvable ou inactif.");
            }

            description ??= $"{product.Reference} - {product.Name}";
            if (unitPrice == 0)
            {
                unitPrice = product.SalePrice;
            }

            if (vatRate == 0 && product.VatRate > 0)
            {
                vatRate = product.VatRate;
            }
        }

        if (string.IsNullOrWhiteSpace(description))
        {
            return Result<QuoteLine>.Failure("La description de ligne est obligatoire.");
        }

        if (description.Length > 500)
        {
            return Result<QuoteLine>.Failure("La description de ligne est limitee a 500 caracteres.");
        }

        return Result<QuoteLine>.Success(new QuoteLine
        {
            QuoteId = quoteId,
            ProductId = request.ProductId,
            Description = description,
            Quantity = request.Quantity,
            UnitPrice = unitPrice,
            DiscountRate = request.DiscountRate,
            VatRate = vatRate
        });
    }

    private async Task<Result<QuoteDocument>> CreatePdfDocumentAsync(Guid id, CancellationToken cancellationToken)
    {
        var quote = await LoadQuote().AsNoTracking().FirstOrDefaultAsync(x => x.Id == id, cancellationToken);
        if (quote is null)
        {
            return Result<QuoteDocument>.Failure("Devis introuvable.");
        }

        var lastVersion = await db.QuoteDocuments
            .Where(x => x.QuoteId == quote.Id)
            .Select(x => (int?)x.Version)
            .MaxAsync(cancellationToken) ?? 0;
        var nextVersion = lastVersion + 1;
        var pdfBytes = quotePdfService.Generate(quote);
        await using var stream = new MemoryStream(pdfBytes);
        var fileName = $"{quote.Number}-v{nextVersion}.pdf";
        var stored = await fileStorageService.SaveAsync("quotes", fileName, stream, cancellationToken);
        var document = new QuoteDocument
        {
            QuoteId = quote.Id,
            FileName = fileName,
            MimeType = "application/pdf",
            StoragePath = stored.StoragePath,
            Size = stored.Size,
            Version = nextVersion
        };

        db.QuoteDocuments.Add(document);
        await db.SaveChangesAsync(cancellationToken);
        return Result<QuoteDocument>.Success(document);
    }

    private async Task ExpireOutdatedQuotesAsync(CancellationToken cancellationToken)
    {
        var today = DateOnly.FromDateTime(DateTime.UtcNow.Date);
        var quotes = await db.Quotes
            .Where(x => x.ValidUntil < today && (x.Status == QuoteStatus.Draft || x.Status == QuoteStatus.Sent))
            .ToListAsync(cancellationToken);
        if (quotes.Count == 0)
        {
            return;
        }

        foreach (var quote in quotes)
        {
            quote.SetStatus(QuoteStatus.Expired);
            AddHistory(quote, QuoteStatus.Expired, "Expiration automatique");
        }

        await db.SaveChangesAsync(cancellationToken);
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

    private async Task<IReadOnlyList<QuoteDto>> MapManyAsync(IReadOnlyList<Quote> quotes, CancellationToken cancellationToken)
    {
        var result = new List<QuoteDto>();
        foreach (var quote in quotes)
        {
            result.Add(await MapAsync(quote, cancellationToken));
        }

        return result;
    }

    private async Task<QuoteDto> MapAsync(Quote quote, CancellationToken cancellationToken)
    {
        var productIds = quote.Lines.Where(x => x.ProductId.HasValue).Select(x => x.ProductId!.Value).Distinct().ToList();
        var products = productIds.Count == 0
            ? new Dictionary<Guid, ProductSummary>()
            : await db.Products
                .Where(x => productIds.Contains(x.Id))
                .Select(x => new ProductSummary(x.Id, x.Reference, x.Name))
                .ToDictionaryAsync(x => x.Id, cancellationToken);

        var userIds = quote.StatusHistory.Where(x => x.ChangedByUserId.HasValue).Select(x => x.ChangedByUserId!.Value).Distinct().ToList();
        var users = userIds.Count == 0
            ? new Dictionary<Guid, UserSummary>()
            : await db.Users
                .Where(x => userIds.Contains(x.Id))
                .Select(x => new UserSummary(x.Id, x.DisplayName, x.Email))
                .ToDictionaryAsync(x => x.Id, cancellationToken);

        return new QuoteDto(
            quote.Id,
            quote.Number,
            quote.CustomerId,
            quote.Customer?.CompanyName,
            quote.Status.ToString(),
            quote.IssueDate,
            quote.ValidUntil,
            quote.Subtotal,
            quote.VatTotal,
            quote.Total,
            quote.Currency,
            quote.Lines.OrderBy(x => x.Id).Select(x => Map(x, products)).ToList(),
            quote.Documents.OrderByDescending(x => x.Version).Select(Map).ToList(),
            quote.StatusHistory.OrderByDescending(x => x.ChangedAt).Select(x => Map(x, users)).ToList());
    }

    private static QuoteLineDto Map(QuoteLine line, IReadOnlyDictionary<Guid, ProductSummary> products)
    {
        products.TryGetValue(line.ProductId ?? Guid.Empty, out var product);
        return new QuoteLineDto(
            line.Id,
            line.ProductId,
            product?.Reference,
            product?.Name,
            line.Description,
            line.Quantity,
            line.UnitPrice,
            line.DiscountRate,
            line.VatRate,
            line.LineNetTotal,
            line.LineVatTotal,
            line.LineTotal);
    }

    private static QuoteDocumentDto Map(QuoteDocument document)
        => new(document.Id, document.FileName, document.MimeType, document.Size, document.Version, document.CreatedAt);

    private static QuoteStatusHistoryDto Map(QuoteStatusHistory history, IReadOnlyDictionary<Guid, UserSummary> users)
    {
        users.TryGetValue(history.ChangedByUserId ?? Guid.Empty, out var user);
        return new QuoteStatusHistoryDto(history.Id, history.Status.ToString(), history.Comment, history.ChangedByUserId, user?.DisplayName, user?.Email, history.ChangedAt);
    }

    private void AddHistory(Quote quote, QuoteStatus status, string? comment)
        => db.QuoteStatusHistories.Add(new QuoteStatusHistory
        {
            QuoteId = quote.Id,
            Status = status,
            ChangedByUserId = currentUser.UserId,
            Comment = comment
        });

    private static QuoteStatus? NormalizeStatus(string status)
        => Enum.TryParse<QuoteStatus>(status, true, out var parsed) ? parsed : null;

    private static string? NormalizeOptional(string? value)
        => string.IsNullOrWhiteSpace(value) ? null : value.Trim();

    private sealed record ProductSummary(Guid Id, string Reference, string Name);
    private sealed record UserSummary(Guid Id, string DisplayName, string Email);
}
