using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using Erp.Application.Auth;
using Erp.Application.Customers;
using Erp.Application.Invoices;
using Erp.Application.Prestashop;
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
        var warehouse = warehouses!.First();

        var response = await client.PostAsJsonAsync("/api/stock/adjustments", new AdjustStockRequest(product.Id, warehouse.Id, 5, "Initial stock", 2));

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var movement = await response.Content.ReadFromJsonAsync<StockMovementDto>();
        Assert.Equal(5, movement!.Quantity);
        Assert.Equal("Adjustment", movement.Type);
    }

    [Fact]
    public async Task SalesOrderWorkflow_ReservesAndShipsStock()
    {
        using var client = await CreateAuthenticatedClientAsync();
        var customer = await CreateCustomerAsync(client);
        var product = await CreateProductAsync(client);
        var warehouses = await client.GetFromJsonAsync<IReadOnlyList<WarehouseDto>>("/api/stock/warehouses");
        var warehouse = warehouses!.First();
        var stockResponse = await client.PostAsJsonAsync("/api/stock/adjustments", new AdjustStockRequest(product.Id, warehouse.Id, 5, "Initial stock", 2));
        stockResponse.EnsureSuccessStatusCode();

        var orderResponse = await client.PostAsJsonAsync("/api/orders", new CreateSalesOrderRequest(
            customer.Id,
            warehouse.Id,
            [new CreateSalesOrderLineRequest(product.Id, "Integration line", 2, 50)]));
        Assert.Equal(HttpStatusCode.Created, orderResponse.StatusCode);
        var order = await orderResponse.Content.ReadFromJsonAsync<SalesOrderDto>();

        var confirmResponse = await client.PostAsJsonAsync($"/api/orders/{order!.Id}/status", new UpdateSalesOrderStatusRequest("Confirmed"));
        Assert.Equal(HttpStatusCode.OK, confirmResponse.StatusCode);
        var reservedItems = await client.GetFromJsonAsync<IReadOnlyList<StockItemDto>>("/api/stock/items");
        var reserved = Assert.Single(reservedItems!, x => x.ProductId == product.Id);
        Assert.Equal(2, reserved.QuantityReserved);
        Assert.Equal(3, reserved.AvailableQuantity);

        var shipResponse = await client.PostAsJsonAsync($"/api/orders/{order.Id}/status", new UpdateSalesOrderStatusRequest("Shipped"));
        Assert.Equal(HttpStatusCode.OK, shipResponse.StatusCode);
        var shippedItems = await client.GetFromJsonAsync<IReadOnlyList<StockItemDto>>("/api/stock/items");
        var shipped = Assert.Single(shippedItems!, x => x.ProductId == product.Id);
        Assert.Equal(0, shipped.QuantityReserved);
        Assert.Equal(3, shipped.QuantityOnHand);
    }

    [Fact]
    public async Task Invoice_CreateFromShippedOrderAndGeneratePdf_ReturnsDocument()
    {
        using var client = await CreateAuthenticatedClientAsync();
        var customer = await CreateCustomerAsync(client);
        var product = await CreateProductAsync(client);
        var warehouse = (await client.GetFromJsonAsync<IReadOnlyList<WarehouseDto>>("/api/stock/warehouses"))!.First();
        (await client.PostAsJsonAsync("/api/stock/adjustments", new AdjustStockRequest(product.Id, warehouse.Id, 5, "Initial stock", 2))).EnsureSuccessStatusCode();
        var orderResponse = await client.PostAsJsonAsync("/api/orders", new CreateSalesOrderRequest(
            customer.Id,
            warehouse.Id,
            [new CreateSalesOrderLineRequest(product.Id, "Integration line", 2, 50)]));
        var order = await orderResponse.Content.ReadFromJsonAsync<SalesOrderDto>();
        (await client.PostAsJsonAsync($"/api/orders/{order!.Id}/status", new UpdateSalesOrderStatusRequest("Confirmed"))).EnsureSuccessStatusCode();
        (await client.PostAsJsonAsync($"/api/orders/{order.Id}/status", new UpdateSalesOrderStatusRequest("Shipped"))).EnsureSuccessStatusCode();

        var invoiceResponse = await client.PostAsJsonAsync("/api/invoices/from-order", new CreateInvoiceFromOrderRequest(order!.Id));

        Assert.Equal(HttpStatusCode.Created, invoiceResponse.StatusCode);
        var invoice = await invoiceResponse.Content.ReadFromJsonAsync<InvoiceDto>();
        Assert.Equal(100, invoice!.Total);
        Assert.Equal(100, invoice.BalanceDue);

        var documentResponse = await client.PostAsync($"/api/invoices/{invoice.Id}/pdf", null);
        Assert.Equal(HttpStatusCode.OK, documentResponse.StatusCode);
        var document = await documentResponse.Content.ReadFromJsonAsync<InvoiceDocumentDto>();
        Assert.EndsWith(".pdf", document!.FileName);
    }

    [Fact]
    public async Task Prestashop_AdminCanCreateAndUpdateProtectedApiKey()
    {
        using var client = await CreateAuthenticatedClientAsync();

        var createResponse = await client.PostAsJsonAsync("/api/prestashop/connections", new CreatePrestashopConnectionRequest("https://shop.example.com", "prestashop-key-1", null));

        Assert.Equal(HttpStatusCode.OK, createResponse.StatusCode);
        var connection = await createResponse.Content.ReadFromJsonAsync<PrestashopConnectionDto>();
        Assert.True(connection!.HasApiKey);

        var updateResponse = await client.PutAsJsonAsync($"/api/prestashop/connections/{connection.Id}", new UpdatePrestashopConnectionRequest("https://shop.example.com/fr", "prestashop-key-2", true, false, null));

        Assert.Equal(HttpStatusCode.OK, updateResponse.StatusCode);
        var updated = await updateResponse.Content.ReadFromJsonAsync<PrestashopConnectionDto>();
        Assert.Equal("https://shop.example.com/fr", updated!.ShopUrl);
        Assert.True(updated.HasApiKey);

        var clearResponse = await client.PutAsJsonAsync($"/api/prestashop/connections/{connection.Id}", new UpdatePrestashopConnectionRequest("https://shop.example.com/fr", null, true, true, null));
        Assert.Equal(HttpStatusCode.OK, clearResponse.StatusCode);
        var cleared = await clearResponse.Content.ReadFromJsonAsync<PrestashopConnectionDto>();
        Assert.False(cleared!.HasApiKey);
    }

    [Fact]
    public async Task Warehouses_AdminCanUpdateDeleteAndMoveStockItem()
    {
        using var client = await CreateAuthenticatedClientAsync();
        var targetResponse = await client.PostAsJsonAsync("/api/stock/warehouses", new CreateWarehouseRequest(
            $"Depot-{Guid.NewGuid():N}"[..16],
            "1 rue du Port",
            null,
            "17000",
            "La Rochelle",
            "France",
            "Responsable depot",
            "0102030405",
            "depot@example.com",
            "Entrepot test"));
        Assert.Equal(HttpStatusCode.OK, targetResponse.StatusCode);
        var target = await targetResponse.Content.ReadFromJsonAsync<WarehouseDto>();
        Assert.Equal("Responsable depot", target!.RepresentativeName);

        var updateResponse = await client.PutAsJsonAsync($"/api/stock/warehouses/{target.Id}", new UpdateWarehouseRequest($"{target.Name}-B", City: "Rochefort"));
        Assert.Equal(HttpStatusCode.OK, updateResponse.StatusCode);
        var updatedTarget = await updateResponse.Content.ReadFromJsonAsync<WarehouseDto>();
        Assert.EndsWith("-B", updatedTarget!.Name);
        Assert.Equal("Rochefort", updatedTarget.City);

        var deleteCandidateResponse = await client.PostAsJsonAsync("/api/stock/warehouses", new CreateWarehouseRequest($"Temp-{Guid.NewGuid():N}"[..15]));
        deleteCandidateResponse.EnsureSuccessStatusCode();
        var deleteCandidate = await deleteCandidateResponse.Content.ReadFromJsonAsync<WarehouseDto>();
        var deleteResponse = await client.DeleteAsync($"/api/stock/warehouses/{deleteCandidate!.Id}");
        Assert.Equal(HttpStatusCode.NoContent, deleteResponse.StatusCode);

        var product = await CreateProductAsync(client);
        var source = (await client.GetFromJsonAsync<IReadOnlyList<WarehouseDto>>("/api/stock/warehouses"))!.First(x => x.Id != updatedTarget.Id);
        (await client.PostAsJsonAsync("/api/stock/adjustments", new AdjustStockRequest(product.Id, source.Id, 5, "Initial stock", 2))).EnsureSuccessStatusCode();
        var item = Assert.Single((await client.GetFromJsonAsync<IReadOnlyList<StockItemDto>>("/api/stock/items"))!, x => x.ProductId == product.Id && x.WarehouseId == source.Id);

        var moveResponse = await client.PutAsJsonAsync($"/api/stock/items/{item.Id}", new UpdateStockItemRequest(updatedTarget.Id, 7, 1));

        Assert.Equal(HttpStatusCode.OK, moveResponse.StatusCode);
        var moved = await moveResponse.Content.ReadFromJsonAsync<StockItemDto>();
        Assert.Equal(updatedTarget.Id, moved!.WarehouseId);
        Assert.Equal(7, moved.QuantityOnHand);
        Assert.Equal(1, moved.AlertThreshold);
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
