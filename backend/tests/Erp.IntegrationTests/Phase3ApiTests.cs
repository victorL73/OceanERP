using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text;
using Erp.Application.Auth;
using Erp.Application.Calendar;
using Erp.Application.Common;
using Erp.Application.Customers;
using Erp.Application.Documents;
using Erp.Application.Products;
using Erp.Application.ServiceTickets;
using Erp.Application.Signatures;

namespace Erp.IntegrationTests;

public sealed class Phase3ApiTests(ApiFactory factory) : IClassFixture<ApiFactory>
{
    [Fact]
    public async Task ServiceTicketWorkflow_CreatesMessageAndStatusHistory()
    {
        using var client = await CreateAuthenticatedClientAsync();
        var customer = await CreateCustomerAsync(client);
        var product = await CreateProductAsync(client);

        var createResponse = await client.PostAsJsonAsync("/api/service-tickets", new CreateServiceTicketRequest(
            customer.Id,
            "Panne moteur",
            "Le client signale un defaut a controler.",
            product.Id,
            Priority: "High"));
        Assert.Equal(HttpStatusCode.Created, createResponse.StatusCode);
        var ticket = await createResponse.Content.ReadFromJsonAsync<ServiceTicketDto>();
        Assert.Equal("Open", ticket!.Status);
        Assert.Equal("High", ticket.Priority);
        Assert.Single(ticket.StatusHistory);

        var messageResponse = await client.PostAsJsonAsync($"/api/service-tickets/{ticket.Id}/messages", new CreateServiceTicketMessageRequest("Premier retour SAV"));
        Assert.Equal(HttpStatusCode.OK, messageResponse.StatusCode);
        var message = await messageResponse.Content.ReadFromJsonAsync<ServiceTicketMessageDto>();
        Assert.Equal("Premier retour SAV", message!.Body);
        Assert.Equal("OceanERP Admin", message.AuthorName);

        var statusResponse = await client.PostAsJsonAsync($"/api/service-tickets/{ticket.Id}/status", new UpdateServiceTicketStatusRequest("InProgress", "Pris en charge"));
        Assert.Equal(HttpStatusCode.OK, statusResponse.StatusCode);
        var updated = await statusResponse.Content.ReadFromJsonAsync<ServiceTicketDto>();
        Assert.Equal("InProgress", updated!.Status);
        Assert.Contains(updated.StatusHistory, item => item.Status == "InProgress" && item.Comment == "Pris en charge");
    }

    [Fact]
    public async Task Calendar_CanCreateUpdateAndDeleteEvent()
    {
        using var client = await CreateAuthenticatedClientAsync();
        var now = DateTimeOffset.UtcNow.AddHours(2);
        var createResponse = await client.PostAsJsonAsync("/api/calendar/events", new CreateCalendarEventRequest(
            "Rendez-vous client",
            now,
            now.AddHours(1),
            "Controle avant livraison",
            "Atelier",
            false,
            [new CreateCalendarReminderRequest(now.AddMinutes(-30))],
            null));
        Assert.Equal(HttpStatusCode.Created, createResponse.StatusCode);
        var created = await createResponse.Content.ReadFromJsonAsync<CalendarEventDto>();
        Assert.Single(created!.Reminders);

        var updateResponse = await client.PutAsJsonAsync($"/api/calendar/events/{created.Id}", new UpdateCalendarEventRequest(
            "Rendez-vous client modifie",
            now.AddHours(1),
            now.AddHours(2),
            "Creneau confirme",
            "Showroom",
            true,
            [],
            null));
        Assert.Equal(HttpStatusCode.OK, updateResponse.StatusCode);
        var updated = await updateResponse.Content.ReadFromJsonAsync<CalendarEventDto>();
        Assert.Equal("Rendez-vous client modifie", updated!.Title);
        Assert.True(updated.IsPrivate);
        Assert.Empty(updated.Reminders);

        var deleteResponse = await client.DeleteAsync($"/api/calendar/events/{created.Id}");
        Assert.Equal(HttpStatusCode.NoContent, deleteResponse.StatusCode);
    }

    [Fact]
    public async Task Signature_PublicLinkCanBeAcceptedAndProducesEvidence()
    {
        using var client = await CreateAuthenticatedClientAsync();
        var file = await UploadDriveFileAsync(client);

        var createResponse = await client.PostAsJsonAsync("/api/signatures", new CreateSignatureRequestRequest(
            file.Id,
            "Bon pour accord",
            DateTimeOffset.UtcNow.AddDays(7),
            [new CreateSignatureRecipientRequest("client@example.com", "Client Test")]));
        Assert.Equal(HttpStatusCode.Created, createResponse.StatusCode);
        var request = await createResponse.Content.ReadFromJsonAsync<SignatureRequestDto>();
        var signingUrl = Assert.Single(request!.Recipients).SigningUrl;
        Assert.False(string.IsNullOrWhiteSpace(signingUrl));
        var token = new Uri(signingUrl!).Segments.Last();

        using var publicClient = factory.CreateClient(new() { BaseAddress = new Uri("https://localhost") });
        var publicSignature = await publicClient.GetFromJsonAsync<PublicSignatureDto>($"/api/signatures/public/{token}");
        Assert.Equal("Bon pour accord", publicSignature!.Title);
        Assert.Equal("Pending", publicSignature.Status);

        var refusedResponse = await publicClient.PostAsJsonAsync($"/api/signatures/public/{token}/accept", new AcceptSignatureRequest(false));
        Assert.Equal(HttpStatusCode.BadRequest, refusedResponse.StatusCode);

        var signedResponse = await publicClient.PostAsJsonAsync($"/api/signatures/public/{token}/accept", new AcceptSignatureRequest(true, "Click"));
        Assert.Equal(HttpStatusCode.OK, signedResponse.StatusCode);
        var signed = await signedResponse.Content.ReadFromJsonAsync<SignatureRequestDto>();
        Assert.Equal("Completed", signed!.Status);
        Assert.Single(signed.Evidence);
        Assert.Single(signed.SignedDocuments);
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
            CompanyName: "Client phase 3",
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
            "Produit phase 3",
            null,
            12,
            24,
            20,
            null,
            null));
        response.EnsureSuccessStatusCode();
        return (await response.Content.ReadFromJsonAsync<ProductDto>())!;
    }

    private static async Task<DriveItemDto> UploadDriveFileAsync(HttpClient client)
    {
        using var form = new MultipartFormDataContent();
        var fileContent = new ByteArrayContent(Encoding.UTF8.GetBytes("Document a signer"));
        fileContent.Headers.ContentType = MediaTypeHeaderValue.Parse("text/plain");
        form.Add(fileContent, "file", "signature.txt");

        var uploadResponse = await client.PostAsync("/api/drive/files", form);
        uploadResponse.EnsureSuccessStatusCode();
        var upload = await uploadResponse.Content.ReadFromJsonAsync<DriveUploadResult>();
        return upload!.Item;
    }
}
