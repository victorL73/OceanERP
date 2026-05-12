using Erp.Application.Common;

namespace Erp.Application.Purchases;

public sealed record PurchaseOrderDto(
    Guid Id,
    string Number,
    Guid SupplierId,
    string? SupplierName,
    string Status,
    DateOnly? ExpectedAt,
    string? Comment,
    decimal LinesNetTotal,
    decimal LinesVatTotal,
    decimal ChargesNetTotal,
    decimal ChargesVatTotal,
    decimal Total,
    IReadOnlyList<PurchaseOrderLineDto> Lines,
    IReadOnlyList<PurchaseOrderChargeDto> Charges);

public sealed record PurchaseOrderLineDto(
    Guid Id,
    Guid? ProductId,
    string? ProductReference,
    string? ProductName,
    string Description,
    decimal Quantity,
    decimal UnitPrice,
    decimal VatRate,
    decimal ReceivedQuantity,
    decimal LineNetTotal,
    decimal LineVatTotal,
    decimal LineTotal);

public sealed record PurchaseOrderChargeDto(Guid Id, string Label, decimal Amount, decimal VatRate, decimal VatTotal, decimal Total);

public sealed record CreatePurchaseOrderRequest(Guid SupplierId, DateOnly? ExpectedAt, IReadOnlyList<CreatePurchaseOrderLineRequest> Lines, string? Comment = null, IReadOnlyList<CreatePurchaseOrderChargeRequest>? Charges = null);
public sealed record CreatePurchaseOrderLineRequest(Guid? ProductId, string Description, decimal Quantity, decimal UnitPrice, decimal? VatRate = null);
public sealed record CreatePurchaseOrderChargeRequest(string Label, decimal Amount, decimal VatRate);
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
