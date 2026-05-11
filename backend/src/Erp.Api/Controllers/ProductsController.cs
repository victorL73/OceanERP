using Erp.Application.Products;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Erp.Api.Controllers;

[ApiController]
[Route("api/products")]
[Authorize]
public sealed class ProductsController(IProductService products) : ControllerBase
{
    [HttpGet]
    [Authorize(Policy = "products.read")]
    public async Task<ActionResult> Search([FromQuery] string? search, [FromQuery] int page = 1, [FromQuery] int pageSize = 20, CancellationToken cancellationToken = default)
        => Ok(await products.SearchAsync(search, page, pageSize, cancellationToken));

    [HttpGet("{id:guid}")]
    [Authorize(Policy = "products.read")]
    public async Task<ActionResult<ProductDto>> Get(Guid id, CancellationToken cancellationToken)
    {
        var result = await products.GetAsync(id, cancellationToken);
        return result.Succeeded ? Ok(result.Value) : NotFound(new { error = result.Error });
    }

    [HttpPost]
    [Authorize(Policy = "products.write")]
    public async Task<ActionResult<ProductDto>> Create(CreateProductRequest request, CancellationToken cancellationToken)
    {
        var result = await products.CreateAsync(request, cancellationToken);
        return result.Succeeded ? CreatedAtAction(nameof(Get), new { id = result.Value!.Id }, result.Value) : BadRequest(new { error = result.Error });
    }

    [HttpPut("{id:guid}")]
    [Authorize(Policy = "products.write")]
    public async Task<ActionResult<ProductDto>> Update(Guid id, UpdateProductRequest request, CancellationToken cancellationToken)
    {
        var result = await products.UpdateAsync(id, request, cancellationToken);
        return result.Succeeded ? Ok(result.Value) : BadRequest(new { error = result.Error });
    }

    [HttpGet("categories")]
    [Authorize(Policy = "products.read")]
    public async Task<ActionResult<IReadOnlyList<ProductCategoryDto>>> Categories(CancellationToken cancellationToken)
        => Ok(await products.GetCategoriesAsync(cancellationToken));

    [HttpPost("categories")]
    [Authorize(Policy = "products.write")]
    public async Task<ActionResult<ProductCategoryDto>> CreateCategory(CreateProductCategoryRequest request, CancellationToken cancellationToken)
    {
        var result = await products.CreateCategoryAsync(request, cancellationToken);
        return result.Succeeded ? Ok(result.Value) : BadRequest(new { error = result.Error });
    }

    [HttpGet("suppliers")]
    [Authorize(Policy = "products.read")]
    public async Task<ActionResult<IReadOnlyList<ProductSupplierDto>>> Suppliers(CancellationToken cancellationToken)
        => Ok(await products.GetSuppliersAsync(cancellationToken));

    [HttpPost("suppliers")]
    [Authorize(Policy = "products.write")]
    public async Task<ActionResult<ProductSupplierDto>> CreateSupplier(CreateProductSupplierRequest request, CancellationToken cancellationToken)
    {
        var result = await products.CreateSupplierAsync(request, cancellationToken);
        return result.Succeeded ? Ok(result.Value) : BadRequest(new { error = result.Error });
    }
}

