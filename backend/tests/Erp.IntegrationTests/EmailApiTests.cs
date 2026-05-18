using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using Erp.Application.Auth;
using Erp.Application.Common;
using Erp.Application.Emails;

namespace Erp.IntegrationTests;

public sealed class EmailApiTests(ApiFactory factory) : IClassFixture<ApiFactory>
{
    [Fact]
    public async Task MailAccounts_AreVisibleOnlyToAuthorizedUsers()
    {
        using var admin = await CreateAuthenticatedClientAsync();
        var roleName = $"MailUser{Guid.NewGuid():N}"[..20];
        var roleResponse = await admin.PostAsJsonAsync("/api/users/roles", new CreateRoleRequest(roleName, "Mail user", ["dashboard.read", "emails.read", "emails.write"]));
        roleResponse.EnsureSuccessStatusCode();

        var userEmail = $"mail-{Guid.NewGuid():N}@oceanerp.local";
        var password = "ChangeMe!12345";
        var userResponse = await admin.PostAsJsonAsync("/api/users", new RegisterUserRequest(userEmail, "Mail User", password, [roleName]));
        userResponse.EnsureSuccessStatusCode();
        var user = (await userResponse.Content.ReadFromJsonAsync<UserDto>())!;

        var sharedResponse = await admin.PostAsJsonAsync("/api/emails/accounts", new CreateMailAccountRequest(
            "shared@example.com",
            "smtp.example.com",
            "imap.example.com",
            AuthorizedUserIds: [user.Id]));
        sharedResponse.EnsureSuccessStatusCode();
        var shared = (await sharedResponse.Content.ReadFromJsonAsync<MailAccountDto>())!;

        var privateResponse = await admin.PostAsJsonAsync("/api/emails/accounts", new CreateMailAccountRequest(
            "private@example.com",
            "smtp.example.com",
            "imap.example.com"));
        privateResponse.EnsureSuccessStatusCode();
        var privateAccount = (await privateResponse.Content.ReadFromJsonAsync<MailAccountDto>())!;

        using var userClient = await CreateAuthenticatedClientAsync(userEmail, password);
        var accounts = (await userClient.GetFromJsonAsync<IReadOnlyList<MailAccountDto>>("/api/emails/accounts"))!;

        Assert.Contains(accounts, account => account.Id == shared.Id);
        Assert.DoesNotContain(accounts, account => account.Id == privateAccount.Id);

        var sendAllowed = await userClient.PostAsJsonAsync("/api/emails/send", new SendEmailRequest(shared.Id, "client@example.com", "Sujet", "Message"));
        Assert.Equal(HttpStatusCode.OK, sendAllowed.StatusCode);

        var messages = (await userClient.GetFromJsonAsync<PagedResult<EmailMessageDto>>("/api/emails/messages?pageSize=50"))!;
        Assert.Contains(messages.Items, message => message.Subject == "Sujet" && message.MailAccountId == shared.Id);

        var sendDenied = await userClient.PostAsJsonAsync("/api/emails/send", new SendEmailRequest(privateAccount.Id, "client@example.com", "Refus", "Message"));
        Assert.Equal(HttpStatusCode.BadRequest, sendDenied.StatusCode);
    }

    [Fact]
    public async Task EmailTemplates_CanBeManaged()
    {
        using var client = await CreateAuthenticatedClientAsync();
        var createResponse = await client.PostAsJsonAsync("/api/emails/templates", new CreateEmailTemplateRequest("Devis", "Votre devis", "Bonjour"));
        createResponse.EnsureSuccessStatusCode();
        var created = (await createResponse.Content.ReadFromJsonAsync<EmailTemplateDto>())!;

        var updateResponse = await client.PutAsJsonAsync($"/api/emails/templates/{created.Id}", new UpdateEmailTemplateRequest("Devis relance", "Relance devis", "Bonjour,\nRelance", false));
        updateResponse.EnsureSuccessStatusCode();
        var updated = (await updateResponse.Content.ReadFromJsonAsync<EmailTemplateDto>())!;

        Assert.Equal("Devis relance", updated.Name);
        Assert.False(updated.IsActive);
    }

    [Fact]
    public async Task EmailMessages_CanBeDeletedWithoutReappearingInJournal()
    {
        using var client = await CreateAuthenticatedClientAsync();
        var accountResponse = await client.PostAsJsonAsync("/api/emails/accounts", new CreateMailAccountRequest(
            "delete-me@example.com",
            "smtp.example.com",
            "imap.example.com"));
        accountResponse.EnsureSuccessStatusCode();
        var account = (await accountResponse.Content.ReadFromJsonAsync<MailAccountDto>())!;

        var sendResponse = await client.PostAsJsonAsync("/api/emails/send", new SendEmailRequest(account.Id, "client@example.com", "A supprimer", "Message"));
        sendResponse.EnsureSuccessStatusCode();
        var message = (await sendResponse.Content.ReadFromJsonAsync<EmailMessageDto>())!;

        var deleteResponse = await client.DeleteAsync($"/api/emails/messages/{message.Id}");
        Assert.Equal(HttpStatusCode.NoContent, deleteResponse.StatusCode);

        var detailResponse = await client.GetAsync($"/api/emails/messages/{message.Id}");
        Assert.Equal(HttpStatusCode.NotFound, detailResponse.StatusCode);

        var messages = (await client.GetFromJsonAsync<PagedResult<EmailMessageDto>>("/api/emails/messages?pageSize=50"))!;
        Assert.DoesNotContain(messages.Items, item => item.Id == message.Id);
    }

