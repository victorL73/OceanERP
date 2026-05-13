using System.Net.Http.Headers;
using System.Net.Http.Json;
using Erp.Application.Auth;
using Erp.Application.Quotes;

namespace Erp.IntegrationTests;

public sealed class QuoteSettingsApiTests(ApiFactory factory) : IClassFixture<ApiFactory>
{
    [Fact]
    public async Task Administrator_CanCustomizeQuoteIdentityAndLogo()
    {
        using var client = await CreateAuthenticatedClientAsync();

        var updateResponse = await client.PutAsJsonAsync("/api/quotes/settings", new UpdateQuoteSettingsRequest(
            "RenovBoat",
            "1 quai des essais",
            PostalCode: "56000",
            City: "Vannes",
            Country: "France",
            Phone: "0102030405",
            Email: "contact@renovboat.test",
            Website: "https://renovboat.test",
            VatNumber: "FR00000000000",
            Siret: "12345678900010",
            LegalText: "Devis valable selon les conditions indiquees.",
            FooterText: "Merci pour votre confiance."));
        updateResponse.EnsureSuccessStatusCode();

        var settings = (await updateResponse.Content.ReadFromJsonAsync<QuoteSettingsDto>())!;
        Assert.Equal("RenovBoat", settings.CompanyName);
        Assert.False(settings.HasLogo);

        using var form = new MultipartFormDataContent();
        var logoContent = new ByteArrayContent(Convert.FromBase64String("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII="));
        logoContent.Headers.ContentType = new MediaTypeHeaderValue("image/png");
        form.Add(logoContent, "file", "logo.png");

        var logoResponse = await client.PostAsync("/api/quotes/settings/logo", form);
        logoResponse.EnsureSuccessStatusCode();
        var withLogo = (await logoResponse.Content.ReadFromJsonAsync<QuoteSettingsDto>())!;

        Assert.True(withLogo.HasLogo);
        Assert.Equal("logo.png", withLogo.LogoFileName);
        Assert.StartsWith("data:image/png;base64,", withLogo.LogoDataUrl);
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
