using Erp.Application.Common;
using Erp.Application.Prestashop;
using Erp.Domain.FutureModules;
using Erp.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using System.Net.Http.Headers;
using System.Text;
using System.Xml.Linq;

namespace Erp.Infrastructure.Services;

public sealed class PrestashopService(ErpDbContext db, IConfiguration configuration, IPrestashopSyncQueue queue, IHttpClientFactory httpClientFactory) : IPrestashopService
{
    private const string Provider = "PrestaShop";
    private const string CustomerThreadModule = "customer_threads";
    private const string CustomerMessageModule = "customer_messages";
    private const string DefaultPrestashopWarehouseName = "Entrepot principal";

    public async Task<IReadOnlyList<PrestashopConnectionDto>> GetConnectionsAsync(CancellationToken cancellationToken)
    {
        var connections = await db.PrestashopConnections.OrderBy(x => x.ShopUrl).ToListAsync(cancellationToken);
        return connections.Select(MapConnection).ToList();
    }

    public async Task<Result<PrestashopConnectionDto>> CreateConnectionAsync(CreatePrestashopConnectionRequest request, CancellationToken cancellationToken)
    {
        var validation = ValidateShopUrl(request.ShopUrl);
        if (!validation.Succeeded)
        {
            return Result<PrestashopConnectionDto>.Failure(validation.Error!);
        }

        var connection = new PrestashopConnection
        {
            ShopUrl = NormalizeShopUrl(request.ShopUrl),
            ColissimoLabelEndpointTemplate = NormalizeOptional(request.ColissimoLabelEndpointTemplate),
            IsActive = true,
            WarehouseId = request.WarehouseId ?? await GetOrCreateDefaultPrestashopWarehouseIdAsync(cancellationToken)
        };
        var warehouseValidation = await ValidateWarehouseAsync(connection.WarehouseId, cancellationToken);
        if (!warehouseValidation.Succeeded)
        {
            return Result<PrestashopConnectionDto>.Failure(warehouseValidation.Error!);
        }

        SetApiKey(connection, request.ApiKey, clearApiKey: false);
        SetProtectedSecret(
            value => connection.ColissimoBridgeTokenProtectedValue = value,
            request.ColissimoBridgeToken,
            clearSecret: false);
        db.PrestashopConnections.Add(connection);
        await db.SaveChangesAsync(cancellationToken);
        return Result<PrestashopConnectionDto>.Success(MapConnection(connection));
    }

    public async Task<Result<PrestashopConnectionDto>> UpdateConnectionAsync(Guid connectionId, UpdatePrestashopConnectionRequest request, CancellationToken cancellationToken)
    {
        var connection = await db.PrestashopConnections.FirstOrDefaultAsync(x => x.Id == connectionId, cancellationToken);
        if (connection is null)
        {
            return Result<PrestashopConnectionDto>.Failure("PrestaShop connection not found.");
        }

        var validation = ValidateShopUrl(request.ShopUrl);
        if (!validation.Succeeded)
        {
            return Result<PrestashopConnectionDto>.Failure(validation.Error!);
        }

        connection.ShopUrl = NormalizeShopUrl(request.ShopUrl);
        connection.ColissimoLabelEndpointTemplate = NormalizeOptional(request.ColissimoLabelEndpointTemplate);
        connection.IsActive = request.IsActive;
        connection.WarehouseId = request.WarehouseId ?? await GetOrCreateDefaultPrestashopWarehouseIdAsync(cancellationToken);
        var warehouseValidation = await ValidateWarehouseAsync(connection.WarehouseId, cancellationToken);
        if (!warehouseValidation.Succeeded)
        {
            return Result<PrestashopConnectionDto>.Failure(warehouseValidation.Error!);
        }

        SetApiKey(connection, request.ApiKey, request.ClearApiKey);
        SetProtectedSecret(
            value => connection.ColissimoBridgeTokenProtectedValue = value,
            request.ColissimoBridgeToken,
            request.ClearColissimoBridgeToken);

        await db.SaveChangesAsync(cancellationToken);
        return Result<PrestashopConnectionDto>.Success(MapConnection(connection));
    }

    public async Task<IReadOnlyList<PrestashopSyncLogDto>> GetLogsAsync(CancellationToken cancellationToken)
        => await db.PrestashopSyncLogs.OrderByDescending(x => x.CreatedAt).Take(100)
            .Select(x => new PrestashopSyncLogDto(x.Id, x.PrestashopConnectionId, x.Status, x.Message, x.CreatedAt, x.StartedAt, x.CompletedAt))
            .ToListAsync(cancellationToken);

