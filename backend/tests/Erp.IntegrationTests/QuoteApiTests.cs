using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using Erp.Application.Auth;
using Erp.Application.Customers;
using Erp.Application.Emails;
using Erp.Application.Products;
using Erp.Application.Quotes;
using Erp.Application.Sales;
using Erp.Application.Stock;

namespace Erp.IntegrationTests;

public sealed class QuoteApiTests(ApiFactory factory) : IClassFixture<ApiFactory>
{
    [Fact]
    public async Task QuoteWorkflow_CreatesUpdatesEmailsSignsAndConvertsToOrder()
    {
        using var client = await CreateAuthenticatedClientAsync();
        var customer = await CreateCustomerAsync(client);
        var product = await CreateProductAsync(client);
        var warehouse = (await client.GetFromJsonAsync<IReadOnlyList<WarehouseDto>>("/api/stock/warehouses"))!.First();
        var mailAccount = await CreateMailAccountAsync(client);

        var createResponse = await client.PostAsJsonAsync("/api/quotes", new CreateQuoteRequest(
            customer.Id,
            DateOnly.FromDateTime(DateTime.UtcNow.AddDays(30)),
            [new UpsertQuoteLineRequest(product.Id, string.Empty, 2, 0, 10, 20)]));

        Assert.Equal(HttpStatusCode.Created, createResponse.StatusCode);
        var created = await createResponse.Content.ReadFromJsonAsync<QuoteDto>();
        Assert.Equal("Draft", created!.Status);
        Assert.Equal(43.2m, created.Total);
        Assert.Single(created.Documents);
        Assert.Single(created.StatusHistory);

        var updateResponse = await client.PutAsJsonAsync($"/api/quotes/{created.Id}", new UpdateQuoteRequest(
            customer.Id,
            DateOnly.FromDateTime(DateTime.UtcNow.AddDays(45)),
            [
                new UpsertQuoteLineRequest(product.Id, string.Empty, 3, 20, 0, 20),
                new UpsertQuoteLineRequest(null, "Ligne libre", 1, 15, 0, 20)
            ]));

        Assert.Equal(HttpStatusCode.OK, updateResponse.StatusCode);
        var updated = await updateResponse.Content.ReadFromJsonAsync<QuoteDto>();
        Assert.Equal(2, updated!.Lines.Count);
        Assert.Equal(90m, updated.Total);
        Assert.Equal(2, updated.Documents.Count);

        var emailResponse = await client.PostAsJsonAsync($"/api/quotes/{created.Id}/email", new SendQuoteEmailRequest(
            mailAccount.Id,
            "client@example.com"));

        Assert.Equal(HttpStatusCode.OK, emailResponse.StatusCode);
        var emailed = await emailResponse.Content.ReadFromJsonAsync<QuoteDto>();
        Assert.Equal("Sent", emailed!.Status);

        var signedResponse = await client.PostAsJsonAsync($"/api/quotes/{created.Id}/status", new UpdateQuoteStatusRequest("Signed", "Bon pour accord"));
        Assert.Equal(HttpStatusCode.OK, signedResponse.StatusCode);
        var signed = await signedResponse.Content.ReadFromJsonAsync<QuoteDto>();
        Assert.Equal("Signed", signed!.Status);

        var orderResponse = await client.PostAsJsonAsync("/api/orders/from-quote", new CreateSalesOrderFromQuoteRequest(created.Id, warehouse.Id));
        Assert.Equal(HttpStatusCode.Created, orderResponse.StatusCode);
        var order = await orderResponse.Content.ReadFromJsonAsync<SalesOrderDto>();
        Assert.Equal(customer.Id, order!.CustomerId);

        var finalQuote = await client.GetFromJsonAsync<QuoteDto>($"/api/quotes/{created.Id}");
        Assert.Equal("ConvertedToOrder", finalQuote!.Status);
    }

