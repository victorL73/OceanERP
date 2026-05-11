using Erp.Domain.FutureModules;
using Erp.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using System.Net.Http.Headers;
using System.Text;

namespace Erp.Infrastructure.Services;

internal sealed class PrestashopSyncExecutor(ErpDbContext db, IConfiguration configuration, HttpClient httpClient)
{
    private static readonly string[] ProbeResources = ["products", "customers", "orders", "stock_availables"];

    public async Task ExecuteAsync(Guid syncLogId, CancellationToken cancellationToken)
    {
        var log = await db.PrestashopSyncLogs.FirstOrDefaultAsync(x => x.Id == syncLogId, cancellationToken);
        if (log is null || log.Status is "Completed" or "Failed")
        {
            return;
        }

        var connection = await db.PrestashopConnections.FirstOrDefaultAsync(x => x.Id == log.PrestashopConnectionId, cancellationToken);
        if (connection is null)
        {
            await FailAsync(log, "PrestaShop connection not found.", cancellationToken);
            return;
        }

        if (!connection.IsActive)
        {
            await FailAsync(log, "PrestaShop connection is inactive.", cancellationToken);
            return;
        }

        var apiKeyResult = PrestashopSecretProtector.ResolveApiKey(configuration, connection);
        if (!apiKeyResult.Succeeded)
        {
            await FailAsync(log, apiKeyResult.Error ?? "PrestaShop API key is not configured.", cancellationToken);
            return;
        }

        log.Status = "Running";
        log.Message = "Connexion a PrestaShop en cours.";
        log.StartedAt ??= DateTimeOffset.UtcNow;
        log.CompletedAt = null;
        await db.SaveChangesAsync(cancellationToken);

        try
        {
            var message = await ProbePrestashopAsync(connection, apiKeyResult.Value!, cancellationToken);
            log.Status = "Completed";
            log.Message = message;
        }
        catch (OperationCanceledException) when (!cancellationToken.IsCancellationRequested)
        {
            log.Status = "Failed";
            log.Message = "Synchronisation interrompue ou delai depasse.";
        }
        catch (Exception ex)
        {
            log.Status = "Failed";
            log.Message = ex.Message.Length > 1000 ? ex.Message[..1000] : ex.Message;
        }

        log.CompletedAt = DateTimeOffset.UtcNow;
        await db.SaveChangesAsync(cancellationToken);
    }

    private async Task<string> ProbePrestashopAsync(PrestashopConnection connection, string apiKey, CancellationToken cancellationToken)
    {
        httpClient.Timeout = TimeSpan.FromSeconds(20);
        httpClient.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue(
            "Basic",
            Convert.ToBase64String(Encoding.ASCII.GetBytes($"{apiKey}:")));

        await EnsureSuccessfulPrestashopRequestAsync($"{connection.ShopUrl}/api?output_format=JSON", "racine API", cancellationToken);

        var resourceStatuses = new List<string>();
        foreach (var resource in ProbeResources)
        {
            await EnsureSuccessfulPrestashopRequestAsync($"{connection.ShopUrl}/api/{resource}?display=[id]&limit=1&output_format=JSON", resource, cancellationToken);
            resourceStatuses.Add($"{resource}: OK");
        }

        return $"Connexion PrestaShop OK. {string.Join("; ", resourceStatuses)}.";
    }

    private async Task EnsureSuccessfulPrestashopRequestAsync(string url, string label, CancellationToken cancellationToken)
    {
        using var request = new HttpRequestMessage(HttpMethod.Get, url);
        request.Headers.Accept.Add(new MediaTypeWithQualityHeaderValue("application/json"));

        using var response = await httpClient.SendAsync(request, cancellationToken);
        if (response.IsSuccessStatusCode)
        {
            return;
        }

        var body = await response.Content.ReadAsStringAsync(cancellationToken);
        var detail = string.IsNullOrWhiteSpace(body) ? response.ReasonPhrase ?? response.StatusCode.ToString() : body.ReplaceLineEndings(" ");
        if (detail.Length > 240)
        {
            detail = detail[..240];
        }

        throw new InvalidOperationException($"PrestaShop {label}: HTTP {(int)response.StatusCode} {detail}");
    }

    private async Task FailAsync(PrestashopSyncLog log, string message, CancellationToken cancellationToken)
    {
        log.Status = "Failed";
        log.Message = message;
        log.StartedAt ??= DateTimeOffset.UtcNow;
        log.CompletedAt = DateTimeOffset.UtcNow;
        await db.SaveChangesAsync(cancellationToken);
    }
}
