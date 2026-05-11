using Erp.Application.Common;

namespace Erp.Application.Invoices;

public interface IInvoiceService
{
    Task<PagedResult<InvoiceDto>> SearchAsync(int page, int pageSize, CancellationToken cancellationToken);
    Task<Result<InvoiceDto>> GetAsync(Guid id, CancellationToken cancellationToken);
    Task<Result<InvoiceDto>> CreateFromOrderAsync(CreateInvoiceFromOrderRequest request, CancellationToken cancellationToken);
    Task<Result<InvoiceDto>> AddPaymentAsync(Guid invoiceId, AddInvoicePaymentRequest request, CancellationToken cancellationToken);
}

