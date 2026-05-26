using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text;
using System.Text.RegularExpressions;
using Erp.Application.Auth;
using Erp.Application.Calendar;
using Erp.Application.Common;
using Erp.Application.Customers;
using Erp.Application.Documents;
using Erp.Application.Emails;
using Erp.Application.Products;
using Erp.Application.ServiceTickets;
using Erp.Application.Signatures;
using Erp.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

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
    public async Task ServiceTicketAssignment_CanConfigureInitialRespondersAndAssignUser()
    {
        using var client = await CreateAuthenticatedClientAsync();
        var userEmail = $"sav-{Guid.NewGuid():N}@example.com";
        var userResponse = await client.PostAsJsonAsync("/api/users", new RegisterUserRequest(userEmail, "Responsable SAV", "ChangeMe!12345", ["Administrator"]));
        Assert.Equal(HttpStatusCode.Created, userResponse.StatusCode);
        var assignee = await userResponse.Content.ReadFromJsonAsync<UserDto>();

        var settingsResponse = await client.PutAsJsonAsync("/api/service-tickets/settings/assignment", new UpdateServiceTicketAssignmentSettingsRequest([assignee!.Id]));
        Assert.Equal(HttpStatusCode.OK, settingsResponse.StatusCode);
        var settings = await settingsResponse.Content.ReadFromJsonAsync<ServiceTicketAssignmentSettingsDto>();
        Assert.Contains(assignee.Id, settings!.InitialResponderUserIds);

        var customer = await CreateCustomerAsync(client);
        var createResponse = await client.PostAsJsonAsync("/api/service-tickets", new CreateServiceTicketRequest(
            customer.Id,
            "Demande importee",
            "Message initial",
            AssignedUserId: assignee.Id));
        Assert.Equal(HttpStatusCode.Created, createResponse.StatusCode);
        var ticket = await createResponse.Content.ReadFromJsonAsync<ServiceTicketDto>();
        Assert.Equal(assignee.Id, ticket!.AssignedUserId);
        Assert.Equal("Responsable SAV", ticket.AssignedUserName);

        var unassignResponse = await client.PostAsJsonAsync($"/api/service-tickets/{ticket.Id}/assignment", new AssignServiceTicketRequest(null));
        Assert.Equal(HttpStatusCode.OK, unassignResponse.StatusCode);
        var unassigned = await unassignResponse.Content.ReadFromJsonAsync<ServiceTicketDto>();
        Assert.Null(unassigned!.AssignedUserId);
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
        await CreateMailAccountAsync(client);
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
        Assert.True(publicSignature.RequiresOtp);

        var refusedResponse = await publicClient.PostAsJsonAsync($"/api/signatures/public/{token}/accept", new AcceptSignatureRequest(false));
        Assert.Equal(HttpStatusCode.BadRequest, refusedResponse.StatusCode);

        var invalidOtpResponse = await publicClient.PostAsJsonAsync($"/api/signatures/public/{token}/accept", new AcceptSignatureRequest(true, "Click", null, "000000"));
        Assert.Equal(HttpStatusCode.BadRequest, invalidOtpResponse.StatusCode);

        var otpCode = await ReadOtpCodeAsync("client@example.com");
        var signedResponse = await publicClient.PostAsJsonAsync($"/api/signatures/public/{token}/accept", new AcceptSignatureRequest(true, "Click", null, otpCode));
        Assert.Equal(HttpStatusCode.OK, signedResponse.StatusCode);
        var signed = await signedResponse.Content.ReadFromJsonAsync<SignatureRequestDto>();
        Assert.Equal("Completed", signed!.Status);
        Assert.Single(signed.Evidence);
        Assert.Single(signed.SignedDocuments);
    }

    [Fact]
    public async Task OnlyOfficeConfig_UsesSignedDocumentUrl()
    {
        using var client = await CreateAuthenticatedClientAsync();
        var file = await UploadDriveFileAsync(
            client,
            "onlyoffice.docx",
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document");

        var config = await client.GetFromJsonAsync<OnlyOfficeConfigDto>($"/api/onlyoffice/files/{file.Id}/config");
        Assert.NotNull(config);
        Assert.Contains("/api/onlyoffice/files/", config!.Document.Url);
        Assert.Contains("token=", config.Document.Url);
        Assert.Contains("token=", config.EditorConfig.CallbackUrl);

        using var publicClient = factory.CreateClient(new() { BaseAddress = new Uri("https://localhost") });
        var documentUri = new Uri(config.Document.Url);
        var downloadResponse = await publicClient.GetAsync(documentUri.PathAndQuery);
        Assert.Equal(HttpStatusCode.OK, downloadResponse.StatusCode);
        Assert.Equal("Document a signer", await downloadResponse.Content.ReadAsStringAsync());

        var unauthorizedResponse = await publicClient.GetAsync($"/api/onlyoffice/files/{file.Id}/download");
        Assert.Equal(HttpStatusCode.Unauthorized, unauthorizedResponse.StatusCode);
    }

    [Fact]
    public async Task OnlyOfficeConfig_UsesStrictCoEditingForSpreadsheets()
    {
        using var client = await CreateAuthenticatedClientAsync();
        var file = await UploadDriveFileAsync(
            client,
            "catalogue.xlsx",
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");

        var config = await client.GetFromJsonAsync<OnlyOfficeConfigDto>($"/api/onlyoffice/files/{file.Id}/config");

        Assert.NotNull(config);
        Assert.Equal("cell", config!.DocumentType);
        Assert.Equal("strict", config.EditorConfig.CoEditing?.Mode);
        Assert.False(config.EditorConfig.Customization?.Autosave ?? true);
        Assert.False(config.EditorConfig.Customization?.Forcesave ?? true);
        Assert.False(config.EditorConfig.Customization?.Comments ?? true);
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

    private static async Task<DriveItemDto> UploadDriveFileAsync(HttpClient client, string fileName = "signature.txt", string mimeType = "text/plain")
    {
        using var form = new MultipartFormDataContent();
        var fileContent = new ByteArrayContent(Encoding.UTF8.GetBytes("Document a signer"));
        fileContent.Headers.ContentType = MediaTypeHeaderValue.Parse(mimeType);
        form.Add(fileContent, "file", fileName);

        var uploadResponse = await client.PostAsync("/api/drive/files", form);
        uploadResponse.EnsureSuccessStatusCode();
        var upload = await uploadResponse.Content.ReadFromJsonAsync<DriveUploadResult>();
        return upload!.Item;
    }

    private static async Task<MailAccountDto> CreateMailAccountAsync(HttpClient client)
    {
        var response = await client.PostAsJsonAsync("/api/emails/accounts", new CreateMailAccountRequest(
            "signature@example.com",
            "smtp.example.com",
            "imap.example.com"));
        response.EnsureSuccessStatusCode();
        return (await response.Content.ReadFromJsonAsync<MailAccountDto>())!;
    }

    private async Task<string> ReadOtpCodeAsync(string recipient)
    {
        await using var scope = factory.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<ErpDbContext>();
        var body = await db.EmailMessages
            .Where(x => x.To.Contains(recipient) && x.Subject.Contains("Code OTP"))
            .OrderByDescending(x => x.CreatedAt)
            .Select(x => x.Body)
            .FirstAsync();
        var match = Regex.Match(body, @"\b\d{6}\b");
        Assert.True(match.Success, $"Aucun OTP trouve dans le mail: {body}");
        return match.Value;
    }
}
