using Erp.Application.Common;

namespace Erp.Application.Purchases;

public sealed record PurchaseOrderDto(
    Guid Id,
    string Number,
    Guid SupplierId,
    string? SupplierName,
    string Status,
    DateOnly? ExpectedAt,
    decimal Total,
    IReadOnlyList<PurchaseOrderLineDto> Lines);

public sealed record PurchaseOrderLineDto(
    Guid Id,
    Guid? ProductId,
    string? ProductReference,
    string? ProductName,
    string Description,
    decimal Quantity,
    decimal UnitPrice,
    decimal ReceivedQuantity,
    decimal LineTotal);

public sealed record CreatePurchaseOrderRequest(Guid SupplierId, DateOnly? ExpectedAt, IReadOnlyList<CreatePurchaseOrderLineRequest> Lines);
public sealed record CreatePurchaseOrderLineRequest(Guid? ProductId, string Description, decimal Quantity, decimal UnitPrice);
public sealed record UpdatePurchaseOrderStatusRequest(string Status);
public sealed record UpdatePurchaseOrderExpectedAtRequest(DateOnly? ExpectedAt);

public interface IPurchaseOrderService
{
    Task<PagedResult<PurchaseOrderDto>> SearchAsync(int page, int pageSize, CancellationToken cancellationToken);
    Task<Result<PurchaseOrderDto>> GetAsync(Guid id, CancellationToken cancellationToken);
    Task<Result<PurchaseOrderDto>> CreateAsync(CreatePurchaseOrderRequest request, CancellationToken cancellationToken);
    Task<Result<PurchaseOrderDto>> ChangeStatusAsync(Guid id, UpdatePurchaseOrderStatusRequest request, CancellationToken cancellationToken);
    Task<Result<PurchaseOrderDto>> UpdateExpectedAtAsync(Guid id, UpdatePurchaseOrderExpectedAtRequest request, CancellationToken cancellationToken);
}
