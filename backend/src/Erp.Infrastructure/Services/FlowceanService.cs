using System.Text.Json;
using System.Text.RegularExpressions;
using Erp.Application.Common;
using Erp.Application.Flowcean;
using Erp.Domain.FutureModules;
using Erp.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Erp.Infrastructure.Services;

public sealed class FlowceanService(ErpDbContext db, ICurrentUserService currentUser) : IFlowceanService
{
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);

    public async Task<PagedResult<FlowceanWorkspaceSummaryDto>> SearchAsync(CancellationToken cancellationToken)
    {
        await EnsureDefaultWorkspaceAsync(cancellationToken);

        var workspaces = await db.FlowceanWorkspaces
            .AsNoTracking()
            .OrderByDescending(x => x.UpdatedAt ?? x.CreatedAt)
            .ThenBy(x => x.Name)
            .ToListAsync(cancellationToken);

        return new PagedResult<FlowceanWorkspaceSummaryDto>(workspaces.Select(MapSummary).ToList(), workspaces.Count, 1, 100);
    }

    public async Task<Result<FlowceanWorkspaceDto>> GetAsync(string slug, CancellationToken cancellationToken)
    {
        var normalizedSlug = NormalizeSlug(slug);
        var workspace = await db.FlowceanWorkspaces.AsNoTracking().FirstOrDefaultAsync(x => x.Slug == normalizedSlug, cancellationToken);
        if (workspace is null && normalizedSlug == "main")
        {
            workspace = await CreateDefaultWorkspaceAsync(cancellationToken);
        }

        return workspace is null
            ? Result<FlowceanWorkspaceDto>.Failure("Espace de travail introuvable.")
            : Result<FlowceanWorkspaceDto>.Success(Map(workspace));
    }

    public async Task<Result<FlowceanWorkspaceDto>> CreateAsync(CreateFlowceanWorkspaceRequest request, CancellationToken cancellationToken)
    {
        var name = request.Name.Trim();
        if (string.IsNullOrWhiteSpace(name))
        {
            return Result<FlowceanWorkspaceDto>.Failure("Le nom de l'espace de travail est obligatoire.");
        }

        var slug = await UniqueSlugAsync(Slugify(name), cancellationToken);
        var workspace = new FlowceanWorkspace
        {
            Name = name,
            Slug = slug,
            OwnerUserId = currentUser.UserId,
            DataJson = CreateDefaultStateJson(name, slug),
            Version = 1,
            IsPersonal = false
        };

        db.FlowceanWorkspaces.Add(workspace);
        await db.SaveChangesAsync(cancellationToken);
        return Result<FlowceanWorkspaceDto>.Success(Map(workspace));
    }

    public async Task<Result<FlowceanWorkspaceDto>> SaveAsync(string slug, SaveFlowceanWorkspaceRequest request, CancellationToken cancellationToken)
    {
        var normalizedSlug = NormalizeSlug(slug);
        var workspace = await db.FlowceanWorkspaces.FirstOrDefaultAsync(x => x.Slug == normalizedSlug, cancellationToken);
        if (workspace is null)
        {
            return Result<FlowceanWorkspaceDto>.Failure("Espace de travail introuvable.");
        }

        if (request.Version != workspace.Version)
        {
            return Result<FlowceanWorkspaceDto>.Failure("L'espace de travail a ete modifie ailleurs. Rechargez avant d'enregistrer.");
        }

        if (!IsValidJsonObject(request.DataJson))
        {
            return Result<FlowceanWorkspaceDto>.Failure("Le contenu de l'espace de travail doit etre un objet JSON valide.");
        }

        workspace.DataJson = request.DataJson;
        workspace.Version += 1;

        db.FlowceanWorkspaceEvents.Add(new FlowceanWorkspaceEvent
        {
            FlowceanWorkspaceId = workspace.Id,
            ActorUserId = currentUser.UserId,
            EventType = string.IsNullOrWhiteSpace(request.EventType) ? "Saved" : request.EventType.Trim(),
            PayloadJson = JsonSerializer.Serialize(new { version = workspace.Version }, JsonOptions)
        });

        await db.SaveChangesAsync(cancellationToken);
        return Result<FlowceanWorkspaceDto>.Success(Map(workspace));
    }

    private async Task<FlowceanWorkspace> CreateDefaultWorkspaceAsync(CancellationToken cancellationToken)
    {
        const string slug = "main";
        var workspace = new FlowceanWorkspace
        {
            Name = "Espace OceanERP",
            Slug = slug,
            OwnerUserId = currentUser.UserId,
            DataJson = CreateDefaultStateJson("Espace OceanERP", slug),
            Version = 1,
            IsPersonal = false
        };
        db.FlowceanWorkspaces.Add(workspace);
        await db.SaveChangesAsync(cancellationToken);
        return workspace;
    }

    private async Task<FlowceanWorkspace> EnsureDefaultWorkspaceAsync(CancellationToken cancellationToken)
    {
        var workspace = await db.FlowceanWorkspaces.FirstOrDefaultAsync(x => x.Slug == "main", cancellationToken);
        return workspace ?? await CreateDefaultWorkspaceAsync(cancellationToken);
    }

    private async Task<string> UniqueSlugAsync(string baseSlug, CancellationToken cancellationToken)
    {
        var slug = string.IsNullOrWhiteSpace(baseSlug) ? "workspace" : baseSlug;
        var candidate = slug;
        var suffix = 2;
        while (await db.FlowceanWorkspaces.AnyAsync(x => x.Slug == candidate, cancellationToken))
        {
            candidate = $"{slug}-{suffix++}";
        }

        return candidate;
    }

    private static bool IsValidJsonObject(string value)
    {
        try
        {
            using var document = JsonDocument.Parse(value);
            return document.RootElement.ValueKind == JsonValueKind.Object;
        }
        catch (JsonException)
        {
            return false;
        }
    }

    private static string NormalizeSlug(string slug)
        => Slugify(slug);

    private static string Slugify(string value)
    {
        var lower = value.Trim().ToLowerInvariant();
        var cleaned = Regex.Replace(lower, @"[^a-z0-9]+", "-").Trim('-');
        return string.IsNullOrWhiteSpace(cleaned) ? "workspace" : cleaned[..Math.Min(cleaned.Length, 100)];
    }

    private static string CreateDefaultStateJson(string name, string slug)
    {
        var now = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
        var welcomeId = "page-welcome";
        var databaseId = "page-roadmap";
        var statusPropertyId = "prop-status";
        var ownerPropertyId = "prop-owner";
        var datePropertyId = "prop-date";
        var effortPropertyId = "prop-effort";

        var state = new
        {
            workspace = new { name, theme = "light" },
            ui = new { activePageId = welcomeId },
            meta = new { workspaceSlug = slug, source = "oceanerp-flowcean" },
            pages = new object[]
            {
                new
                {
                    id = welcomeId,
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
                        new { id = "block-title", @type = "h1", text = "Espace de travail collaboratif", @checked = (bool?)null },
                        new { id = "block-intro", @type = "paragraph", text = "Centralisez les notes, listes, tableaux et suivis internes directement dans OceanERP.", @checked = (bool?)null },
                        new { id = "block-drive", @type = "callout", text = "Le Drive conserve les fichiers. Flowcean garde les pages et bases de travail structurees.", @checked = (bool?)null },
                        new { id = "block-todo", @type = "todo", text = "Adapter les pages aux methodes de l'entreprise", @checked = false }
                    },
                    database = (object?)null
                },
                new
                {
                    id = databaseId,
                    parentId = (string?)null,
                    title = "Roadmap ERP",
                    icon = "DB",
                    favorite = false,
                    expanded = true,
                    kind = "database",
                    updatedAt = now,
                    deletedAt = (long?)null,
                    blocks = Array.Empty<object>(),
                    database = new
                    {
                        activeView = "table",
                        properties = new object[]
                        {
                            new { id = "prop-name", name = "Tache", @type = "text", options = Array.Empty<string>() },
                            new { id = statusPropertyId, name = "Statut", @type = "select", options = new[] { "A faire", "En cours", "Termine" } },
                            new { id = ownerPropertyId, name = "Responsable", @type = "text", options = Array.Empty<string>() },
                            new { id = datePropertyId, name = "Date", @type = "date", options = Array.Empty<string>() },
                            new { id = effortPropertyId, name = "Charge", @type = "number", options = Array.Empty<string>() }
                        },
                        rows = new object[]
                        {
                            new { id = "row-drive", cells = new Dictionary<string, object?> { ["prop-name"] = "Finaliser le Drive documentaire", [statusPropertyId] = "En cours", [ownerPropertyId] = "Equipe ERP", [datePropertyId] = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(7)).ToString("yyyy-MM-dd"), [effortPropertyId] = 3 } },
                            new { id = "row-sign", cells = new Dictionary<string, object?> { ["prop-name"] = "Circuit de signature interne", [statusPropertyId] = "Termine", [ownerPropertyId] = "Equipe ERP", [datePropertyId] = DateOnly.FromDateTime(DateTime.UtcNow).ToString("yyyy-MM-dd"), [effortPropertyId] = 5 } }
                        }
                    }
                }
            }
        };

        return JsonSerializer.Serialize(state, JsonOptions);
    }

    private static FlowceanWorkspaceSummaryDto MapSummary(FlowceanWorkspace workspace)
        => new(workspace.Id, workspace.Slug, workspace.Name, workspace.Version, workspace.IsPersonal, workspace.CreatedAt, workspace.UpdatedAt);

    private static FlowceanWorkspaceDto Map(FlowceanWorkspace workspace)
        => new(workspace.Id, workspace.Slug, workspace.Name, workspace.Version, workspace.IsPersonal, workspace.DataJson, workspace.CreatedAt, workspace.UpdatedAt);
}
