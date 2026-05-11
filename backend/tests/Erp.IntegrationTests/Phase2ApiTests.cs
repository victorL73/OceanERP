using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using Erp.Application.Auth;
using Erp.Application.Customers;
using Erp.Application.Invoices;
using Erp.Application.Products;
using Erp.Application.Sales;
using Erp.Application.Stock;

namespace Erp.IntegrationTests;

public sealed class Phase2ApiTests(ApiFactory factory) : IClassFixture<ApiFactory>
{
    [Fact]
    public async Task StockAdjustment_WithProductAndWarehouse_ReturnsMovement()
    {
        using var client = await CreateAuthenticatedClientAsync();
        var product = await CreateProductAsync(client);
        var warehouses = await client.GetFromJsonAsync<IReadOnlyList<WarehouseDto>>("/api/stock/warehouses");
        var warehouse = Assert.Single(warehouses!);

        var response = await client.PostAsJsonAsync("/api/stock/adjustments", new AdjustStockRequest(product.Id, warehouse.Id, 5, "Initial stock", 2));

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var movement = await response.Content.ReadFromJsonAsync<StockMovementDto>();
        Assert.Equal(5, movement!.Quantity);
    }

    [Fact]
    public async Task SalesOrderAndInvoice_CreateFromApi_ReturnsInvoice()
    {
        using var client = await CreateAuthenticatedClientAsync();
        var customer = await CreateCustomerAsync(client);

        var orderResponse = await client.PostAsJsonAsync("/api/orders", new CreateSalesOrderRequest(
            customer.Id,
            [new CreateSalesOrderLineRequest("Integration line", 2, 50)]));
        Assert.Equal(HttpStatusCode.Created, orderResponse.StatusCode);
        var order = await orderResponse.Content.ReadFromJsonAsync<SalesOrderDto>();

        var invoiceResponse = await client.PostAsJsonAsync("/api/invoices/from-order", new CreateInvoiceFromOrderRequest(order!.Id));

        Assert.Equal(HttpStatusCode.Created, invoiceResponse.StatusCode);
        var invoice = await invoiceResponse.Content.ReadFromJsonAsync<InvoiceDto>();
        Assert.Equal(100, invoice!.Total);
    }

    private async Task<HttpClient> CreateAuthenticatedClientAsync()
    {
        var client = factory.CreateClient(new() { BaseAddress = new Uri("https://localhost") });
        var response = await client.PostAsJsonAsync("/api/auth/login", new LoginRequest("admin@oceanerp.local", "ChangeMe!12345"));
        response.EnsureSuccessStatusCode();
        var auth = await response.Content.ReadFromJsonAsync<AuthResponse>();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", auth!.AccessToken);
        return client;
    }

    private static async Task<CustomerDto> CreateCustomerAsync(HttpClient client)
    {
        var response = await client.PostAsJsonAsync("/api/customers", new CreateCustomerRequest(
            $"C-{Guid.NewGuid():N}"[..10],
            "Client integration",
            null,
            null,
            [],
            []));
        response.EnsureSuccessStatusCode();
        return (await response.Content.ReadFromJsonAsync<CustomerDto>())!;
    }

    private static async Task<ProductDto> CreateProductAsync(HttpClient client)
    {
        var response = await client.PostAsJsonAsync("/api/products", new CreateProductRequest(
            $"P-{Guid.NewGuid():N}"[..10],
            "Produit integration",
            null,
            10,
            20,
            20,
            null,
            null));
        response.EnsureSuccessStatusCode();
        return (await response.Content.ReadFromJsonAsync<ProductDto>())!;
    }
}