    public async Task<Result<PrestashopSyncLogDto>> RunManualSyncAsync(Guid connectionId, CancellationToken cancellationToken)
    {
        var connection = await db.PrestashopConnections.FirstOrDefaultAsync(x => x.Id == connectionId, cancellationToken);
        if (connection is null)
        {
            return Result<PrestashopSyncLogDto>.Failure("PrestaShop connection not found.");
        }
        if (!connection.IsActive)
        {
            return Result<PrestashopSyncLogDto>.Failure("PrestaShop connection is inactive.");
        }
        if (!HasApiKey(connection))
        {
            return Result<PrestashopSyncLogDto>.Failure("PrestaShop API key is not configured.");
        }

        var log = new PrestashopSyncLog
        {
            PrestashopConnectionId = connectionId,
            Status = "Queued",
            Message = "Synchronisation ajoutee a la file."
        };
        db.PrestashopSyncLogs.Add(log);
        await db.SaveChangesAsync(cancellationToken);
        await queue.EnqueueAsync(log.Id, cancellationToken);
        return Result<PrestashopSyncLogDto>.Success(MapLog(log));
    }

    public async Task<Result<string?>> PublishServiceTicketMessageAsync(Guid serviceTicketId, string body, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(body))
        {
            return Result<string?>.Failure("Message SAV obligatoire.");
        }

        var threadReference = await db.ExternalReferences.FirstOrDefaultAsync(
            x => x.Provider == Provider && x.Module == CustomerThreadModule && x.EntityId == serviceTicketId,
            cancellationToken);
        if (threadReference is null)
        {
            return Result<string?>.Success(null);
        }

        var threadExternalId = ExtractPrestashopId(threadReference, CustomerThreadModule);
        if (string.IsNullOrWhiteSpace(threadExternalId))
        {
            return Result<string?>.Failure("Reference PrestaShop SAV invalide.");
        }

        var connection = await db.PrestashopConnections
            .Where(x => x.IsActive)
            .OrderByDescending(x => x.UpdatedAt ?? x.CreatedAt)
            .FirstOrDefaultAsync(cancellationToken);
        if (connection is null)
        {
            return Result<string?>.Failure("Aucune connexion PrestaShop active n'est configuree.");
        }

        var apiKeyResult = PrestashopSecretProtector.ResolveApiKey(configuration, connection);
        if (!apiKeyResult.Succeeded)
        {
            return Result<string?>.Failure(apiKeyResult.Error ?? "Cle API PrestaShop non configuree.");
        }

