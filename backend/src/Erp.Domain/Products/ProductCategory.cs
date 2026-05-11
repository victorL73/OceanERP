using Erp.Domain.Common;

namespace Erp.Domain.Products;

public sealed class ProductCategory : AuditableEntity
{
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public ICollection<Product> Products { get; set; } = new List<Product>();
}

