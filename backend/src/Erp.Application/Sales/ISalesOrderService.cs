using Erp.Application.Common;

namespace Erp.Application.Sales;

public interface ISalesOrderService
{
    Task<PagedResult<SalesOrderDto>> SearchAsync(int page, int pageSize, CancellationToken cancellationToken);
    Task<Result<SalesOrderDto>> GetAsync(Guid id, CancellationToken cancellationToken);
    Task<Result<SalesOrderDto>> CreateAsync(CreateSalesOrderRequest request, CancellationToken cancellationToken);
    Task<Result<SalesOrderDto>> UpdateAsync(Guid id, UpdateSalesOrderRequest request, CancellationToken cancellationToken);
    Task<Result<SalesOrderDto>> CreateFromQuoteAsync(CreateSalesOrderFromQuoteRequest request, CancellationToken cancellationToken);
    Task<Result<SalesOrderDto>> ChangeStatusAsync(Guid id, UpdateSalesOrderStatusRequest request, CancellationToken cancellationToken);
    Task<Result<SalesOrderShipmentSlipFileDto>> GenerateShipmentSlipAsync(Guid id, CancellationToken cancellationToken);
    Task<Result<SalesOrderShipmentSlipFileDto>> GenerateColissimoLabelAsync(Guid id, CancellationToken cancellationToken);
    Task<Result> DeleteAsync(Guid id, CancellationToken cancellationToken);
}
