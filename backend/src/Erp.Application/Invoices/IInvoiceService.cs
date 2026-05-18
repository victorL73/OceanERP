using Erp.Application.Common;

namespace Erp.Application.Invoices;

public interface IInvoiceService
{
    Task<PagedResult<InvoiceDto>> SearchAsync(int page, int pageSize, CancellationToken cancellationToken);
    Task<Result<InvoiceDto>> GetAsync(Guid id, CancellationToken cancellationToken);
    Task<Result<InvoiceDto>> CreateFromOrderAsync(CreateInvoiceFromOrderRequest request, CancellationToken cancellationToken);
    Task<Result<InvoiceDto>> AddPaymentAsync(Guid invoiceId, AddInvoicePaymentRequest request, CancellationToken cancellationToken);
    Task<Result<InvoiceDto>> CancelAsync(Guid invoiceId, CancellationToken cancellationToken);
    Task<Result<InvoiceDocumentDto>> GeneratePdfAsync(Guid id, CancellationToken cancellationToken);
    Task<Result<(Stream Content, string FileName, string MimeType)>> OpenDocumentAsync(Guid invoiceId, Guid documentId, CancellationToken cancellationToken);
}
