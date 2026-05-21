using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;
using System.Text.RegularExpressions;
using Erp.Application.Ai;
using Erp.Application.Common;
using Erp.Domain.Auth;
using Erp.Domain.FutureModules;
using Erp.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Erp.Api.Controllers;

[ApiController]
[Route("api/flowcean/compat")]
[Authorize]
public sealed class FlowceanCompatController(
    ErpDbContext db,
    ICurrentUserService currentUser,
    IAiSettingsService aiSettings,
    IHttpClientFactory httpClientFactory) : ControllerBase
{
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);

    [HttpGet("auth")]
    public async Task<ActionResult> Auth(CancellationToken cancellationToken)
    {
        var user = await CurrentUserAsync(cancellationToken);
        if (user is null)
        {
            return Unauthorized(new { ok = false, authenticated = false, message = "Session OceanERP invalide." });
        }

        return Ok(new { ok = true, authenticated = true, needsSetup = false, user = await PublicUserAsync(user, cancellationToken) });
    }

    [HttpPost("auth")]
    public async Task<ActionResult> LoginFallback(CancellationToken cancellationToken)
        => await Auth(cancellationToken);

    [HttpDelete("auth")]
    public ActionResult LogoutFallback()
        => Ok(new { ok = true, authenticated = false });

    [HttpGet("workspace")]
    [Authorize(Policy = "flowcean.read")]
    public async Task<ActionResult> GetWorkspace([FromQuery] string? slug, CancellationToken cancellationToken)
    {
        var workspace = await FindOrCreateWorkspaceAsync(NormalizeSlug(slug), cancellationToken);
        return Ok(await WorkspacePayloadAsync(workspace, cancellationToken));
    }

    [HttpPut("workspace")]
    [HttpPost("workspace")]
    [Authorize(Policy = "flowcean.write")]
    public async Task<ActionResult> SaveWorkspace([FromQuery] string? slug, FlowceanCompatSaveRequest request, CancellationToken cancellationToken)
    {
        var workspace = await FindOrCreateWorkspaceAsync(NormalizeSlug(slug), cancellationToken);
        var expectedVersion = request.ExpectedVersion;
        if (expectedVersion is not null && expectedVersion.Value != workspace.Version)
        {
            var conflictPayload = await WorkspacePayloadAsync(workspace, cancellationToken);
            return StatusCode(StatusCodes.Status409Conflict, new
            {
                ok = false,
                error = "version_conflict",
                message = "L'espace a ete modifie ailleurs. Rechargez avant d'enregistrer.",
                conflictPayload.workspace,
                conflictPayload.meta
            });
        }

        if (request.State.ValueKind is not JsonValueKind.Object)
        {
            return BadRequest(new { ok = false, message = "Etat Flowcean invalide." });
        }

        workspace.Name = string.IsNullOrWhiteSpace(request.Name) ? workspace.Name : request.Name.Trim();
        workspace.DataJson = request.State.GetRawText();
        workspace.Version += 1;

        db.FlowceanWorkspaceEvents.Add(new FlowceanWorkspaceEvent
        {
            FlowceanWorkspaceId = workspace.Id,
            ActorUserId = currentUser.UserId,
            EventType = "workspace.saved",
            PayloadJson = JsonSerializer.Serialize(new { workspace.Version, request.ClientId }, JsonOptions)
        });

        await db.SaveChangesAsync(cancellationToken);
        return Ok(await WorkspacePayloadAsync(workspace, cancellationToken));
    }

    [HttpGet("workspaces")]
    [Authorize(Policy = "flowcean.read")]
    public async Task<ActionResult> GetWorkspaces([FromQuery] string? slug, CancellationToken cancellationToken)
    {
        if (!string.IsNullOrWhiteSpace(slug))
        {
            var workspace = await FindOrCreateWorkspaceAsync(NormalizeSlug(slug), cancellationToken);
            return Ok(new
            {
                ok = true,
                workspace = PublicWorkspace(workspace, await IsCurrentUserAdminAsync(cancellationToken)),
                members = await WorkspaceMembersAsync(workspace, cancellationToken),
                invitations = Array.Empty<object>()
            });
        }

        await FindOrCreateWorkspaceAsync("main", cancellationToken);
        var isAdmin = await IsCurrentUserAdminAsync(cancellationToken);
        var workspaces = await db.FlowceanWorkspaces
            .AsNoTracking()
            .OrderByDescending(x => x.UpdatedAt ?? x.CreatedAt)
            .ThenBy(x => x.Name)
            .ToListAsync(cancellationToken);

        return Ok(new
        {
            ok = true,
            workspaces = workspaces.Select(workspace => PublicWorkspace(workspace, isAdmin)).ToList(),
            deletedWorkspaces = Array.Empty<object>(),
            pendingInvitations = Array.Empty<object>(),
            preferredWorkspaceSlug = workspaces.FirstOrDefault(x => x.Slug == "main")?.Slug ?? workspaces.FirstOrDefault()?.Slug
        });
    }

    [HttpPost("workspaces")]
    [Authorize(Policy = "flowcean.write")]
    public async Task<ActionResult> WorkspaceAction(FlowceanCompatWorkspaceAction request, CancellationToken cancellationToken)
    {
        var action = request.Action?.Trim().ToLowerInvariant();
        if (action == "create")
        {
            var requestedName = string.IsNullOrWhiteSpace(request.Name) ? "Nouvel espace" : request.Name.Trim();
            var name = await UniqueWorkspaceNameAsync(requestedName, cancellationToken);
            var slug = await UniqueSlugAsync(Slugify(name), cancellationToken);
            var workspace = new FlowceanWorkspace
            {
                Name = name,
                Slug = slug,
                OwnerUserId = currentUser.UserId,
                DataJson = CreateDefaultFlowceanState(name, slug),
                Version = 1
            };

            db.FlowceanWorkspaces.Add(workspace);
            await db.SaveChangesAsync(cancellationToken);
            return StatusCode(StatusCodes.Status201Created, await GetDirectoryPayloadAsync(slug, cancellationToken));
        }

        if (action == "import")
        {
            if (request.State.ValueKind is not JsonValueKind.Object)
            {
                return BadRequest(new { ok = false, message = "Fichier Flowcean invalide." });
            }

            var requestedName = !string.IsNullOrWhiteSpace(request.Name)
                ? request.Name.Trim()
                : ExtractWorkspaceName(request.State) ?? "Espace importe";
            var name = await UniqueWorkspaceNameAsync(requestedName, cancellationToken);
            var slug = await UniqueSlugAsync(Slugify(name), cancellationToken);
            var workspace = new FlowceanWorkspace
            {
                Name = name,
                Slug = slug,
                OwnerUserId = currentUser.UserId,
                DataJson = NormalizeImportedFlowceanState(request.State, name, slug),
                Version = 1
            };

            db.FlowceanWorkspaces.Add(workspace);
            db.FlowceanWorkspaceEvents.Add(new FlowceanWorkspaceEvent
            {
                FlowceanWorkspaceId = workspace.Id,
                ActorUserId = currentUser.UserId,
                EventType = "workspace.imported",
                PayloadJson = JsonSerializer.Serialize(new { name, slug }, JsonOptions)
            });
            await db.SaveChangesAsync(cancellationToken);
            return StatusCode(StatusCodes.Status201Created, await GetDirectoryPayloadAsync(slug, cancellationToken));
        }

        if (action is "delete_workspace")
        {
            var workspace = await db.FlowceanWorkspaces.FirstOrDefaultAsync(x => x.Slug == NormalizeSlug(request.WorkspaceSlug), cancellationToken);
            if (workspace is not null && workspace.Slug != "main")
            {
                db.FlowceanWorkspaces.Remove(workspace);
                await db.SaveChangesAsync(cancellationToken);
            }

            return Ok(await GetDirectoryPayloadAsync("main", cancellationToken));
        }

        if (action is "restore_workspace")
        {
            return Ok(await GetDirectoryPayloadAsync(NormalizeSlug(request.WorkspaceSlug), cancellationToken));
        }

        if (action is "invite" or "update_member_role" or "remove_member")
        {
            var workspace = await FindOrCreateWorkspaceAsync(NormalizeSlug(request.WorkspaceSlug), cancellationToken);
            return Ok(new
            {
                ok = true,
                workspace = PublicWorkspace(workspace, await IsCurrentUserAdminAsync(cancellationToken)),
                members = await WorkspaceMembersAsync(workspace, cancellationToken),
                invitations = Array.Empty<object>()
            });
        }

        if (action is "accept_invite" or "decline_invite")
        {
            return Ok(await GetDirectoryPayloadAsync("main", cancellationToken));
        }

        return BadRequest(new { ok = false, message = "Action Flowcean non reconnue." });
    }

    [HttpGet("preferences")]
    public ActionResult GetPreferences()
        => Ok(new { ok = true, userPreferences = DefaultPreferences(), meta = new { exists = false, updatedAt = (string?)null } });

    [HttpPut("preferences")]
    [HttpPost("preferences")]
    public ActionResult SavePreferences(FlowceanCompatPreferencesRequest request)
        => Ok(new { ok = true, userPreferences = request.Preferences.ValueKind == JsonValueKind.Object ? request.Preferences : DefaultPreferences(), meta = new { exists = true, updatedAt = DateTimeOffset.UtcNow } });

    [HttpGet("people")]
    public async Task<ActionResult> People(CancellationToken cancellationToken)
    {
        var users = await db.Users
            .AsNoTracking()
            .Where(x => x.IsActive)
            .OrderBy(x => x.DisplayName)
            .ThenBy(x => x.Email)
            .ToListAsync(cancellationToken);

        return Ok(new { ok = true, users = users.Select(PublicDirectoryUser).ToList() });
    }

    [HttpGet("users")]
    public async Task<ActionResult> Users(CancellationToken cancellationToken)
        => await People(cancellationToken);

    [HttpPost("presence")]
    public async Task<ActionResult> Presence([FromQuery] string? workspaceSlug, CancellationToken cancellationToken)
    {
        var user = await CurrentUserAsync(cancellationToken);
        return Ok(new
        {
            ok = true,
            workspaceSlug = NormalizeSlug(workspaceSlug),
            presence = user is null ? Array.Empty<object>() : new[] { new { user = PublicDirectoryUser(user), status = "online", lastSeenAt = DateTimeOffset.UtcNow } }
        });
    }

    [HttpGet("notifications")]
    public ActionResult Notifications()
        => Ok(new { ok = true, notifications = Array.Empty<object>(), unreadCount = 0 });

    [HttpPost("notifications")]
    public ActionResult UpdateNotifications()
        => Ok(new { ok = true, notifications = Array.Empty<object>(), unreadCount = 0 });

    [HttpGet("realtime")]
    public ActionResult Realtime()
        => Ok(new { ok = true, realtime = false });

    [HttpGet("ai")]
    public async Task<ActionResult> GetAi(CancellationToken cancellationToken)
    {
        var runtimeResult = await aiSettings.GetRuntimeAsync(cancellationToken);
        if (!runtimeResult.Succeeded || runtimeResult.Value is null)
        {
            return Ok(new
            {
                ok = true,
                settings = new
                {
                    isEnabled = false,
                    provider = "groq",
                    model = "llama-3.3-70b-versatile",
                    hasApiKey = false,
                    message = runtimeResult.Error ?? "Assistant IA non configure dans OceanERP."
                }
            });
        }

        return Ok(new { ok = true, settings = PublicAiSettings(runtimeResult.Value) });
    }

    [HttpPost("ai")]
    public async Task<ActionResult> PostAi(FlowceanAiRequest request, CancellationToken cancellationToken)
    {
        var runtimeResult = await aiSettings.GetRuntimeAsync(cancellationToken);
        if (!runtimeResult.Succeeded || runtimeResult.Value is null)
        {
            return BadRequest(new { ok = false, message = runtimeResult.Error ?? "Parametres IA indisponibles." });
        }

        var runtime = runtimeResult.Value;
        if (!runtime.IsEnabled)
        {
            return BadRequest(new { ok = false, message = "Assistant IA desactive dans Parametres > IA de l'ERP." });
        }

        if (!string.Equals(runtime.Provider, "groq", StringComparison.OrdinalIgnoreCase))
        {
            return BadRequest(new { ok = false, message = "Flowcean utilise uniquement Groq via les parametres IA de l'ERP." });
        }

        if (string.IsNullOrWhiteSpace(runtime.ApiKey))
        {
            return BadRequest(new { ok = false, message = "Cle Groq non configuree dans Parametres > IA de l'ERP." });
        }

        var prompt = BuildFlowceanAiPrompt(request);
        if (string.IsNullOrWhiteSpace(prompt))
        {
            return BadRequest(new { ok = false, message = "Demande IA vide." });
        }

        var httpRequest = new HttpRequestMessage(HttpMethod.Post, BuildGroqCompletionUri(runtime.EndpointUrl));
        httpRequest.Headers.Authorization = new AuthenticationHeaderValue("Bearer", runtime.ApiKey);
        httpRequest.Content = new StringContent(JsonSerializer.Serialize(new
        {
            model = runtime.Model,
            temperature = runtime.Temperature,
            max_tokens = runtime.MaxTokens,
            messages = new object[]
            {
                new
                {
                    role = "system",
                    content = string.IsNullOrWhiteSpace(runtime.SystemPrompt)
                        ? "Tu es l'assistant IA interne OceanERP. Reponds en francais, de facon concise, utile et directement exploitable dans un espace de travail collaboratif."
                        : runtime.SystemPrompt
                },
                new { role = "user", content = prompt }
            }
        }, JsonOptions), Encoding.UTF8, "application/json");

        using var response = await httpClientFactory.CreateClient().SendAsync(httpRequest, cancellationToken);
        var body = await response.Content.ReadAsStringAsync(cancellationToken);
        if (!response.IsSuccessStatusCode)
        {
            return StatusCode((int)response.StatusCode, new
            {
                ok = false,
                message = $"Groq a refuse la demande IA: HTTP {(int)response.StatusCode}.",
                detail = body
            });
        }

        var answer = ExtractGroqAnswer(body);
        return Ok(new { ok = true, answer, text = answer, settings = PublicAiSettings(runtime) });
    }

    private async Task<dynamic> WorkspacePayloadAsync(FlowceanWorkspace workspace, CancellationToken cancellationToken)
    {
        var state = ParseState(workspace.DataJson);
        return new
        {
            ok = true,
            workspace = state,
            meta = WorkspaceMeta(workspace, await IsCurrentUserAdminAsync(cancellationToken)),
            userPreferences = DefaultPreferences(),
            userPreferencesMeta = new { exists = false, updatedAt = (string?)null }
        };
    }

    private async Task<object> GetDirectoryPayloadAsync(string? preferredSlug, CancellationToken cancellationToken)
    {
        await FindOrCreateWorkspaceAsync("main", cancellationToken);
        var isAdmin = await IsCurrentUserAdminAsync(cancellationToken);
        var workspaces = await db.FlowceanWorkspaces
            .AsNoTracking()
            .OrderByDescending(x => x.UpdatedAt ?? x.CreatedAt)
            .ThenBy(x => x.Name)
            .ToListAsync(cancellationToken);
        var normalizedPreferredSlug = string.IsNullOrWhiteSpace(preferredSlug) ? null : NormalizeSlug(preferredSlug);
        var preferredWorkspace = normalizedPreferredSlug is null
            ? workspaces.FirstOrDefault()
            : workspaces.FirstOrDefault(x => x.Slug == normalizedPreferredSlug) ?? workspaces.FirstOrDefault();

        return new
        {
            ok = true,
            workspaces = workspaces.Select(workspace => PublicWorkspace(workspace, isAdmin)).ToList(),
            deletedWorkspaces = Array.Empty<object>(),
            pendingInvitations = Array.Empty<object>(),
            workspace = preferredWorkspace is null ? null : PublicWorkspace(preferredWorkspace, isAdmin),
            preferredWorkspaceSlug = preferredWorkspace?.Slug
        };
    }

    private async Task<FlowceanWorkspace> FindOrCreateWorkspaceAsync(string? slug, CancellationToken cancellationToken)
    {
        var normalizedSlug = NormalizeSlug(slug);
        var workspace = await db.FlowceanWorkspaces.FirstOrDefaultAsync(x => x.Slug == normalizedSlug, cancellationToken);
        if (workspace is not null)
        {
            return workspace;
        }

        if (normalizedSlug != "main")
        {
            var main = await db.FlowceanWorkspaces.FirstOrDefaultAsync(x => x.Slug == "main", cancellationToken);
            if (main is not null)
            {
                return main;
            }
        }

        workspace = new FlowceanWorkspace
        {
            Name = "RenovBoat",
            Slug = "main",
            OwnerUserId = currentUser.UserId,
            DataJson = CreateDefaultFlowceanState("RenovBoat", "main"),
            Version = 1
        };

        db.FlowceanWorkspaces.Add(workspace);
        await db.SaveChangesAsync(cancellationToken);
        return workspace;
    }

    private async Task<List<object>> WorkspaceMembersAsync(FlowceanWorkspace workspace, CancellationToken cancellationToken)
    {
        var isAdmin = await IsCurrentUserAdminAsync(cancellationToken);
        var users = await db.Users
            .AsNoTracking()
            .Where(x => x.IsActive)
            .OrderBy(x => x.DisplayName)
            .ThenBy(x => x.Email)
            .ToListAsync(cancellationToken);

        return users.Select(user => new
        {
            id = FlowceanUserId(user.Id),
            email = user.Email,
            displayName = user.DisplayName,
            role = isAdmin ? "admin" : "member",
            workspaceRole = user.Id == workspace.OwnerUserId || isAdmin ? "owner" : "editor",
            isActive = user.IsActive,
            joinedAt = user.CreatedAt
        }).Cast<object>().ToList();
    }

    private async Task<User?> CurrentUserAsync(CancellationToken cancellationToken)
    {
        if (currentUser.UserId is Guid userId)
        {
            return await db.Users.AsNoTracking().FirstOrDefaultAsync(x => x.Id == userId, cancellationToken);
        }

        return string.IsNullOrWhiteSpace(currentUser.Email)
            ? null
            : await db.Users.AsNoTracking().FirstOrDefaultAsync(x => x.Email == currentUser.Email, cancellationToken);
    }

    private async Task<object?> PublicUserAsync(User user, CancellationToken cancellationToken)
    {
        var isAdmin = await IsCurrentUserAdminAsync(cancellationToken);
        return new
        {
            id = FlowceanUserId(user.Id),
            email = user.Email,
            displayName = user.DisplayName,
            role = isAdmin ? "super" : "member",
            isActive = user.IsActive,
            createdAt = user.CreatedAt,
            permissions = AdminPermissions(isAdmin)
        };
    }

    private static object PublicDirectoryUser(User user)
        => new
        {
            id = FlowceanUserId(user.Id),
            email = user.Email,
            displayName = user.DisplayName,
            role = "member",
            isActive = user.IsActive,
            createdAt = user.CreatedAt
        };

    private static object PublicWorkspace(FlowceanWorkspace workspace, bool isAdmin)
        => new
        {
            slug = workspace.Slug,
            name = workspace.Name,
            version = workspace.Version,
            updatedAt = workspace.UpdatedAt ?? workspace.CreatedAt,
            createdAt = workspace.CreatedAt,
            memberRole = isAdmin ? "owner" : "editor",
            permissions = WorkspacePermissions(isAdmin),
            isPersonal = workspace.IsPersonal
        };

    private static object WorkspaceMeta(FlowceanWorkspace workspace, bool isAdmin)
        => new
        {
            slug = workspace.Slug,
            name = workspace.Name,
            version = workspace.Version,
            updatedAt = workspace.UpdatedAt ?? workspace.CreatedAt,
            createdAt = workspace.CreatedAt,
            created = false,
            memberRole = isAdmin ? "owner" : "editor",
            permissions = WorkspacePermissions(isAdmin),
            isPersonal = workspace.IsPersonal
        };

    private static object WorkspacePermissions(bool isAdmin)
        => new
        {
            canView = true,
            canEdit = true,
            canInvite = isAdmin,
            canManageMembers = isAdmin,
            canManageWorkspace = isAdmin,
            canDeleteWorkspace = isAdmin
        };

    private static object AdminPermissions(bool isAdmin)
        => new
        {
            canManageUsers = isAdmin,
            canCreateAdmins = isAdmin,
            canManageWorkspace = isAdmin,
            canAccessAllWorkspaces = isAdmin,
            canSuperviseEverything = isAdmin
        };

    private static object PublicAiSettings(AiRuntimeSettings settings)
        => new
        {
            isEnabled = settings.IsEnabled,
            provider = settings.Provider,
            endpointUrl = settings.EndpointUrl,
            model = settings.Model,
            hasApiKey = !string.IsNullOrWhiteSpace(settings.ApiKey),
            temperature = settings.Temperature,
            maxTokens = settings.MaxTokens,
            systemPrompt = settings.SystemPrompt
        };

    private static Uri BuildGroqCompletionUri(string endpointUrl)
    {
        var trimmed = string.IsNullOrWhiteSpace(endpointUrl)
            ? "https://api.groq.com/openai/v1"
            : endpointUrl.Trim().TrimEnd('/');
        if (!trimmed.EndsWith("/chat/completions", StringComparison.OrdinalIgnoreCase))
        {
            trimmed = $"{trimmed}/chat/completions";
        }

        return new Uri(trimmed, UriKind.Absolute);
    }

    private static string BuildFlowceanAiPrompt(FlowceanAiRequest request)
    {
        if (string.Equals(request.Action, "test", StringComparison.OrdinalIgnoreCase))
        {
            return "Reponds uniquement par une phrase courte confirmant que la connexion Groq fonctionne pour OceanERP.";
        }

        var task = string.IsNullOrWhiteSpace(request.Task) ? "chat" : request.Task.Trim();
        var prompt = request.Prompt?.Trim();
        var context = request.Context?.Trim();

        return string.Join("\n\n", new[]
        {
            $"Tache Flowcean: {task}",
            string.IsNullOrWhiteSpace(prompt) ? null : $"Demande utilisateur:\n{prompt}",
            string.IsNullOrWhiteSpace(context) ? null : $"Contexte de la page active:\n{context}"
        }.Where(x => !string.IsNullOrWhiteSpace(x)));
    }

    private static string ExtractGroqAnswer(string body)
    {
        using var document = JsonDocument.Parse(body);
        var root = document.RootElement;
        if (root.TryGetProperty("choices", out var choices)
            && choices.ValueKind == JsonValueKind.Array
            && choices.GetArrayLength() > 0)
        {
            var first = choices[0];
            if (first.TryGetProperty("message", out var message)
                && message.TryGetProperty("content", out var content)
                && content.ValueKind == JsonValueKind.String)
            {
                return content.GetString() ?? string.Empty;
            }

            if (first.TryGetProperty("text", out var text)
                && text.ValueKind == JsonValueKind.String)
            {
                return text.GetString() ?? string.Empty;
            }
        }

        return string.Empty;
    }

    private async Task<bool> IsCurrentUserAdminAsync(CancellationToken cancellationToken)
    {
        if (currentUser.UserId is not Guid userId)
        {
            return false;
        }

        return await db.UserRoles
            .AsNoTracking()
            .AnyAsync(x => x.UserId == userId && x.Role != null && x.Role.Name == "Administrator", cancellationToken);
    }

    private static JsonElement ParseState(string dataJson)
    {
        try
        {
            return JsonSerializer.Deserialize<JsonElement>(dataJson);
        }
        catch (JsonException)
        {
            return JsonSerializer.Deserialize<JsonElement>("{}");
        }
    }

    private static object DefaultPreferences()
        => new { favoritePageIds = Array.Empty<string>(), initialized = false };

    private async Task<string> UniqueSlugAsync(string baseSlug, CancellationToken cancellationToken)
    {
        var root = string.IsNullOrWhiteSpace(baseSlug) ? "workspace" : baseSlug;
        var slug = root;
        var suffix = 2;
        while (await db.FlowceanWorkspaces.AnyAsync(x => x.Slug == slug, cancellationToken))
        {
            slug = $"{root}-{suffix++}";
        }

        return slug;
    }

    private async Task<string> UniqueWorkspaceNameAsync(string requestedName, CancellationToken cancellationToken)
    {
        var root = string.IsNullOrWhiteSpace(requestedName) ? "Espace importe" : requestedName.Trim();
        var candidate = root;
        var suffix = 2;
        while (await db.FlowceanWorkspaces.AnyAsync(x => x.Name.ToLower() == candidate.ToLower(), cancellationToken))
        {
            candidate = $"{root} {suffix++}";
        }

        return candidate;
    }

    private static string? ExtractWorkspaceName(JsonElement state)
    {
        if (state.TryGetProperty("workspace", out var workspace)
            && workspace.ValueKind == JsonValueKind.Object
            && workspace.TryGetProperty("name", out var name)
            && name.ValueKind == JsonValueKind.String)
        {
            return name.GetString();
        }

        return null;
    }

    private static string NormalizeImportedFlowceanState(JsonElement state, string name, string slug)
    {
        JsonObject root;
        try
        {
            root = JsonNode.Parse(state.GetRawText()) as JsonObject ?? new JsonObject();
        }
        catch (JsonException)
        {
            root = new JsonObject();
        }

        var workspace = root["workspace"] as JsonObject ?? new JsonObject();
        workspace["name"] = name;
        root["workspace"] = workspace;

        var meta = root["meta"] as JsonObject ?? new JsonObject();
        meta["workspaceSlug"] = slug;
        meta["source"] = "oceanerp-flowcean-import";
        meta["importedAt"] = DateTimeOffset.UtcNow.ToString("O");
        root["meta"] = meta;

        return root.ToJsonString(JsonOptions);
    }

    private static string NormalizeSlug(string? slug)
        => Slugify(string.IsNullOrWhiteSpace(slug) ? "main" : slug);

    private static string Slugify(string value)
    {
        var lower = value.Trim().ToLowerInvariant();
        var cleaned = Regex.Replace(lower, @"[^a-z0-9]+", "-").Trim('-');
        return string.IsNullOrWhiteSpace(cleaned) ? "workspace" : cleaned[..Math.Min(cleaned.Length, 100)];
    }

    private static int FlowceanUserId(Guid id)
    {
        var value = Math.Abs(BitConverter.ToInt32(id.ToByteArray(), 0));
        return value == 0 ? 1 : value;
    }

    private static string CreateDefaultFlowceanState(string name, string slug)
    {
        var now = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
        var state = new
        {
            workspace = new { name, theme = "dark" },
            ui = new { activePageId = "page-welcome" },
            meta = new { workspaceSlug = slug, source = "oceanerp-flowcean-direct" },
            pages = new object[]
            {
                new
                {
                    id = "page-welcome",
                    parentId = (string?)null,
                    title = "Accueil OceanERP",
                    icon = "OE",
                    favorite = true,
                    expanded = true,
                    kind = "document",
                    updatedAt = now,
                    deletedAt = (long?)null,
                    blocks = new object[]
                    {
                        new { id = "block-title", type = "h1", text = "Espace de travail collaboratif" },
                        new { id = "block-intro", type = "paragraph", text = "Organisez les pages, listes, tableaux, decisions et suivis internes dans OceanERP." },
                        new { id = "block-risk", type = "callout", text = "Ce module utilise directement Flowcean et enregistre les donnees dans PostgreSQL OceanERP." },
                        new { id = "block-todo", type = "todo", text = "Adapter les pages aux methodes de l'entreprise", @checked = false }
                    },
                    database = (object?)null
                }
            }
        };

        return JsonSerializer.Serialize(state, JsonOptions);
    }
}

public sealed record FlowceanCompatSaveRequest(JsonElement State, int? ExpectedVersion, string? Name, string? ClientId);

public sealed record FlowceanCompatWorkspaceAction(
    string? Action,
    string? Name,
    string? WorkspaceSlug,
    JsonElement State,
    int? UserId,
    string? Email,
    string? Role,
    int? InvitationId);

public sealed record FlowceanCompatPreferencesRequest(JsonElement Preferences);

public sealed record FlowceanAiRequest(
    string? Action,
    string? Task,
    string? Prompt,
    string? Context);
