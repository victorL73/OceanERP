using Erp.Application.Common;
using Erp.Application.Products;
using Erp.Domain.Products;
using Erp.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Erp.Infrastructure.Services;

public sealed class ProductService(ErpDbContext db) : IProductService
{
    public async Task<PagedResult<ProductDto>> SearchAsync(string? search, int page, int pageSize, CancellationToken cancellationToken)
    {
        page = Math.Max(1, page);
        pageSize = Math.Clamp(pageSize, 1, 100);
        var query = db.Products.Include(x => x.Category).Include(x => x.MainSupplier).AsQueryable();
        if (!string.IsNullOrWhiteSpace(search))
        {
            query = query.Where(x => x.Reference.Contains(search) || x.Name.Contains(search));
        }

        var total = await query.CountAsync(cancellationToken);
        var products = await query.OrderBy(x => x.Reference).Skip((page - 1) * pageSize).Take(pageSize).ToListAsync(cancellationToken);
        return new PagedResult<ProductDto>(products.Select(Map).ToList(), total, page, pageSize);
    }

    public async Task<Result<ProductDto>> GetAsync(Guid id, CancellationToken cancellationToken)
    {
        var product = await db.Products.Include(x => x.Category).Include(x => x.MainSupplier).FirstOrDefaultAsync(x => x.Id == id, cancellationToken);
        return product is null ? Result<ProductDto>.Failure("Product not found.") : Result<ProductDto>.Success(Map(product));
    }

    public async Task<Result<ProductDto>> CreateAsync(CreateProductRequest request, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.Reference) || string.IsNullOrWhiteSpace(request.Name))
        {
            return Result<ProductDto>.Failure("Product reference and name are required.");
        }

        if (await db.Products.AnyAsync(x => x.Reference == request.Reference, cancellationToken))
        {
            return Result<ProductDto>.Failure("Product reference already exists.");
        }

        var product = new Product
        {
            Reference = request.Reference.Trim(),
            Name = request.Name.Trim(),
            Description = request.Description,
            ImageUrl = NormalizeOptional(request.ImageUrl),
            PurchasePrice = request.PurchasePrice,
            SalePrice = request.SalePrice,
            VatRate = request.VatRate,
            CategoryId = request.CategoryId,
            MainSupplierId = request.MainSupplierId
        };

        db.Products.Add(product);
        await db.SaveChangesAsync(cancellationToken);
        await db.Entry(product).Reference(x => x.Category).LoadAsync(cancellationToken);
        await db.Entry(product).Reference(x => x.MainSupplier).LoadAsync(cancellationToken);
        return Result<ProductDto>.Success(Map(product));
    }

    public async Task<Result<ProductDto>> UpdateAsync(Guid id, UpdateProductRequest request, CancellationToken cancellationToken)
    {
        var product = await db.Products.Include(x => x.Category).Include(x => x.MainSupplier).FirstOrDefaultAsync(x => x.Id == id, cancellationToken);
        if (product is null)
        {
            return Result<ProductDto>.Failure("Product not found.");
        }

        product.Name = request.Name.Trim();
        product.Description = request.Description;
        product.ImageUrl = NormalizeOptional(request.ImageUrl);
        product.PurchasePrice = request.PurchasePrice;
        product.SalePrice = request.SalePrice;
        product.VatRate = request.VatRate;
        product.CategoryId = request.CategoryId;
        product.MainSupplierId = request.MainSupplierId;
        product.IsActive = request.IsActive;
        await db.SaveChangesAsync(cancellationToken);
        return Result<ProductDto>.Success(Map(product));
    }

    public async Task<IReadOnlyList<ProductCategoryDto>> GetCategoriesAsync(CancellationToken cancellationToken)
        => await db.ProductCategories.OrderBy(x => x.Name).Select(x => new ProductCategoryDto(x.Id, x.Name, x.Description)).ToListAsync(cancellationToken);

    public async Task<IReadOnlyList<ProductSupplierDto>> GetSuppliersAsync(CancellationToken cancellationToken)
        => await db.ProductSuppliers.OrderBy(x => x.Name).Select(x => new ProductSupplierDto(x.Id, x.Name, x.Email, x.Phone)).ToListAsync(cancellationToken);

    public async Task<Result<ProductCategoryDto>> CreateCategoryAsync(CreateProductCategoryRequest request, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.Name))
        {
            return Result<ProductCategoryDto>.Failure("Category name is required.");
        }

        var category = new ProductCategory { Name = request.Name.Trim(), Description = request.Description };
        db.ProductCategories.Add(category);
        await db.SaveChangesAsync(cancellationToken);
        return Result<ProductCategoryDto>.Success(new ProductCategoryDto(category.Id, category.Name, category.Description));
    }

    public async Task<Result<ProductSupplierDto>> CreateSupplierAsync(CreateProductSupplierRequest request, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.Name))
        {
            return Result<ProductSupplierDto>.Failure("Supplier name is required.");
        }

        var supplier = new ProductSupplier { Name = request.Name.Trim(), Email = request.Email, Phone = request.Phone };
        db.ProductSuppliers.Add(supplier);
        await db.SaveChangesAsync(cancellationToken);
        return Result<ProductSupplierDto>.Success(new ProductSupplierDto(supplier.Id, supplier.Name, supplier.Email, supplier.Phone));
    }

    private static ProductDto Map(Product product)
        => new(
            product.Id,
            product.Reference,
            product.Name,
            product.Description,
            product.ImageUrl,
            product.PurchasePrice,
            product.SalePrice,
            product.VatRate,
            product.CategoryId,
            product.Category?.Name,
            product.MainSupplierId,
            product.MainSupplier?.Name,
            product.IsActive);

    private static string? NormalizeOptional(string? value)
        => string.IsNullOrWhiteSpace(value) ? null : value.Trim();
}
