using Erp.Application.Common;
using Erp.Application.Products;
using Erp.Domain.FutureModules;
using Erp.Domain.Products;
using Erp.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using System.Globalization;
using System.Net.Http.Headers;
using System.Text;
using System.Text.RegularExpressions;
using System.Xml.Linq;

namespace Erp.Infrastructure.Services;

public sealed class ProductService(ErpDbContext db, IConfiguration configuration, IHttpClientFactory httpClientFactory) : IProductService
{
    private const string PrestashopProvider = "PrestaShop";
    private const string PrestashopProductModule = "products";
    private static readonly HashSet<string> PrestashopReadOnlyProductFields = new(StringComparer.OrdinalIgnoreCase)
    {
        "manufacturer_name",
        "quantity"
    };

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

        var nextReference = NormalizeOptional(request.Reference) ?? product.Reference;
        if (string.IsNullOrWhiteSpace(nextReference) || string.IsNullOrWhiteSpace(request.Name))
        {
            return Result<ProductDto>.Failure("Product reference and name are required.");
        }

        if (!nextReference.Equals(product.Reference, StringComparison.OrdinalIgnoreCase)
            && await db.Products.AnyAsync(x => x.Id != id && x.Reference == nextReference, cancellationToken))
        {
            return Result<ProductDto>.Failure("Product reference already exists.");
        }

        product.Reference = nextReference;
        product.Name = request.Name.Trim();
        product.Description = request.Description;
        product.ImageUrl = NormalizeOptional(request.ImageUrl);
        product.PurchasePrice = request.PurchasePrice;
        product.SalePrice = request.SalePrice;
        product.VatRate = request.VatRate;
        product.CategoryId = request.CategoryId;
        product.MainSupplierId = request.MainSupplierId;
        product.IsActive = request.IsActive;

        var publishResult = await PublishPrestashopProductAsync(product, cancellationToken);
        if (!publishResult.Succeeded)
        {
            return Result<ProductDto>.Failure(publishResult.Error!);
        }

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

    private async Task<Result> PublishPrestashopProductAsync(Product product, CancellationToken cancellationToken)
    {
        var externalReference = await db.ExternalReferences.FirstOrDefaultAsync(
            x => x.Provider == PrestashopProvider && x.Module == PrestashopProductModule && x.EntityId == product.Id,
            cancellationToken);
        if (externalReference is null)
        {
            return Result.Success();
        }

        var externalProductId = ExtractPrestashopProductId(externalReference);
        if (string.IsNullOrWhiteSpace(externalProductId))
        {
            return Result.Failure("Reference PrestaShop produit invalide.");
        }

        var connection = await db.PrestashopConnections
            .Where(x => x.IsActive)
            .OrderByDescending(x => x.UpdatedAt ?? x.CreatedAt)
            .FirstOrDefaultAsync(cancellationToken);
        if (connection is null)
        {
            return Result.Failure("Aucune connexion PrestaShop active n'est configuree.");
        }

        var apiKeyResult = PrestashopSecretProtector.ResolveApiKey(configuration, connection);
        if (!apiKeyResult.Succeeded)
        {
            return Result.Failure(apiKeyResult.Error ?? "Cle API PrestaShop non configuree.");
        }

        try
        {
            var apiBaseUrl = GetApiBaseUrl(connection.ShopUrl);
            var document = await GetPrestashopXmlAsync(apiBaseUrl, externalProductId, apiKeyResult.Value!, cancellationToken);
            var productElement = document.Root?.Element("product") ?? document.Descendants("product").FirstOrDefault();
            if (productElement is null)
            {
                return Result.Failure("Reponse PrestaShop produit invalide.");
            }

            RemovePrestashopReadOnlyFields(productElement);
            SetElementValue(productElement, "reference", product.Reference);
            SetElementValue(productElement, "name", product.Name);
            SetElementValue(productElement, "price", FormatDecimal(product.SalePrice));
            SetElementValue(productElement, "wholesale_price", FormatDecimal(product.PurchasePrice));
            SetElementValue(productElement, "active", product.IsActive ? "1" : "0");
            SetElementValue(productElement, "description", product.Description ?? string.Empty);
            SetElementValue(productElement, "description_short", BuildDescriptionShort(product.Description));

            await PutPrestashopXmlAsync(apiBaseUrl, externalProductId, apiKeyResult.Value!, document, cancellationToken);
            return Result.Success();
        }
        catch (OperationCanceledException)
        {
            throw;
        }
        catch (Exception ex)
        {
            return Result.Failure($"Modification PrestaShop impossible: {TrimDetail(FullExceptionMessage(ex))}");
        }
    }

