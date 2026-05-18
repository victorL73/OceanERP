using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text;
using Erp.Application.Auth;
using Erp.Application.Customers;
using Erp.Application.Documents;

namespace Erp.IntegrationTests;

public sealed class DriveApiTests(ApiFactory factory) : IClassFixture<ApiFactory>
{
    [Fact]
    public async Task Drive_CanManageSearchTrashRestoreAndLinkDocuments()
    {
        using var client = await CreateAuthenticatedClientAsync();
        var customer = await CreateCustomerAsync(client);

        var folderResponse = await client.PostAsJsonAsync("/api/drive/folders", new CreateFolderRequest(null, "Clients"));
        Assert.Equal(HttpStatusCode.OK, folderResponse.StatusCode);
        var folder = (await folderResponse.Content.ReadFromJsonAsync<DriveFolderDto>())!;

        var renamedFolderResponse = await client.PutAsJsonAsync($"/api/drive/folders/{folder.Id}/rename", new RenameDriveItemRequest("Clients actifs"));
        Assert.Equal(HttpStatusCode.OK, renamedFolderResponse.StatusCode);
        var renamedFolder = (await renamedFolderResponse.Content.ReadFromJsonAsync<DriveFolderDto>())!;
        Assert.Equal("Clients actifs", renamedFolder.Name);

        using var form = new MultipartFormDataContent();
        form.Add(new StringContent(folder.Id.ToString()), "folderId");
        var fileContent = new ByteArrayContent(Encoding.UTF8.GetBytes("Contrat client phase 1"));
        fileContent.Headers.ContentType = MediaTypeHeaderValue.Parse("text/plain");
        form.Add(fileContent, "file", "contrat-client.txt");

        var uploadResponse = await client.PostAsync("/api/drive/files", form);
        Assert.Equal(HttpStatusCode.OK, uploadResponse.StatusCode);
        var upload = (await uploadResponse.Content.ReadFromJsonAsync<DriveUploadResult>())!;

        var renameResponse = await client.PutAsJsonAsync($"/api/drive/files/{upload.Item.Id}/rename", new RenameDriveItemRequest("contrat-renomme.txt"));
        Assert.Equal(HttpStatusCode.OK, renameResponse.StatusCode);

        var search = await client.GetFromJsonAsync<IReadOnlyList<DriveItemDto>>("/api/drive/files?search=renomme");
        Assert.Contains(search!, item => item.Id == upload.Item.Id);

        var linkResponse = await client.PostAsJsonAsync("/api/drive/links", new CreateDocumentLinkRequest(upload.Item.Id, "customers", customer.Id));
        Assert.Equal(HttpStatusCode.OK, linkResponse.StatusCode);
        var link = (await linkResponse.Content.ReadFromJsonAsync<DocumentLinkDto>())!;

        var links = await client.GetFromJsonAsync<IReadOnlyList<DocumentLinkDto>>($"/api/drive/links/customers/{customer.Id}");
        Assert.Single(links!);
        Assert.Equal(link.Id, links![0].Id);

        var trashResponse = await client.DeleteAsync($"/api/drive/files/{upload.Item.Id}");
        Assert.Equal(HttpStatusCode.NoContent, trashResponse.StatusCode);
        var trashed = await client.GetFromJsonAsync<IReadOnlyList<DriveItemDto>>("/api/drive/files?search=renomme&includeTrashed=true");
        Assert.Contains(trashed!, item => item.Id == upload.Item.Id && item.IsTrashed);

        var restoreResponse = await client.PostAsync($"/api/drive/files/{upload.Item.Id}/restore", null);
        Assert.Equal(HttpStatusCode.OK, restoreResponse.StatusCode);
    }

    [Fact]
    public async Task Users_AuditLogEndpointReturnsLoginEvents()
    {
        using var client = await CreateAuthenticatedClientAsync();

        var logs = await client.GetFromJsonAsync<IReadOnlyList<AuditLogDto>>("/api/users/audit-logs?take=20");

        Assert.Contains(logs!, log => log.Action == "auth.login.succeeded");
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
            CompanyName: "Client Drive",
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
}
