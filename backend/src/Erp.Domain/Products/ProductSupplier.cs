using Erp.Domain.Common;

namespace Erp.Domain.Products;

public sealed class ProductSupplier : AuditableEntity
{
    public string Name { get; set; } = string.Empty;
    public string? Email { get; set; }
    public string? Phone { get; set; }
    public ICollection<Product> Products { get; set; } = new List<Product>();
}

