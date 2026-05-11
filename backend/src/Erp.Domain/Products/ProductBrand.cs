using Erp.Domain.Common;

namespace Erp.Domain.Products;

public sealed class ProductBrand : AuditableEntity
{
    public string Name { get; set; } = string.Empty;
    public ICollection<Product> Products { get; set; } = new List<Product>();
}
