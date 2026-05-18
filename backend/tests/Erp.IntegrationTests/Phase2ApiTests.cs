using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using Erp.Application.Auth;
using Erp.Application.Customers;
using Erp.Application.Invoices;
using Erp.Application.Prestashop;
using Erp.Application.Products;
using Erp.Application.Purchases;
using Erp.Application.Sales;
using Erp.Application.Stock;
using Erp.Application.Notifications;
using Erp.Domain.FutureModules;
using Erp.Infrastructure.Persistence;
using Microsoft.Extensions.DependencyInjection;

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

        var movements = await client.GetFromJsonAsync<IReadOnlyList<StockMovementDto>>("/api/stock/movements");
        var savedMovement = Assert.Single(movements!, x => x.Id == movement.Id);
        Assert.NotNull(savedMovement.CreatedByUserId);
        Assert.Equal("OceanERP Admin", savedMovement.CreatedByDisplayName);
        Assert.Equal("admin@oceanerp.local", savedMovement.CreatedByEmail);
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
        var confirmed = await confirmResponse.Content.ReadFromJsonAsync<SalesOrderDto>();
        Assert.Equal("Confirmed", confirmed!.Status);
        var reservedItems = await client.GetFromJsonAsync<IReadOnlyList<StockItemDto>>("/api/stock/items");
        var reserved = Assert.Single(reservedItems!, x => x.ProductId == product.Id);
        Assert.Equal(2, reserved.QuantityReserved);
        Assert.Equal(3, reserved.AvailableQuantity);

        var preparingResponse = await client.PostAsJsonAsync($"/api/orders/{order.Id}/status", new UpdateSalesOrderStatusRequest("Preparing"));
        Assert.Equal(HttpStatusCode.OK, preparingResponse.StatusCode);
        var preparing = await preparingResponse.Content.ReadFromJsonAsync<SalesOrderDto>();
        Assert.Equal("Preparing", preparing!.Status);

        var shipResponse = await client.PostAsJsonAsync($"/api/orders/{order.Id}/status", new UpdateSalesOrderStatusRequest("Shipped"));
        Assert.Equal(HttpStatusCode.OK, shipResponse.StatusCode);
        var shippedItems = await client.GetFromJsonAsync<IReadOnlyList<StockItemDto>>("/api/stock/items");
        var shipped = Assert.Single(shippedItems!, x => x.ProductId == product.Id);
        Assert.Equal(0, shipped.QuantityReserved);
        Assert.Equal(3, shipped.QuantityOnHand);
    }

    [Fact]
    public async Task SalesOrderConfirm_WithInsufficientStock_ReturnsActionableError()
    {
        using var client = await CreateAuthenticatedClientAsync();
        var customer = await CreateCustomerAsync(client);
        var product = await CreateProductAsync(client);
        var warehouses = await client.GetFromJsonAsync<IReadOnlyList<WarehouseDto>>("/api/stock/warehouses");
        var warehouse = warehouses!.First();

        var orderResponse = await client.PostAsJsonAsync("/api/orders", new CreateSalesOrderRequest(
            customer.Id,
            warehouse.Id,
            [new CreateSalesOrderLineRequest(product.Id, "Integration line", 2, 50)]));
        Assert.Equal(HttpStatusCode.Created, orderResponse.StatusCode);
        var order = await orderResponse.Content.ReadFromJsonAsync<SalesOrderDto>();

        var confirmResponse = await client.PostAsJsonAsync($"/api/orders/{order!.Id}/status", new UpdateSalesOrderStatusRequest("Confirmed"));

        Assert.Equal(HttpStatusCode.BadRequest, confirmResponse.StatusCode);
        var error = await confirmResponse.Content.ReadAsStringAsync();
        Assert.Contains("Stock insuffisant pour confirmer la commande", error);
        Assert.Contains(product.Reference, error);
    }

    [Fact]
    public async Task SalesOrderDelete_ReleasesReservedStock()
    {
        using var client = await CreateAuthenticatedClientAsync();
        var customer = await CreateCustomerAsync(client);
        var product = await CreateProductAsync(client);
        var warehouses = await client.GetFromJsonAsync<IReadOnlyList<WarehouseDto>>("/api/stock/warehouses");
        var warehouse = warehouses!.First();
        (await client.PostAsJsonAsync("/api/stock/adjustments", new AdjustStockRequest(product.Id, warehouse.Id, 5, "Initial stock", 2))).EnsureSuccessStatusCode();

        var orderResponse = await client.PostAsJsonAsync("/api/orders", new CreateSalesOrderRequest(
            customer.Id,
            warehouse.Id,
            [new CreateSalesOrderLineRequest(product.Id, "Integration line", 2, 50)]));
        orderResponse.EnsureSuccessStatusCode();
        var order = await orderResponse.Content.ReadFromJsonAsync<SalesOrderDto>();
        (await client.PostAsJsonAsync($"/api/orders/{order!.Id}/status", new UpdateSalesOrderStatusRequest("Confirmed"))).EnsureSuccessStatusCode();

        var deleteResponse = await client.DeleteAsync($"/api/orders/{order.Id}");

        Assert.Equal(HttpStatusCode.NoContent, deleteResponse.StatusCode);
        var getResponse = await client.GetAsync($"/api/orders/{order.Id}");
        Assert.Equal(HttpStatusCode.NotFound, getResponse.StatusCode);
        var stockItems = await client.GetFromJsonAsync<IReadOnlyList<StockItemDto>>("/api/stock/items");
        var stock = Assert.Single(stockItems!, x => x.ProductId == product.Id && x.WarehouseId == warehouse.Id);
        Assert.Equal(0, stock.QuantityReserved);
        Assert.Equal(5, stock.AvailableQuantity);
    }

    [Fact]
    public async Task ColissimoLabel_WhenOfficialLabelIsUnavailable_ReturnsPreparationPdf()
    {
        using var client = await CreateAuthenticatedClientAsync();
        var customer = await CreateCustomerAsync(client);

        var orderResponse = await client.PostAsJsonAsync("/api/orders", new CreateSalesOrderRequest(
            customer.Id,
            null,
            [new CreateSalesOrderLineRequest(null, "Ligne Colissimo", 1, 10)]));
        Assert.Equal(HttpStatusCode.Created, orderResponse.StatusCode);
        var order = await orderResponse.Content.ReadFromJsonAsync<SalesOrderDto>();

        using (var scope = factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<ErpDbContext>();
            var saved = await db.SalesOrders.FindAsync(order!.Id);
            saved!.ShippingCarrierName = "Colissimo Domicile sans signature";
            saved.ShippingServiceName = "FR - DOMICILE sans signature";
            saved.ShippingAddressName = "Client test";
            saved.ShippingAddressLine1 = "1 rue du Port";
            saved.ShippingPostalCode = "14980";
            saved.ShippingCity = "Rots";
            saved.ShippingCountry = "France";
            await db.SaveChangesAsync();
        }

        var labelResponse = await client.GetAsync($"/api/orders/{order!.Id}/colissimo-label");

        Assert.Equal(HttpStatusCode.OK, labelResponse.StatusCode);
        Assert.Equal("application/pdf", labelResponse.Content.Headers.ContentType?.MediaType);
        var content = await labelResponse.Content.ReadAsByteArrayAsync();
        Assert.True(content.Length > 4);
        Assert.Equal((byte)'%', content[0]);
        Assert.Equal((byte)'P', content[1]);
        Assert.Equal((byte)'D', content[2]);
        Assert.Equal((byte)'F', content[3]);
    }

    [Fact]
    public async Task Invoice_CreateFromShippedOrder_CalculatesOverdueGeneratesPdfAndCancels()
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

        var dueDate = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(-1));
        var invoiceResponse = await client.PostAsJsonAsync("/api/invoices/from-order", new CreateInvoiceFromOrderRequest(order!.Id, dueDate));

        Assert.Equal(HttpStatusCode.Created, invoiceResponse.StatusCode);
        var invoice = await invoiceResponse.Content.ReadFromJsonAsync<InvoiceDto>();
        Assert.Equal(100, invoice!.Total);
        Assert.Equal(100, invoice.BalanceDue);
        Assert.Equal("Overdue", invoice.Status);
        Assert.Contains(invoice.StatusHistory, x => x.Status == "Issued");

        var documentResponse = await client.PostAsync($"/api/invoices/{invoice.Id}/pdf", null);
        Assert.Equal(HttpStatusCode.OK, documentResponse.StatusCode);
        var document = await documentResponse.Content.ReadFromJsonAsync<InvoiceDocumentDto>();
        Assert.EndsWith(".pdf", document!.FileName);

        var creditResponse = await client.PostAsJsonAsync($"/api/invoices/{invoice.Id}/credit-note", new CreateCreditNoteRequest("Test avoir"));
        Assert.Equal(HttpStatusCode.Created, creditResponse.StatusCode);
        var credit = await creditResponse.Content.ReadFromJsonAsync<InvoiceDto>();
        Assert.Equal("CreditNote", credit!.Kind);
        Assert.Equal(invoice.Id, credit.CreditOfInvoiceId);
        Assert.Equal(invoice.Number, credit.CreditOfInvoiceNumber);
        Assert.True(credit.FacturXReady);
        Assert.StartsWith("AVO-", credit.Number);

        var creditPayment = await client.PostAsJsonAsync($"/api/invoices/{credit.Id}/payments", new AddInvoicePaymentRequest(10, DateOnly.FromDateTime(DateTime.UtcNow)));
        Assert.Equal(HttpStatusCode.BadRequest, creditPayment.StatusCode);

        var cancelResponse = await client.PostAsync($"/api/invoices/{invoice.Id}/cancel", null);
        Assert.Equal(HttpStatusCode.OK, cancelResponse.StatusCode);
        var cancelled = await cancelResponse.Content.ReadFromJsonAsync<InvoiceDto>();
        Assert.Equal("Cancelled", cancelled!.Status);
        Assert.Contains(cancelled.StatusHistory, x => x.Status == "Cancelled");

        var paymentAfterCancel = await client.PostAsJsonAsync($"/api/invoices/{invoice.Id}/payments", new AddInvoicePaymentRequest(10, DateOnly.FromDateTime(DateTime.UtcNow)));
        Assert.Equal(HttpStatusCode.BadRequest, paymentAfterCancel.StatusCode);
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
    public async Task Customer_UpdateCanReplaceContactsWithoutAddress()
    {
        using var client = await CreateAuthenticatedClientAsync();
        var customer = await CreateCustomerAsync(client);

        var updateResponse = await client.PutAsJsonAsync($"/api/customers/{customer.Id}", new UpdateCustomerRequest(
            CompanyName: "Client modifie",
            LegalName: "Client modifie SAS",
            TradeName: "Client modifie",
            SirenNumber: "123456789",
            SiretNumber: "12345678900010",
            VatNumber: "FR123456789",
            Email: "contact@example.com",
            Phone: "0102030405",
            MobilePhone: null,
            Website: "https://example.com",
            Industry: "Nautisme",
            CustomerType: "Professionnel",
            Source: "ERP",
            AccountingCode: "411TEST",
            PaymentTerms: "30 jours",
            DefaultDiscountRate: 5,
            Notes: "Note client",
            IsActive: true,
            Contacts:
            [
                new UpsertCustomerContactRequest(
                    FirstName: "Victor",
                    LastName: "Lerivray",
                    Email: "victor@example.com",
                    Phone: null,
                    JobTitle: "Dirigeant",
                    IsPrimary: true)
            ],
            Addresses: []));

        Assert.Equal(HttpStatusCode.OK, updateResponse.StatusCode);
        var updated = await updateResponse.Content.ReadFromJsonAsync<CustomerDto>();
        Assert.Equal("Client modifie", updated!.CompanyName);
        Assert.Empty(updated.Addresses);
        var contact = Assert.Single(updated.Contacts);
        Assert.Equal("victor@example.com", contact.Email);
        Assert.True(contact.IsPrimary);
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

    [Fact]
    public async Task PrestashopProductStock_CanMoveToAnotherWarehouse()
    {
        using var client = await CreateAuthenticatedClientAsync();
        var product = await CreateProductAsync(client);
        var sourceWarehouse = (await client.GetFromJsonAsync<IReadOnlyList<WarehouseDto>>("/api/stock/warehouses"))!.First();
        var otherWarehouseResponse = await client.PostAsJsonAsync("/api/stock/warehouses", new CreateWarehouseRequest($"Test-{Guid.NewGuid():N}"[..15]));
        otherWarehouseResponse.EnsureSuccessStatusCode();
        var targetWarehouse = await otherWarehouseResponse.Content.ReadFromJsonAsync<WarehouseDto>();

        await MarkProductAsPrestashopAsync(product.Id, sourceWarehouse.Id);

        var adjustment = await client.PostAsJsonAsync("/api/stock/adjustments", new AdjustStockRequest(product.Id, sourceWarehouse.Id, 5, "Initial stock", 0));
        Assert.Equal(HttpStatusCode.OK, adjustment.StatusCode);
        var item = Assert.Single((await client.GetFromJsonAsync<IReadOnlyList<StockItemDto>>("/api/stock/items"))!, x => x.ProductId == product.Id);

        var moveResponse = await client.PutAsJsonAsync($"/api/stock/items/{item.Id}", new UpdateStockItemRequest(targetWarehouse!.Id, 12, 3));
        Assert.Equal(HttpStatusCode.OK, moveResponse.StatusCode);
        var moved = await moveResponse.Content.ReadFromJsonAsync<StockItemDto>();
        Assert.Equal(targetWarehouse.Id, moved!.WarehouseId);
        Assert.Equal(12, moved.QuantityOnHand);
        Assert.Equal(3, moved.AlertThreshold);

        var stockItems = await client.GetFromJsonAsync<IReadOnlyList<StockItemDto>>("/api/stock/items");
        var productStocks = stockItems!.Where(x => x.ProductId == product.Id).ToList();
        Assert.Single(productStocks);
    }

    [Fact]
    public async Task LowStockAlert_IsDailySummaryAndIsCoveredByOpenPurchaseOrder()
    {
        using var client = await CreateAuthenticatedClientAsync();
        var supplier = (await client.GetFromJsonAsync<IReadOnlyList<ProductSupplierDto>>("/api/products/suppliers"))!.First();
        var product = await CreateProductAsync(client, supplier.Id);
        var inactiveProduct = await CreateProductAsync(client);
        var warehouse = (await client.GetFromJsonAsync<IReadOnlyList<WarehouseDto>>("/api/stock/warehouses"))!.First();

        var inactiveResponse = await client.PutAsJsonAsync($"/api/products/{inactiveProduct.Id}", new UpdateProductRequest(
            inactiveProduct.Name,
            inactiveProduct.Description,
            inactiveProduct.PurchasePrice,
            inactiveProduct.SalePrice,
            inactiveProduct.VatRate,
            inactiveProduct.CategoryId,
            inactiveProduct.MainSupplierId,
            false,
            inactiveProduct.ImageUrl,
            inactiveProduct.Reference));
        Assert.Equal(HttpStatusCode.OK, inactiveResponse.StatusCode);

        var inactiveStockResponse = await client.PostAsJsonAsync("/api/stock/adjustments", new AdjustStockRequest(inactiveProduct.Id, warehouse.Id, 0, "Inactive alert ignored", 5));
        Assert.Equal(HttpStatusCode.OK, inactiveStockResponse.StatusCode);

        var stockResponse = await client.PostAsJsonAsync("/api/stock/adjustments", new AdjustStockRequest(product.Id, warehouse.Id, 0, "Alert threshold", 5));
        Assert.Equal(HttpStatusCode.OK, stockResponse.StatusCode);

        var notifications = await client.GetFromJsonAsync<IReadOnlyList<NotificationDto>>("/api/notifications");
        var alert = Assert.Single(notifications!, x => x.Type == "stock.low.summary" && !x.IsRead);
        Assert.Contains(product.Reference, alert.Message);
        Assert.DoesNotContain(inactiveProduct.Reference, alert.Message);
        Assert.Contains(product.Id.ToString(), alert.LinkUrl);

        var markReadResponse = await client.PostAsync($"/api/notifications/{alert.Id}/read", null);
        Assert.Equal(HttpStatusCode.NoContent, markReadResponse.StatusCode);

        var repeatStockResponse = await client.PostAsJsonAsync("/api/stock/adjustments", new AdjustStockRequest(product.Id, warehouse.Id, 0, "Repeat alert same day", 5));
        Assert.Equal(HttpStatusCode.OK, repeatStockResponse.StatusCode);

        var repeatedNotifications = await client.GetFromJsonAsync<IReadOnlyList<NotificationDto>>("/api/notifications");
        var repeatedAlert = Assert.Single(repeatedNotifications!, x => x.Type == "stock.low.summary");
        Assert.Equal(alert.Id, repeatedAlert.Id);
        Assert.True(repeatedAlert.IsRead);

        var purchaseResponse = await client.PostAsJsonAsync("/api/purchases/orders", new CreatePurchaseOrderRequest(
            supplier.Id,
            DateOnly.FromDateTime(DateTime.UtcNow.AddDays(7)),
            [new CreatePurchaseOrderLineRequest(product.Id, $"{product.Reference} - {product.Name}", 10, product.PurchasePrice)],
            WarehouseId: warehouse.Id));

        Assert.Equal(HttpStatusCode.Created, purchaseResponse.StatusCode);
        var purchaseOrder = await purchaseResponse.Content.ReadFromJsonAsync<PurchaseOrderDto>();
        Assert.Equal(DateOnly.FromDateTime(DateTime.UtcNow.AddDays(7)), purchaseOrder!.ExpectedAt);

        var orderResponse = await client.PostAsJsonAsync($"/api/purchases/orders/{purchaseOrder.Id}/status", new UpdatePurchaseOrderStatusRequest("Ordered"));
        Assert.Equal(HttpStatusCode.OK, orderResponse.StatusCode);

        var afterPurchase = await client.GetFromJsonAsync<IReadOnlyList<NotificationDto>>("/api/notifications");
        Assert.DoesNotContain(afterPurchase!, x => x.Type == "stock.low.summary" && !x.IsRead && x.Message.Contains(product.Reference));
    }

    [Fact]
    public async Task PurchaseOrder_CalculatesLinesVatChargesAndComment()
    {
        using var client = await CreateAuthenticatedClientAsync();
        var supplier = (await client.GetFromJsonAsync<IReadOnlyList<ProductSupplierDto>>("/api/products/suppliers"))!.First();
        var firstProduct = await CreateProductAsync(client, supplier.Id);
        var secondProduct = await CreateProductAsync(client, supplier.Id);
        var warehouse = (await client.GetFromJsonAsync<IReadOnlyList<WarehouseDto>>("/api/stock/warehouses"))!.First();
        (await client.PostAsJsonAsync("/api/stock/adjustments", new AdjustStockRequest(firstProduct.Id, warehouse.Id, 0, "Rattachement achat", 0))).EnsureSuccessStatusCode();
        (await client.PostAsJsonAsync("/api/stock/adjustments", new AdjustStockRequest(secondProduct.Id, warehouse.Id, 0, "Rattachement achat", 0))).EnsureSuccessStatusCode();

        var response = await client.PostAsJsonAsync("/api/purchases/orders", new CreatePurchaseOrderRequest(
            supplier.Id,
            DateOnly.FromDateTime(DateTime.UtcNow.AddDays(12)),
            [
                new CreatePurchaseOrderLineRequest(firstProduct.Id, $"{firstProduct.Reference} - achat", 2, 10, 20),
                new CreatePurchaseOrderLineRequest(secondProduct.Id, $"{secondProduct.Reference} - achat", 3, 5, 5)
            ],
            "Commande test avec frais",
            [new CreatePurchaseOrderChargeRequest("Livraison", 12, 20), new CreatePurchaseOrderChargeRequest("Douane", 8, 0)],
            warehouse.Id));

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var order = await response.Content.ReadFromJsonAsync<PurchaseOrderDto>();

        Assert.Equal("Commande test avec frais", order!.Comment);
        Assert.Equal(2, order.Lines.Count);
        Assert.Equal(2, order.Charges.Count);
        Assert.Equal(35m, order.LinesNetTotal);
        Assert.Equal(4.75m, order.LinesVatTotal);
        Assert.Equal(20m, order.ChargesNetTotal);
        Assert.Equal(2.4m, order.ChargesVatTotal);
        Assert.Equal(62.15m, order.Total);
    }

    [Fact]
    public async Task PurchaseOrder_RejectsProductFromAnotherSupplier()
    {
        using var client = await CreateAuthenticatedClientAsync();
        var supplier = (await client.GetFromJsonAsync<IReadOnlyList<ProductSupplierDto>>("/api/products/suppliers"))!.First();
        var otherSupplier = await CreateSupplierAsync(client);
        var product = await CreateProductAsync(client, supplier.Id);
        var warehouse = (await client.GetFromJsonAsync<IReadOnlyList<WarehouseDto>>("/api/stock/warehouses"))!.First();
        (await client.PostAsJsonAsync("/api/stock/adjustments", new AdjustStockRequest(product.Id, warehouse.Id, 0, "Rattachement achat", 0))).EnsureSuccessStatusCode();

        var response = await client.PostAsJsonAsync("/api/purchases/orders", new CreatePurchaseOrderRequest(
            otherSupplier.Id,
            DateOnly.FromDateTime(DateTime.UtcNow.AddDays(12)),
            [new CreatePurchaseOrderLineRequest(product.Id, $"{product.Reference} - achat", 2, 10, 20)],
            WarehouseId: warehouse.Id));

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task PurchaseOrder_CanBeUpdatedBeforeStockReceipt()
    {
        using var client = await CreateAuthenticatedClientAsync();
        var supplier = (await client.GetFromJsonAsync<IReadOnlyList<ProductSupplierDto>>("/api/products/suppliers"))!.First();
        var firstProduct = await CreateProductAsync(client, supplier.Id);
        var secondProduct = await CreateProductAsync(client, supplier.Id);
        var warehouse = (await client.GetFromJsonAsync<IReadOnlyList<WarehouseDto>>("/api/stock/warehouses"))!.First();
        (await client.PostAsJsonAsync("/api/stock/adjustments", new AdjustStockRequest(firstProduct.Id, warehouse.Id, 0, "Rattachement achat", 0))).EnsureSuccessStatusCode();
        (await client.PostAsJsonAsync("/api/stock/adjustments", new AdjustStockRequest(secondProduct.Id, warehouse.Id, 0, "Rattachement achat", 0))).EnsureSuccessStatusCode();

        var createResponse = await client.PostAsJsonAsync("/api/purchases/orders", new CreatePurchaseOrderRequest(
            supplier.Id,
            null,
            [new CreatePurchaseOrderLineRequest(firstProduct.Id, $"{firstProduct.Reference} - achat initial", 1, 10, 20)],
            WarehouseId: warehouse.Id));
        Assert.Equal(HttpStatusCode.Created, createResponse.StatusCode);
        var order = await createResponse.Content.ReadFromJsonAsync<PurchaseOrderDto>();
        var expectedAt = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(8));

        var updateResponse = await client.PutAsJsonAsync($"/api/purchases/orders/{order!.Id}", new UpdatePurchaseOrderRequest(
            supplier.Id,
            expectedAt,
            [new CreatePurchaseOrderLineRequest(secondProduct.Id, $"{secondProduct.Reference} - achat modifie", 5, 4, 10)],
            "Commande modifiee",
            [new CreatePurchaseOrderChargeRequest("Livraison", 6, 20)],
            warehouse.Id));

        Assert.Equal(HttpStatusCode.OK, updateResponse.StatusCode);
        var updated = await updateResponse.Content.ReadFromJsonAsync<PurchaseOrderDto>();

        Assert.Equal("Commande modifiee", updated!.Comment);
        Assert.Equal(warehouse.Id, updated.WarehouseId);
        Assert.Equal(expectedAt, updated.ExpectedAt);
        var line = Assert.Single(updated.Lines);
        Assert.Equal(secondProduct.Id, line.ProductId);
        Assert.Equal(5, line.Quantity);
        Assert.Equal(20m, updated.LinesNetTotal);
        Assert.Equal(2m, updated.LinesVatTotal);
        var charge = Assert.Single(updated.Charges);
        Assert.Equal("Livraison", charge.Label);
        Assert.Equal(29.2m, updated.Total);
    }

    [Fact]
    public async Task PurchaseOrder_CanRollbackStatusAndReceiveLinesToStock()
    {
        using var client = await CreateAuthenticatedClientAsync();
        var supplier = (await client.GetFromJsonAsync<IReadOnlyList<ProductSupplierDto>>("/api/products/suppliers"))!.First();
        var product = await CreateProductAsync(client, supplier.Id);
        var warehouse = (await client.GetFromJsonAsync<IReadOnlyList<WarehouseDto>>("/api/stock/warehouses"))!.First();
        (await client.PostAsJsonAsync("/api/stock/adjustments", new AdjustStockRequest(product.Id, warehouse.Id, 0, "Rattachement achat", 0))).EnsureSuccessStatusCode();

        var createResponse = await client.PostAsJsonAsync("/api/purchases/orders", new CreatePurchaseOrderRequest(
            supplier.Id,
            DateOnly.FromDateTime(DateTime.UtcNow.AddDays(5)),
            [new CreatePurchaseOrderLineRequest(product.Id, $"{product.Reference} - stock", 4, product.PurchasePrice, product.VatRate)],
            WarehouseId: warehouse.Id));
        Assert.Equal(HttpStatusCode.Created, createResponse.StatusCode);
        var order = await createResponse.Content.ReadFromJsonAsync<PurchaseOrderDto>();
        Assert.Equal(warehouse.Id, order!.WarehouseId);

        var ordered = await client.PostAsJsonAsync($"/api/purchases/orders/{order.Id}/status", new UpdatePurchaseOrderStatusRequest("Ordered"));
        Assert.Equal(HttpStatusCode.OK, ordered.StatusCode);

        var rollback = await client.PostAsJsonAsync($"/api/purchases/orders/{order.Id}/status", new UpdatePurchaseOrderStatusRequest("Draft"));
        Assert.Equal(HttpStatusCode.OK, rollback.StatusCode);
        var rolledBack = await rollback.Content.ReadFromJsonAsync<PurchaseOrderDto>();
        Assert.Equal("Draft", rolledBack!.Status);

        (await client.PostAsJsonAsync($"/api/purchases/orders/{order.Id}/status", new UpdatePurchaseOrderStatusRequest("Ordered"))).EnsureSuccessStatusCode();
        (await client.PostAsJsonAsync($"/api/purchases/orders/{order.Id}/status", new UpdatePurchaseOrderStatusRequest("Received"))).EnsureSuccessStatusCode();

        var receiveResponse = await client.PostAsJsonAsync($"/api/purchases/orders/{order.Id}/receive-to-stock", new ReceivePurchaseOrderToStockRequest());
        Assert.Equal(HttpStatusCode.OK, receiveResponse.StatusCode);
        var receivedOrder = await receiveResponse.Content.ReadFromJsonAsync<PurchaseOrderDto>();
        Assert.Equal(warehouse.Id, receivedOrder!.WarehouseId);
        var receivedLine = Assert.Single(receivedOrder!.Lines);
        Assert.Equal(4, receivedLine.ReceivedQuantity);

        var stockItems = await client.GetFromJsonAsync<IReadOnlyList<StockItemDto>>("/api/stock/items");
        var stockItem = Assert.Single(stockItems!, x => x.ProductId == product.Id && x.WarehouseId == warehouse.Id);
        Assert.Equal(4, stockItem.QuantityOnHand);

        var movements = await client.GetFromJsonAsync<IReadOnlyList<StockMovementDto>>("/api/stock/movements");
        var movement = Assert.Single(movements!, x => x.ReferenceModule == "PurchaseOrder" && x.ReferenceId == order.Id);
        Assert.Equal(4, movement.Quantity);

        var blockedUpdateResponse = await client.PutAsJsonAsync($"/api/purchases/orders/{order.Id}", new UpdatePurchaseOrderRequest(
            supplier.Id,
            DateOnly.FromDateTime(DateTime.UtcNow.AddDays(10)),
            [new CreatePurchaseOrderLineRequest(product.Id, $"{product.Reference} - stock modifie", 1, product.PurchasePrice, product.VatRate)],
            WarehouseId: warehouse.Id));
        Assert.Equal(HttpStatusCode.BadRequest, blockedUpdateResponse.StatusCode);
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
            Code: $"C-{Guid.NewGuid():N}"[..10],
            CompanyName: "Client integration",
            LegalName: null,
            TradeName: null,
            SirenNumber: null,
            SiretNumber: null,
            VatNumber: null,
            Email: null,
            Phone: null,
            MobilePhone: null,
            Website: null,
            Industry: null,
            CustomerType: null,
            Source: null,
            AccountingCode: null,
            PaymentTerms: null,
            DefaultDiscountRate: null,
            Notes: null,
            Contacts: [],
            Addresses: []));
        response.EnsureSuccessStatusCode();
        return (await response.Content.ReadFromJsonAsync<CustomerDto>())!;
    }

    private static async Task<ProductDto> CreateProductAsync(HttpClient client, Guid? mainSupplierId = null)
    {
        var response = await client.PostAsJsonAsync("/api/products", new CreateProductRequest(
            $"P-{Guid.NewGuid():N}"[..10],
            "Produit integration",
            null,
            10,
            20,
            20,
            null,
            mainSupplierId));
        response.EnsureSuccessStatusCode();
        return (await response.Content.ReadFromJsonAsync<ProductDto>())!;
    }

    private static async Task<ProductSupplierDto> CreateSupplierAsync(HttpClient client)
    {
        var response = await client.PostAsJsonAsync("/api/products/suppliers", new CreateProductSupplierRequest(
            $"Fournisseur-{Guid.NewGuid():N}"[..24],
            "supplier@example.com",
            null));
        response.EnsureSuccessStatusCode();
        return (await response.Content.ReadFromJsonAsync<ProductSupplierDto>())!;
    }

    private async Task MarkProductAsPrestashopAsync(Guid productId, Guid warehouseId)
    {
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ErpDbContext>();
        foreach (var connection in db.PrestashopConnections)
        {
            connection.IsActive = false;
        }

        db.PrestashopConnections.Add(new PrestashopConnection
        {
            ShopUrl = "https://shop.example.com",
            IsActive = false,
            WarehouseId = warehouseId
        });
        db.ExternalReferences.Add(new ExternalReference
        {
            Provider = "PrestaShop",
            Module = "products",
            ExternalId = $"products:{Guid.NewGuid():N}",
            EntityId = productId
        });
        await db.SaveChangesAsync();
    }
}
