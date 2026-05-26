using Erp.Application.Common;

namespace Erp.Application.Quotes;

public interface IQuoteService
{
    Task<PagedResult<QuoteDto>> SearchAsync(string? search, int page, int pageSize, CancellationToken cancellationToken);
    Task<Result<QuoteDto>> GetAsync(Guid id, CancellationToken cancellationToken);
    Task<Result<QuoteDto>> CreateAsync(CreateQuoteRequest request, CancellationToken cancellationToken);
    Task<Result<QuoteDto>> UpdateAsync(Guid id, UpdateQuoteRequest request, CancellationToken cancellationToken);
    Task<Result<QuoteDto>> ChangeStatusAsync(Guid id, UpdateQuoteStatusRequest request, CancellationToken cancellationToken);
    Task<Result<QuoteDto>> ReserveStockAsync(Guid id, ReserveQuoteStockRequest request, CancellationToken cancellationToken);
    Task<Result<QuoteDto>> ReleaseStockAsync(Guid id, CancellationToken cancellationToken);
    Task<Result<QuoteDocumentDto>> GeneratePdfAsync(Guid id, CancellationToken cancellationToken);
    Task<Result<QuoteDto>> SendByEmailAsync(Guid id, SendQuoteEmailRequest request, CancellationToken cancellationToken);
    Task<Result<(Stream Content, string FileName, string MimeType)>> OpenDocumentAsync(Guid quoteId, Guid documentId, CancellationToken cancellationToken);
    Task<Result> DeleteAsync(Guid id, CancellationToken cancellationToken);
}
