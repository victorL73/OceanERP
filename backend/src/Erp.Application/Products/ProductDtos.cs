namespace Erp.Application.Products;

public sealed record ProductDto(
    Guid Id,
    string Reference,
    string Name,
    string? Description,
    string? ImageUrl,
    decimal PurchasePrice,
    decimal SalePrice,
    decimal VatRate,
    Guid? CategoryId,
    string? CategoryName,
    Guid? MainSupplierId,
    string? MainSupplierName,
    bool IsActive);

public sealed record ProductCategoryDto(Guid Id, string Name, string? Description);
public sealed record ProductSupplierDto(Guid Id, string Name, string? Email, string? Phone);
public sealed record CreateProductRequest(string Reference, string Name, string? Description, decimal PurchasePrice, decimal SalePrice, decimal VatRate, Guid? CategoryId, Guid? MainSupplierId, string? ImageUrl = null);
public sealed record UpdateProductRequest(string Name, string? Description, decimal PurchasePrice, decimal SalePrice, decimal VatRate, Guid? CategoryId, Guid? MainSupplierId, bool IsActive, string? ImageUrl = null);
public sealed record CreateProductCategoryRequest(string Name, string? Description);
public sealed record CreateProductSupplierRequest(string Name, string? Email, string? Phone);