    [Fact]
    public async Task Quote_CannotConvertBeforeSignature()
    {
        using var client = await CreateAuthenticatedClientAsync();
        var customer = await CreateCustomerAsync(client);
        var product = await CreateProductAsync(client);
        var warehouse = (await client.GetFromJsonAsync<IReadOnlyList<WarehouseDto>>("/api/stock/warehouses"))!.First();

        var createResponse = await client.PostAsJsonAsync("/api/quotes", new CreateQuoteRequest(
            customer.Id,
            DateOnly.FromDateTime(DateTime.UtcNow.AddDays(30)),
            [new UpsertQuoteLineRequest(product.Id, string.Empty, 1, product.SalePrice, 0, product.VatRate)]));
        createResponse.EnsureSuccessStatusCode();
        var quote = await createResponse.Content.ReadFromJsonAsync<QuoteDto>();

        var orderResponse = await client.PostAsJsonAsync("/api/orders/from-quote", new CreateSalesOrderFromQuoteRequest(quote!.Id, warehouse.Id));

        Assert.Equal(HttpStatusCode.BadRequest, orderResponse.StatusCode);
    }

    [Fact]
    public async Task Quote_AdminCanDeleteDraftQuote()
    {
        using var client = await CreateAuthenticatedClientAsync();
        var customer = await CreateCustomerAsync(client);
        var product = await CreateProductAsync(client);

        var createResponse = await client.PostAsJsonAsync("/api/quotes", new CreateQuoteRequest(
            customer.Id,
            DateOnly.FromDateTime(DateTime.UtcNow.AddDays(30)),
            [new UpsertQuoteLineRequest(product.Id, string.Empty, 1, product.SalePrice, 0, product.VatRate)]));
        createResponse.EnsureSuccessStatusCode();
        var quote = await createResponse.Content.ReadFromJsonAsync<QuoteDto>();

        var deleteResponse = await client.DeleteAsync($"/api/quotes/{quote!.Id}");

        Assert.Equal(HttpStatusCode.NoContent, deleteResponse.StatusCode);
        var getResponse = await client.GetAsync($"/api/quotes/{quote.Id}");
        Assert.Equal(HttpStatusCode.NotFound, getResponse.StatusCode);
    }

    [Fact]
    public async Task Quote_AdminCanDeleteConvertedQuoteAfterAssociatedOrderWasDeleted()
    {
        using var client = await CreateAuthenticatedClientAsync();
        var customer = await CreateCustomerAsync(client);
        var product = await CreateProductAsync(client);
        var warehouse = (await client.GetFromJsonAsync<IReadOnlyList<WarehouseDto>>("/api/stock/warehouses"))!.First();

        var createResponse = await client.PostAsJsonAsync("/api/quotes", new CreateQuoteRequest(
            customer.Id,
            DateOnly.FromDateTime(DateTime.UtcNow.AddDays(30)),
            [new UpsertQuoteLineRequest(product.Id, string.Empty, 1, product.SalePrice, 0, product.VatRate)]));
        createResponse.EnsureSuccessStatusCode();
        var quote = await createResponse.Content.ReadFromJsonAsync<QuoteDto>();

        var sentResponse = await client.PostAsJsonAsync($"/api/quotes/{quote!.Id}/status", new UpdateQuoteStatusRequest("Sent", null));
        sentResponse.EnsureSuccessStatusCode();

        var signedResponse = await client.PostAsJsonAsync($"/api/quotes/{quote.Id}/status", new UpdateQuoteStatusRequest("Signed", null));
        signedResponse.EnsureSuccessStatusCode();

        var orderResponse = await client.PostAsJsonAsync("/api/orders/from-quote", new CreateSalesOrderFromQuoteRequest(quote.Id, warehouse.Id));
        orderResponse.EnsureSuccessStatusCode();
        var order = await orderResponse.Content.ReadFromJsonAsync<SalesOrderDto>();

        var blockedDeleteResponse = await client.DeleteAsync($"/api/quotes/{quote.Id}");
        Assert.Equal(HttpStatusCode.BadRequest, blockedDeleteResponse.StatusCode);

        var deleteOrderResponse = await client.DeleteAsync($"/api/orders/{order!.Id}");
        deleteOrderResponse.EnsureSuccessStatusCode();

        var deleteQuoteResponse = await client.DeleteAsync($"/api/quotes/{quote.Id}");
        Assert.Equal(HttpStatusCode.NoContent, deleteQuoteResponse.StatusCode);
    }

