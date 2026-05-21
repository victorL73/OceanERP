using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json.Nodes;
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
        Assert.Contains(workspaces!.Items, item => item.Slug == "main");
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

    [Fact]
    public async Task FlowceanCompat_WorkspaceSharingUsesExplicitErpMembers()
    {
        using var adminClient = await CreateAuthenticatedClientAsync();
        var roleName = $"Flowcean-{Guid.NewGuid():N}"[..18];
        var userEmail = $"flowcean-{Guid.NewGuid():N}@oceanerp.local";
        const string password = "ChangeMe!12345";

        var roleResponse = await adminClient.PostAsJsonAsync("/api/users/roles", new CreateRoleRequest(
            roleName,
            "Flowcean member",
            ["flowcean.read", "flowcean.write"]));
        Assert.Equal(HttpStatusCode.OK, roleResponse.StatusCode);

        var userResponse = await adminClient.PostAsJsonAsync("/api/users", new RegisterUserRequest(
            userEmail,
            "Flowcean Shared User",
            password,
            [roleName]));
        Assert.Equal(HttpStatusCode.Created, userResponse.StatusCode);

        var workspaceName = $"Partage ERP {Guid.NewGuid():N}";
        var createResponse = await adminClient.PostAsJsonAsync("/api/flowcean/compat/workspaces", new
        {
            action = "create",
            name = workspaceName
        });
        Assert.Equal(HttpStatusCode.Created, createResponse.StatusCode);
        var createdDirectory = JsonNode.Parse(await createResponse.Content.ReadAsStringAsync())!;
        var workspaceSlug = createdDirectory["workspace"]?["slug"]?.GetValue<string>();
        Assert.False(string.IsNullOrWhiteSpace(workspaceSlug));

        var beforeShareResponse = await adminClient.GetAsync($"/api/flowcean/compat/workspaces?slug={workspaceSlug}");
        Assert.Equal(HttpStatusCode.OK, beforeShareResponse.StatusCode);
        var beforeShare = JsonNode.Parse(await beforeShareResponse.Content.ReadAsStringAsync())!;
        var initialMembers = beforeShare["members"]!.AsArray();
        Assert.Single(initialMembers);
        Assert.Equal("owner", initialMembers[0]!["workspaceRole"]!.GetValue<string>());

        var peopleResponse = await adminClient.GetAsync("/api/flowcean/compat/people");
        Assert.Equal(HttpStatusCode.OK, peopleResponse.StatusCode);
        var people = JsonNode.Parse(await peopleResponse.Content.ReadAsStringAsync())!["users"]!.AsArray();
        var sharedUserId = people
            .Select(user => user!)
            .First(user => user["email"]!.GetValue<string>() == userEmail)["id"]!
            .GetValue<int>();

        var shareResponse = await adminClient.PostAsJsonAsync("/api/flowcean/compat/workspaces", new
        {
            action = "invite",
            workspaceSlug,
            email = userEmail,
            role = "viewer"
        });
        Assert.Equal(HttpStatusCode.OK, shareResponse.StatusCode);
        var sharePayload = JsonNode.Parse(await shareResponse.Content.ReadAsStringAsync())!;
        var members = sharePayload["members"]!.AsArray();
        Assert.Equal(2, members.Count);
        Assert.Contains(members, member => member!["email"]!.GetValue<string>() == userEmail
            && member["workspaceRole"]!.GetValue<string>() == "viewer");
        Assert.Contains(members, member => member!["workspaceRole"]!.GetValue<string>() == "owner");

        using var sharedClient = await CreateAuthenticatedClientAsync(userEmail, password);
        var sharedWorkspacesResponse = await sharedClient.GetAsync("/api/flowcean/compat/workspaces");
        Assert.Equal(HttpStatusCode.OK, sharedWorkspacesResponse.StatusCode);
        var sharedWorkspaces = JsonNode.Parse(await sharedWorkspacesResponse.Content.ReadAsStringAsync())!["workspaces"]!.AsArray();
        Assert.Contains(sharedWorkspaces, workspace => workspace!["slug"]!.GetValue<string>() == workspaceSlug
            && workspace["memberRole"]!.GetValue<string>() == "viewer");

        var forbiddenSaveResponse = await sharedClient.PutAsJsonAsync($"/api/flowcean/compat/workspace?slug={workspaceSlug}", new
        {
            state = JsonNode.Parse("""{"pages":[],"activePageId":null}"""),
            expectedVersion = (int?)null,
            name = workspaceName,
            clientId = "integration-test"
        });
        Assert.Equal(HttpStatusCode.Forbidden, forbiddenSaveResponse.StatusCode);

        var promoteResponse = await adminClient.PostAsJsonAsync("/api/flowcean/compat/workspaces", new
        {
            action = "update_member_role",
            workspaceSlug,
            userId = sharedUserId,
            role = "editor"
        });
        Assert.Equal(HttpStatusCode.OK, promoteResponse.StatusCode);
        var promotePayload = JsonNode.Parse(await promoteResponse.Content.ReadAsStringAsync())!;
        Assert.Contains(promotePayload["members"]!.AsArray(), member => member!["email"]!.GetValue<string>() == userEmail
            && member["workspaceRole"]!.GetValue<string>() == "editor");
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
