using Erp.Application.Common;

namespace Erp.Application.Products;

public interface IProductService
{
    Task<PagedResult<ProductDto>> SearchAsync(string? search, int page, int pageSize, CancellationToken cancellationToken);
    Task<Result<ProductDto>> GetAsync(Guid id, CancellationToken cancellationToken);
    Task<Result<ProductDto>> CreateAsync(CreateProductRequest request, CancellationToken cancellationToken);
    Task<Result<ProductDto>> UpdateAsync(Guid id, UpdateProductRequest request, CancellationToken cancellationToken);
    Task<IReadOnlyList<ProductCategoryDto>> GetCategoriesAsync(CancellationToken cancellationToken);
    Task<IReadOnlyList<ProductSupplierDto>> GetSuppliersAsync(CancellationToken cancellationToken);
    Task<Result<ProductCategoryDto>> CreateCategoryAsync(CreateProductCategoryRequest request, CancellationToken cancellationToken);
    Task<Result<ProductSupplierDto>> CreateSupplierAsync(CreateProductSupplierRequest request, CancellationToken cancellationToken);
}