    [Fact]
    public async Task Quote_IncludesAvailableCustomerDetails()
    {
        using var client = await CreateAuthenticatedClientAsync();
        var customerResponse = await client.PostAsJsonAsync("/api/customers", new CreateCustomerRequest(
            Code: $"C-{Guid.NewGuid():N}"[..10],
            CompanyName: "Client enrichi",
            LegalName: "Client enrichi SAS",
            TradeName: "Client enrichi commerce",
            SirenNumber: "123456789",
            SiretNumber: "12345678900012",
            VatNumber: "FR12123456789",
            Email: "contact.client@example.com",
            Phone: "0102030405",
            MobilePhone: "0607080910",
            Website: "https://client.example.com",
            Industry: null,
            CustomerType: null,
            Source: null,
            AccountingCode: null,
            PaymentTerms: null,
            DefaultDiscountRate: null,
            Notes: null,
            Contacts: [new UpsertCustomerContactRequest("Alice", "Martin", "alice@example.com", "0100000000", "Achats", true)],
            Addresses: [new UpsertCustomerAddressRequest("Facturation", "12 rue du Port", "Batiment A", "14000", "Caen", "France", true, false)]));
        customerResponse.EnsureSuccessStatusCode();
        var customer = (await customerResponse.Content.ReadFromJsonAsync<CustomerDto>())!;
        var product = await CreateProductAsync(client);

        var createResponse = await client.PostAsJsonAsync("/api/quotes", new CreateQuoteRequest(
            customer.Id,
            DateOnly.FromDateTime(DateTime.UtcNow.AddDays(30)),
            [new UpsertQuoteLineRequest(product.Id, string.Empty, 1, product.SalePrice, 0, product.VatRate)]));

        Assert.Equal(HttpStatusCode.Created, createResponse.StatusCode);
        var quote = await createResponse.Content.ReadFromJsonAsync<QuoteDto>();
        Assert.NotNull(quote!.Customer);
        Assert.Equal("Client enrichi SAS", quote.Customer!.LegalName);
        Assert.Equal("123456789", quote.Customer.SirenNumber);
        Assert.Equal("FR12123456789", quote.Customer.VatNumber);
        Assert.Equal("Alice Martin", quote.Customer.ContactName);
        Assert.Equal("12 rue du Port", quote.Customer.AddressLine1);
        Assert.Equal("Caen", quote.Customer.City);
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
            CompanyName: "Client devis",
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

    private static async Task<ProductDto> CreateProductAsync(HttpClient client)
    {
        var response = await client.PostAsJsonAsync("/api/products", new CreateProductRequest(
            $"P-{Guid.NewGuid():N}"[..10],
            "Produit devis",
            null,
            10,
            20,
            20,
            null,
            null));
        response.EnsureSuccessStatusCode();
        return (await response.Content.ReadFromJsonAsync<ProductDto>())!;
    }

    private static async Task<MailAccountDto> CreateMailAccountAsync(HttpClient client)
    {
        var response = await client.PostAsJsonAsync("/api/emails/accounts", new CreateMailAccountRequest(
            "commercial@example.com",
            "smtp.example.com",
            "imap.example.com"));
        response.EnsureSuccessStatusCode();
        return (await response.Content.ReadFromJsonAsync<MailAccountDto>())!;
    }
}
