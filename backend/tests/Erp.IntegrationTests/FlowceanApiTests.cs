using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using Erp.Application.Auth;
using Erp.Application.Common;
using Erp.Application.Flowcean;

namespace Erp.IntegrationTests;

public sealed class FlowceanApiTests(ApiFactory factory) : IClassFixture<ApiFactory>
{
    [Fact]
    public async Task Flowcean_WorkspacesCanBeListedAndDefaultWorkspaceIsCreated()
    {
        using var client = await CreateAuthenticatedClientAsync();

        var response = await client.GetAsync("/api/flowcean/workspaces");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var workspaces = await response.Content.ReadFromJsonAsync<PagedResult<FlowceanWorkspaceSummaryDto>>();
        Assert.NotNull(workspaces);
        Assert.Contains(workspaces!.Items, item => item.Slug == "main" && item.Name == "Espace OceanERP");
    }

    [Fact]
    public async Task Flowcean_CanCreateGetAndSaveWorkspace()
    {
        using var client = await CreateAuthenticatedClientAsync();

        var createResponse = await client.PostAsJsonAsync("/api/flowcean/workspaces", new CreateFlowceanWorkspaceRequest("Atelier SAV"));
        Assert.Equal(HttpStatusCode.Created, createResponse.StatusCode);
        var created = await createResponse.Content.ReadFromJsonAsync<FlowceanWorkspaceDto>();
        Assert.Equal("atelier-sav", created!.Slug);
        Assert.Equal(1, created.Version);

        var getResponse = await client.GetAsync($"/api/flowcean/workspaces/{created.Slug}");
        Assert.Equal(HttpStatusCode.OK, getResponse.StatusCode);
        var workspace = await getResponse.Content.ReadFromJsonAsync<FlowceanWorkspaceDto>();
        Assert.Equal(created.Id, workspace!.Id);

        const string nextState = """
        {
          "pages": [
            {
              "id": "page-test",
              "type": "document",
              "title": "Compte rendu",
              "icon": "FileText",
              "favorite": true,
              "trashed": false,
              "blocks": [
                { "id": "block-1", "type": "paragraph", "text": "Controle termine." }
              ]
            }
          ],
          "activePageId": "page-test"
        }
        """;

        var saveResponse = await client.PutAsJsonAsync($"/api/flowcean/workspaces/{created.Slug}", new SaveFlowceanWorkspaceRequest(nextState, created.Version, "IntegrationTest"));
        Assert.Equal(HttpStatusCode.OK, saveResponse.StatusCode);
        var saved = await saveResponse.Content.ReadFromJsonAsync<FlowceanWorkspaceDto>();
        Assert.Equal(2, saved!.Version);
        Assert.Contains("Compte rendu", saved.DataJson);

        var conflictResponse = await client.PutAsJsonAsync($"/api/flowcean/workspaces/{created.Slug}", new SaveFlowceanWorkspaceRequest(nextState, created.Version, "Conflict"));
        Assert.Equal(HttpStatusCode.BadRequest, conflictResponse.StatusCode);
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
}
