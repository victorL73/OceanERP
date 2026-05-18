namespace Erp.Application.Sales;

public sealed record SalesOrderDto(
    Guid Id,
    string Number,
    Guid CustomerId,
    string? CustomerName,
    Guid? WarehouseId,
    string? WarehouseName,
    string Status,
    string? ExternalStatusName,
    decimal Total,
    DateTimeOffset? OrderedAt,
    string? PaymentMethod,
    string? PaymentModule,
    decimal? PaidTotal,
    decimal? ProductsTotal,
    decimal? ShippingTotal,
    decimal? ShippingWeightKg,
    string? InvoiceReference,
    string? ShippingServiceName,
    string? ShippingCarrierName,
    string? ShippingTrackingNumber,
    SalesOrderShippingAddressDto? ShippingAddress,
    bool CanPrintShippingSlip,
    bool CanPrintColissimoLabel,
    DateTimeOffset CreatedAt,
    DateTimeOffset? ConfirmedAt,
    DateTimeOffset? ShippedAt,
    DateTimeOffset? CompletedAt,
    DateTimeOffset? CancelledAt,
    IReadOnlyList<SalesOrderLineDto> Lines,
    IReadOnlyList<SalesOrderStatusHistoryDto> StatusHistory);
public sealed record SalesOrderLineDto(Guid Id, Guid? ProductId, string Description, decimal Quantity, decimal UnitPrice, decimal LineTotal);
public sealed record SalesOrderShippingAddressDto(string? Name, string? Line1, string? Line2, string? PostalCode, string? City, string? Country, string? Phone, string? Email);
public sealed record SalesOrderStatusHistoryDto(Guid Id, string Status, DateTimeOffset ChangedAt);
public sealed record SalesOrderShipmentSlipFileDto(string FileName, string MimeType, byte[] Content);
public sealed record SalesOrderShipmentSlipPdfModel(
    string OrderNumber,
    string CustomerName,
    string? CarrierName,
    string? TrackingNumber,
    SalesOrderShippingAddressDto ShippingAddress,
    IReadOnlyList<SalesOrderLineDto> Lines,
    DateTimeOffset CreatedAt);
public sealed record CreateSalesOrderRequest(Guid CustomerId, Guid? WarehouseId, IReadOnlyList<CreateSalesOrderLineRequest> Lines);
public sealed record CreateSalesOrderLineRequest(Guid? ProductId, string Description, decimal Quantity, decimal UnitPrice);
public sealed record CreateSalesOrderFromQuoteRequest(Guid QuoteId, Guid? WarehouseId = null);
public sealed record UpdateSalesOrderStatusRequest(string Status);