        try
        {
            var externalMessageId = await PostCustomerMessageAsync(
                GetApiBaseUrl(connection.ShopUrl),
                threadExternalId,
                apiKeyResult.Value!,
                body.Trim(),
                cancellationToken);
            return Result<string?>.Success(externalMessageId);
        }
        catch (OperationCanceledException)
        {
            throw;
        }
        catch (Exception ex)
        {
            return Result<string?>.Failure($"Envoi PrestaShop SAV impossible: {TrimDetail(FullExceptionMessage(ex))}");
        }
    }

    public async Task<Result> CloseServiceTicketThreadAsync(Guid serviceTicketId, CancellationToken cancellationToken)
    {
        var threadReference = await db.ExternalReferences.FirstOrDefaultAsync(
            x => x.Provider == Provider && x.Module == CustomerThreadModule && x.EntityId == serviceTicketId,
            cancellationToken);
        if (threadReference is null)
        {
            return Result.Success();
        }

        var threadExternalId = ExtractPrestashopId(threadReference, CustomerThreadModule);
        if (string.IsNullOrWhiteSpace(threadExternalId))
        {
            return Result.Failure("Reference PrestaShop SAV invalide.");
        }

        var connection = await db.PrestashopConnections
            .Where(x => x.IsActive)
            .OrderByDescending(x => x.UpdatedAt ?? x.CreatedAt)
            .FirstOrDefaultAsync(cancellationToken);
        if (connection is null)
        {
            return Result.Failure("Aucune connexion PrestaShop active n'est configuree.");
        }

        var apiKeyResult = PrestashopSecretProtector.ResolveApiKey(configuration, connection);
        if (!apiKeyResult.Succeeded)
        {
            return Result.Failure(apiKeyResult.Error ?? "Cle API PrestaShop non configuree.");
        }

        try
        {
            await PutCustomerThreadStatusAsync(
                GetApiBaseUrl(connection.ShopUrl),
                threadExternalId,
                apiKeyResult.Value!,
                "closed",
                cancellationToken);
            return Result.Success();
        }
        catch (OperationCanceledException)
        {
            throw;
        }
        catch (Exception ex)
        {
            return Result.Failure($"Fermeture PrestaShop SAV impossible: {TrimDetail(FullExceptionMessage(ex))}");
        }
    }

    private async Task<string?> PostCustomerMessageAsync(string apiBaseUrl, string threadExternalId, string apiKey, string body, CancellationToken cancellationToken)
    {
        var document = await GetCustomerMessageSchemaAsync(apiBaseUrl, apiKey, cancellationToken);
        var messageElement = document.Root?.Element("customer_message") ?? document.Descendants("customer_message").FirstOrDefault();
        if (messageElement is null)
        {
            throw new InvalidOperationException("Schema PrestaShop customer_messages invalide.");
        }

        RemoveElements(messageElement, "id", "date_add", "date_upd");
        SetElementValue(messageElement, "id_customer_thread", threadExternalId);
        SetElementValue(messageElement, "id_employee", await ResolveEmployeeIdAsync(apiBaseUrl, threadExternalId, apiKey, cancellationToken));
        SetElementValue(messageElement, "message", body);
        SetElementValue(messageElement, "private", "0");
        SetElementValue(messageElement, "read", "0");

        var httpClient = httpClientFactory.CreateClient(nameof(PrestashopService));
        using var request = new HttpRequestMessage(HttpMethod.Post, $"{apiBaseUrl}/{CustomerMessageModule}");
        AddPrestashopHeaders(request, apiKey, "application/xml");
        request.Content = new StringContent(document.ToString(SaveOptions.DisableFormatting), Encoding.UTF8, "application/xml");

        using var response = await httpClient.SendAsync(request, cancellationToken);
        var responseBody = await response.Content.ReadAsStringAsync(cancellationToken);
        if (!response.IsSuccessStatusCode)
        {
            throw new InvalidOperationException($"POST message SAV PrestaShop HTTP {(int)response.StatusCode} {TrimDetail(responseBody)}");
        }

        if (string.IsNullOrWhiteSpace(responseBody))
        {
            return null;
        }

        var responseDocument = XDocument.Parse(responseBody);
        return (responseDocument.Root?.Element("customer_message") ?? responseDocument.Descendants("customer_message").FirstOrDefault())
            ?.Element("id")
            ?.Value
            ?.Trim();
    }

    private async Task PutCustomerThreadStatusAsync(string apiBaseUrl, string threadExternalId, string apiKey, string status, CancellationToken cancellationToken)
    {
        var document = await GetPrestashopXmlAsync($"{apiBaseUrl}/{CustomerThreadModule}/{threadExternalId}?display=full&output_format=XML", "fil SAV", apiKey, cancellationToken);
        var existingThread = document.Root?.Element("customer_thread") ?? document.Descendants("customer_thread").FirstOrDefault();
        if (existingThread is null)
        {
            throw new InvalidOperationException("Fil SAV PrestaShop introuvable.");
        }

        var threadElement = new XElement("customer_thread");
        foreach (var fieldName in new[] { "id", "id_lang", "id_shop", "id_customer", "id_order", "id_product", "id_contact", "email", "token", "status" })
        {
            var value = string.Equals(fieldName, "status", StringComparison.OrdinalIgnoreCase)
                ? status
                : existingThread.Element(fieldName)?.Value?.Trim() ?? string.Empty;
            threadElement.Add(new XElement(fieldName, value));
        }

        var payload = new XDocument(new XElement("prestashop", threadElement));
        var httpClient = httpClientFactory.CreateClient(nameof(PrestashopService));
        using var request = new HttpRequestMessage(HttpMethod.Put, $"{apiBaseUrl}/{CustomerThreadModule}/{threadExternalId}");
        AddPrestashopHeaders(request, apiKey, "application/xml");
        request.Content = new StringContent(payload.ToString(SaveOptions.DisableFormatting), Encoding.UTF8, "application/xml");

        using var response = await httpClient.SendAsync(request, cancellationToken);
        var responseBody = await response.Content.ReadAsStringAsync(cancellationToken);
        if (!response.IsSuccessStatusCode)
        {
            throw new InvalidOperationException($"PUT fil SAV PrestaShop HTTP {(int)response.StatusCode} {TrimDetail(responseBody)}");
        }
    }

    private async Task<XDocument> GetCustomerMessageSchemaAsync(string apiBaseUrl, string apiKey, CancellationToken cancellationToken)
    {
        var httpClient = httpClientFactory.CreateClient(nameof(PrestashopService));
        using var request = new HttpRequestMessage(HttpMethod.Get, $"{apiBaseUrl}/{CustomerMessageModule}?schema=blank&output_format=XML");
        AddPrestashopHeaders(request, apiKey, "application/xml");

        using var response = await httpClient.SendAsync(request, cancellationToken);
        var body = await response.Content.ReadAsStringAsync(cancellationToken);
        if (response.IsSuccessStatusCode && !string.IsNullOrWhiteSpace(body))
        {
            return XDocument.Parse(body, LoadOptions.PreserveWhitespace);
        }

        return new XDocument(
            new XElement("prestashop",
                new XElement("customer_message",
                    new XElement("id_customer_thread"),
                    new XElement("id_employee"),
                    new XElement("message"),
                    new XElement("private"),
                    new XElement("read"))));
    }

    private async Task<string> ResolveEmployeeIdAsync(string apiBaseUrl, string threadExternalId, string apiKey, CancellationToken cancellationToken)
    {
        try
        {
            var document = await GetPrestashopXmlAsync($"{apiBaseUrl}/{CustomerThreadModule}/{threadExternalId}?display=full&output_format=XML", "fil SAV", apiKey, cancellationToken);
            var threadElement = document.Root?.Element("customer_thread") ?? document.Descendants("customer_thread").FirstOrDefault();
            var employeeId = threadElement?.Element("id_employee")?.Value?.Trim();
            return !string.IsNullOrWhiteSpace(employeeId) && employeeId is not "0" ? employeeId : "1";
        }
        catch
        {
            return "1";
        }
    }

    private async Task<XDocument> GetPrestashopXmlAsync(string url, string label, string apiKey, CancellationToken cancellationToken)
    {
        var httpClient = httpClientFactory.CreateClient(nameof(PrestashopService));
        using var request = new HttpRequestMessage(HttpMethod.Get, url);
        AddPrestashopHeaders(request, apiKey, "application/xml");

        using var response = await httpClient.SendAsync(request, cancellationToken);
        var body = await response.Content.ReadAsStringAsync(cancellationToken);
        if (!response.IsSuccessStatusCode)
        {
            throw new InvalidOperationException($"GET {label} PrestaShop HTTP {(int)response.StatusCode} {TrimDetail(body)}");
        }

        return XDocument.Parse(body, LoadOptions.PreserveWhitespace);
    }

    private static Result ValidateShopUrl(string shopUrl)
    {
        if (string.IsNullOrWhiteSpace(shopUrl))
        {
            return Result.Failure("Shop URL is required.");
        }

        if (!Uri.TryCreate(shopUrl.Trim(), UriKind.Absolute, out var uri) || (uri.Scheme != Uri.UriSchemeHttp && uri.Scheme != Uri.UriSchemeHttps))
        {
            return Result.Failure("Shop URL must be a valid HTTP or HTTPS URL.");
        }

        return Result.Success();
    }

    private static string NormalizeShopUrl(string shopUrl)
    {
        var normalized = shopUrl.Trim().TrimEnd('/');
        return normalized.EndsWith("/api", StringComparison.OrdinalIgnoreCase)
            ? normalized[..^4]
            : normalized;
    }

    private async Task<Result> ValidateWarehouseAsync(Guid? warehouseId, CancellationToken cancellationToken)
    {
        if (!warehouseId.HasValue)
        {
            return Result.Success();
        }

        if (db.Warehouses.Local.Any(x => x.Id == warehouseId.Value))
        {
            return Result.Success();
        }

        return await db.Warehouses.AnyAsync(x => x.Id == warehouseId.Value, cancellationToken)
            ? Result.Success()
            : Result.Failure("Warehouse not found.");
    }

    private async Task<Guid> GetOrCreateDefaultPrestashopWarehouseIdAsync(CancellationToken cancellationToken)
    {
        var warehouse = await db.Warehouses.FirstOrDefaultAsync(x => x.Name == DefaultPrestashopWarehouseName, cancellationToken);
        if (warehouse is null)
        {
            warehouse = new Warehouse { Name = DefaultPrestashopWarehouseName };
            db.Warehouses.Add(warehouse);
        }

        return warehouse.Id;
    }

    private void SetApiKey(PrestashopConnection connection, string? apiKey, bool clearApiKey)
    {
        if (clearApiKey)
        {
            connection.ApiKeyProtectedValue = null;
            connection.ApiKeySecretName = string.Empty;
            return;
        }

        if (string.IsNullOrWhiteSpace(apiKey))
        {
            return;
        }

        connection.ApiKeyProtectedValue = PrestashopSecretProtector.ProtectSecret(configuration, apiKey.Trim());
        connection.ApiKeySecretName = "DATABASE_PROTECTED";
    }

    private void SetProtectedSecret(Action<string?> assignProtectedValue, string? secret, bool clearSecret)
    {
        if (clearSecret)
        {
            assignProtectedValue(null);
            return;
        }

        if (string.IsNullOrWhiteSpace(secret))
        {
            return;
        }

        assignProtectedValue(PrestashopSecretProtector.ProtectSecret(configuration, secret.Trim()));
    }

    private static string? NormalizeOptional(string? value)
        => string.IsNullOrWhiteSpace(value) ? null : value.Trim();

    private static bool HasApiKey(PrestashopConnection connection)
        => !string.IsNullOrWhiteSpace(connection.ApiKeyProtectedValue) || !string.IsNullOrWhiteSpace(connection.ApiKeySecretName);

    private static bool HasColissimoBridgeToken(PrestashopConnection connection)
        => !string.IsNullOrWhiteSpace(connection.ColissimoBridgeTokenProtectedValue);

    private static string? ExtractPrestashopId(ExternalReference externalReference, string module)
    {
        var prefix = $"{module}:";
        return externalReference.ExternalId.StartsWith(prefix, StringComparison.OrdinalIgnoreCase)
            ? externalReference.ExternalId[prefix.Length..]
            : externalReference.ExternalId;
    }

    private static string GetApiBaseUrl(string shopUrl)
    {
        var normalized = shopUrl.Trim().TrimEnd('/');
        return normalized.EndsWith("/api", StringComparison.OrdinalIgnoreCase)
            ? normalized
            : $"{normalized}/api";
    }

    private static void RemoveElements(XElement element, params string[] names)
    {
        var remove = names.ToHashSet(StringComparer.OrdinalIgnoreCase);
        foreach (var child in element.Elements().Where(x => remove.Contains(x.Name.LocalName)).ToList())
        {
            child.Remove();
        }
    }

    private static void SetElementValue(XElement parent, string name, string value)
    {
        var element = parent.Element(name);
        if (element is null)
        {
            element = new XElement(name);
            parent.Add(element);
        }

        element.Value = value;
    }

    private static void AddPrestashopHeaders(HttpRequestMessage request, string apiKey, string accept)
    {
        request.Headers.Authorization = new AuthenticationHeaderValue(
            "Basic",
            Convert.ToBase64String(Encoding.ASCII.GetBytes($"{apiKey}:")));
        request.Headers.Accept.Add(new MediaTypeWithQualityHeaderValue(accept));
    }

    private static string TrimDetail(string detail)
        => detail.ReplaceLineEndings(" ").Length > 500 ? detail.ReplaceLineEndings(" ")[..500] : detail.ReplaceLineEndings(" ");

    private static string FullExceptionMessage(Exception exception)
    {
        var messages = new List<string>();
        for (var current = exception; current is not null; current = current.InnerException)
        {
            if (!string.IsNullOrWhiteSpace(current.Message))
            {
                messages.Add(current.Message);
            }
        }

        return string.Join(" | ", messages.Distinct());
    }

    private static PrestashopConnectionDto MapConnection(PrestashopConnection connection)
        => new(
            connection.Id,
            connection.ShopUrl,
            connection.ApiKeySecretName,
            HasApiKey(connection),
            connection.IsActive,
            connection.WarehouseId,
            connection.ColissimoLabelEndpointTemplate,
            HasColissimoBridgeToken(connection));

    private static PrestashopSyncLogDto MapLog(PrestashopSyncLog log)
        => new(log.Id, log.PrestashopConnectionId, log.Status, log.Message, log.CreatedAt, log.StartedAt, log.CompletedAt);
}