    private async Task<XDocument> GetPrestashopXmlAsync(string apiBaseUrl, string externalProductId, string apiKey, CancellationToken cancellationToken)
    {
        var httpClient = httpClientFactory.CreateClient(nameof(ProductService));
        using var request = new HttpRequestMessage(HttpMethod.Get, $"{apiBaseUrl}/products/{externalProductId}?display=full&output_format=XML");
        AddPrestashopHeaders(request, apiKey);

        using var response = await httpClient.SendAsync(request, cancellationToken);
        var body = await response.Content.ReadAsStringAsync(cancellationToken);
        if (!response.IsSuccessStatusCode)
        {
            throw new InvalidOperationException($"GET produit PrestaShop HTTP {(int)response.StatusCode} {TrimDetail(body)}");
        }

        return XDocument.Parse(body, LoadOptions.PreserveWhitespace);
    }

    private async Task PutPrestashopXmlAsync(string apiBaseUrl, string externalProductId, string apiKey, XDocument document, CancellationToken cancellationToken)
    {
        var httpClient = httpClientFactory.CreateClient(nameof(ProductService));
        using var request = new HttpRequestMessage(HttpMethod.Put, $"{apiBaseUrl}/products/{externalProductId}");
        AddPrestashopHeaders(request, apiKey);
        request.Content = new StringContent(document.ToString(SaveOptions.DisableFormatting), Encoding.UTF8, "application/xml");

        using var response = await httpClient.SendAsync(request, cancellationToken);
        var body = await response.Content.ReadAsStringAsync(cancellationToken);
        if (!response.IsSuccessStatusCode)
        {
            throw new InvalidOperationException($"PUT produit PrestaShop HTTP {(int)response.StatusCode} {TrimDetail(body)}");
        }
    }

    private static void RemovePrestashopReadOnlyFields(XElement productElement)
    {
        foreach (var child in productElement.Elements().Where(x => PrestashopReadOnlyProductFields.Contains(x.Name.LocalName)).ToList())
        {
            child.Remove();
        }
    }

    private static void AddPrestashopHeaders(HttpRequestMessage request, string apiKey)
    {
        request.Headers.Authorization = new AuthenticationHeaderValue(
            "Basic",
            Convert.ToBase64String(Encoding.ASCII.GetBytes($"{apiKey}:")));
        request.Headers.Accept.Add(new MediaTypeWithQualityHeaderValue("application/xml"));
    }

    private static void SetElementValue(XElement parent, string name, string value)
    {
        var element = parent.Element(name);
        if (element is null)
        {
            element = new XElement(name);
            parent.Add(element);
        }

        var languageElements = element.Elements("language").ToList();
        if (languageElements.Count == 0)
        {
            element.Value = value;
            return;
        }

        foreach (var languageElement in languageElements)
        {
            languageElement.Value = value;
        }
    }

    private static string BuildDescriptionShort(string? description)
    {
        if (string.IsNullOrWhiteSpace(description))
        {
            return string.Empty;
        }

        var plainText = Regex.Replace(description, "<.*?>", " ").Replace("&nbsp;", " ");
        plainText = Regex.Replace(plainText, @"\s+", " ").Trim();
        return plainText.Length <= 500 ? plainText : plainText[..500];
    }

    private static string? ExtractPrestashopProductId(ExternalReference externalReference)
    {
        var prefix = $"{PrestashopProductModule}:";
        return externalReference.ExternalId.StartsWith(prefix, StringComparison.OrdinalIgnoreCase)
            ? externalReference.ExternalId[prefix.Length..]
            : externalReference.ExternalId;
    }

    private static string GetApiBaseUrl(string shopUrl)
    {
        var normalized = shopUrl.Trim().TrimEnd('/');
        return normalized.EndsWith("/api", StringComparison.OrdinalIgnoreCase)
            ? normalized
            : $"{normalized}/api";
    }

    private static string FormatDecimal(decimal value)
        => value.ToString("0.######", CultureInfo.InvariantCulture);

    private static string TrimDetail(string detail)
        => detail.Length > 300 ? detail[..300] : detail;

    private static string FullExceptionMessage(Exception exception)
    {
        var messages = new List<string>();
        for (var current = exception; current is not null; current = current.InnerException)
        {
            if (!string.IsNullOrWhiteSpace(current.Message))
            {
                messages.Add(current.Message);
            }
        }

        return string.Join(" | ", messages.Distinct());
    }
}
