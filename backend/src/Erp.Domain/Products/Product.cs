using Erp.Domain.Common;

namespace Erp.Domain.Products;

public sealed class Product : AuditableEntity
{
    public string Reference { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public decimal PurchasePrice { get; set; }
    public decimal SalePrice { get; set; }
    public decimal VatRate { get; set; } = 20m;
    public Guid? CategoryId { get; set; }
    public ProductCategory? Category { get; set; }
    public Guid? MainSupplierId { get; set; }
    public ProductSupplier? MainSupplier { get; set; }
    public bool IsActive { get; set; } = true;
}

