using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using Erp.Application.Auth;

namespace Erp.IntegrationTests;

public sealed class AuthAndHealthTests(ApiFactory factory) : IClassFixture<ApiFactory>
{
    [Fact]
    public async Task Health_ReturnsOk()
    {
        using var client = factory.CreateClient(new() { BaseAddress = new Uri("https://localhost") });

        var response = await client.GetAsync("/api/health");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    [Fact]
    public async Task Login_WithSeedAdmin_ReturnsTokens()
    {
        using var client = factory.CreateClient(new() { BaseAddress = new Uri("https://localhost") });

        var response = await client.PostAsJsonAsync("/api/auth/login", new LoginRequest("admin@oceanerp.local", "ChangeMe!12345"));

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var auth = await response.Content.ReadFromJsonAsync<AuthResponse>();
        Assert.False(string.IsNullOrWhiteSpace(auth?.AccessToken));
        Assert.False(string.IsNullOrWhiteSpace(auth?.RefreshToken));
    }

    [Fact]
    public async Task UsersAndRoles_AdminCanCreateRoleAndAssignUser()
    {
        using var client = await CreateAuthenticatedClientAsync();
        var permissions = await client.GetFromJsonAsync<IReadOnlyList<PermissionDto>>("/api/users/permissions");
        Assert.Contains(permissions!, permission => permission.Code == "customers.read");

        var roleResponse = await client.PostAsJsonAsync("/api/users/roles", new CreateRoleRequest(
            $"Support-{Guid.NewGuid():N}"[..16],
            "Support role",
            ["customers.read", "quotes.read"]));
        Assert.Equal(HttpStatusCode.OK, roleResponse.StatusCode);
        var role = await roleResponse.Content.ReadFromJsonAsync<RoleDto>();

        var userResponse = await client.PostAsJsonAsync("/api/users", new RegisterUserRequest(
            $"user-{Guid.NewGuid():N}@oceanerp.local",
            "Integration User",
            "ChangeMe!12345",
            [role!.Name]));
        Assert.Equal(HttpStatusCode.Created, userResponse.StatusCode);
        var user = await userResponse.Content.ReadFromJsonAsync<UserDto>();
        Assert.Contains(role.Name, user!.Roles);

        var updateResponse = await client.PutAsJsonAsync($"/api/users/{user.Id}/roles", new UpdateUserRolesRequest(["Sales"], false));
        Assert.Equal(HttpStatusCode.OK, updateResponse.StatusCode);
        var updated = await updateResponse.Content.ReadFromJsonAsync<UserDto>();
        Assert.False(updated!.IsActive);
        Assert.Contains("Sales", updated.Roles);
    }

    [Fact]
    public async Task Profile_UserCanUpdateOwnProfileAndPassword()
    {
        using var adminClient = await CreateAuthenticatedClientAsync();
        var email = $"profile-{Guid.NewGuid():N}@oceanerp.local";
        var updatedEmail = $"profile-updated-{Guid.NewGuid():N}@oceanerp.local";
        var initialPassword = "ChangeMe!12345";
        var nextPassword = "ChangeMe!67890";

        var createResponse = await adminClient.PostAsJsonAsync("/api/users", new RegisterUserRequest(email, "Profile User", initialPassword, ["Sales"]));
        Assert.Equal(HttpStatusCode.Created, createResponse.StatusCode);

        using var userClient = factory.CreateClient(new() { BaseAddress = new Uri("https://localhost") });
        var loginResponse = await userClient.PostAsJsonAsync("/api/auth/login", new LoginRequest(email, initialPassword));
        loginResponse.EnsureSuccessStatusCode();
        var auth = await loginResponse.Content.ReadFromJsonAsync<AuthResponse>();
        userClient.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", auth!.AccessToken);

        var me = await userClient.GetFromJsonAsync<UserDto>("/api/auth/me");
        Assert.Equal(email, me!.Email);

        var updateResponse = await userClient.PutAsJsonAsync("/api/auth/me", new UpdateProfileRequest(updatedEmail, "Updated Profile"));
        Assert.Equal(HttpStatusCode.OK, updateResponse.StatusCode);
        var updated = await updateResponse.Content.ReadFromJsonAsync<UserDto>();
        Assert.Equal(updatedEmail, updated!.Email);
        Assert.Equal("Updated Profile", updated.DisplayName);

        var passwordResponse = await userClient.PostAsJsonAsync("/api/auth/change-password", new ChangePasswordRequest(initialPassword, nextPassword));
        Assert.Equal(HttpStatusCode.NoContent, passwordResponse.StatusCode);

        using var newLoginClient = factory.CreateClient(new() { BaseAddress = new Uri("https://localhost") });
        var oldLoginResponse = await newLoginClient.PostAsJsonAsync("/api/auth/login", new LoginRequest(updatedEmail, initialPassword));
        Assert.Equal(HttpStatusCode.Unauthorized, oldLoginResponse.StatusCode);

        var newLoginResponse = await newLoginClient.PostAsJsonAsync("/api/auth/login", new LoginRequest(updatedEmail, nextPassword));
        Assert.Equal(HttpStatusCode.OK, newLoginResponse.StatusCode);
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