    [Fact]
    public async Task ReplyEmails_PlaceSignatureBeforeQuotedHistory()
    {
        using var client = await CreateAuthenticatedClientAsync();
        var accountResponse = await client.PostAsJsonAsync("/api/emails/accounts", new CreateMailAccountRequest(
            "reply@example.com",
            "smtp.example.com",
            "imap.example.com",
            SignatureHtml: "<p>Signature OceanERP</p>"));
        accountResponse.EnsureSuccessStatusCode();
        var account = (await accountResponse.Content.ReadFromJsonAsync<MailAccountDto>())!;

        const string replyBody = "Nouvelle reponse\n\n--- Message precedent ---\nLe 15/05/2026 19:04:31, client@example.com a ecrit :\n> Ancien message";
        var sendResponse = await client.PostAsJsonAsync("/api/emails/send", new SendEmailRequest(account.Id, "client@example.com", "Re: Sujet", replyBody));
        sendResponse.EnsureSuccessStatusCode();
        var message = (await sendResponse.Content.ReadFromJsonAsync<EmailMessageDto>())!;

        var signatureIndex = message.Body.IndexOf("Signature OceanERP", StringComparison.OrdinalIgnoreCase);
        var quoteIndex = message.Body.IndexOf("<blockquote", StringComparison.OrdinalIgnoreCase);

        Assert.True(signatureIndex >= 0);
        Assert.True(quoteIndex > signatureIndex);
        Assert.Contains("Ancien message", message.Body);
        Assert.DoesNotContain("&gt; Ancien message", message.Body);
    }

    [Fact]
    public async Task MailServerSettings_AreGlobalAndAccountsCanUseHtmlSignatures()
    {
        using var client = await CreateAuthenticatedClientAsync();
        var settingsResponse = await client.PutAsJsonAsync("/api/emails/server-settings", new UpdateMailServerSettingsRequest(
            "smtp.global.local",
            "imap.global.local",
            2525,
            1993,
            true,
            true,
            0));
        settingsResponse.EnsureSuccessStatusCode();
        var settings = (await settingsResponse.Content.ReadFromJsonAsync<MailServerSettingsDto>())!;
        Assert.True(settings.IsConfigured);
        Assert.Equal(0, settings.ImapSyncIntervalMinutes);

        var accountResponse = await client.PostAsJsonAsync("/api/emails/accounts", new CreateMailAccountRequest(
            "signature@example.com",
            Password: "secret",
            DisplayName: "Signature",
            SignatureHtml: "<p>Cordialement,<br>OceanERP</p>"));
        accountResponse.EnsureSuccessStatusCode();
        var account = (await accountResponse.Content.ReadFromJsonAsync<MailAccountDto>())!;

        Assert.Equal("smtp.global.local", account.SmtpHost);
        Assert.Equal("imap.global.local", account.ImapHost);
        Assert.Equal("<p>Cordialement,<br>OceanERP</p>", account.SignatureHtml);
    }

    [Fact]
    public async Task EmailDistributionLists_CanBeManaged()
    {
        using var client = await CreateAuthenticatedClientAsync();
        var createResponse = await client.PostAsJsonAsync("/api/emails/distribution-lists", new CreateEmailDistributionListRequest(
            $"Clients VIP {Guid.NewGuid():N}"[..24],
            "Liste commerciale",
            true,
            [
                new EmailDistributionListMemberRequest("Victor", "victor@example.com"),
                new EmailDistributionListMemberRequest(null, "contact@example.com")
            ]));
        createResponse.EnsureSuccessStatusCode();
        var created = (await createResponse.Content.ReadFromJsonAsync<EmailDistributionListDto>())!;

        Assert.True(created.IsActive);
        Assert.Equal(2, created.Members.Count);

        var updateResponse = await client.PutAsJsonAsync($"/api/emails/distribution-lists/{created.Id}", new UpdateEmailDistributionListRequest(
            "Clients VIP maj",
            null,
            false,
            [new EmailDistributionListMemberRequest("Service", "service@example.com")]));
        updateResponse.EnsureSuccessStatusCode();
        var updated = (await updateResponse.Content.ReadFromJsonAsync<EmailDistributionListDto>())!;

        Assert.Equal("Clients VIP maj", updated.Name);
        Assert.False(updated.IsActive);
        Assert.Single(updated.Members);
        Assert.Equal("service@example.com", updated.Members[0].Email);

        var lists = (await client.GetFromJsonAsync<IReadOnlyList<EmailDistributionListDto>>("/api/emails/distribution-lists"))!;
        Assert.Contains(lists, list => list.Id == created.Id && list.Members.Single().Email == "service@example.com");
    }

    private async Task<HttpClient> CreateAuthenticatedClientAsync(string email = "admin@oceanerp.local", string password = "ChangeMe!12345")
    {
        var client = factory.CreateClient(new() { BaseAddress = new Uri("https://localhost") });
        var response = await client.PostAsJsonAsync("/api/auth/login", new LoginRequest(email, password));
        response.EnsureSuccessStatusCode();
        var auth = await response.Content.ReadFromJsonAsync<AuthResponse>();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", auth!.AccessToken);
        return client;
    }
}
