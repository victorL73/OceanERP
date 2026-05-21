using System.Security.Cryptography;
using System.Text;
using Erp.Application.Ai;
using Erp.Application.Common;
using Erp.Domain.FutureModules;
using Erp.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;

namespace Erp.Infrastructure.Services;

public sealed class AiSettingsService(ErpDbContext db, ICurrentUserService currentUser, IConfiguration configuration) : IAiSettingsService
{
    public async Task<AiSettingsDto> GetAsync(CancellationToken cancellationToken)
    {
        var settings = await LoadSettingsAsync(cancellationToken);
        return Map(settings);
    }

    public async Task<Result<AiRuntimeSettings>> GetRuntimeAsync(CancellationToken cancellationToken)
    {
        var settings = await LoadSettingsAsync(cancellationToken);
        var apiKeyResult = ResolveApiKey(settings);
        if (!apiKeyResult.Succeeded)
        {
            return Result<AiRuntimeSettings>.Failure(apiKeyResult.Error ?? "Cle IA indisponible.");
        }

        return Result<AiRuntimeSettings>.Success(new AiRuntimeSettings(
            settings.IsEnabled,
            settings.Provider,
            settings.EndpointUrl,
            settings.Model,
            apiKeyResult.Value ?? string.Empty,
            settings.Temperature,
            settings.MaxTokens,
            settings.SystemPrompt));
    }

    public async Task<Result<AiSettingsDto>> UpdateAsync(UpdateAiSettingsRequest request, CancellationToken cancellationToken)
    {
        if (!await IsAdministratorAsync(cancellationToken))
        {
            return Result<AiSettingsDto>.Failure("Seul un administrateur peut modifier les parametres IA.");
        }

        var provider = NormalizeRequired(request.Provider, 80).ToLowerInvariant();
        if (provider != "groq")
        {
            return Result<AiSettingsDto>.Failure("Le fournisseur IA supporte est Groq.");
        }

        var endpointUrl = NormalizeRequired(request.EndpointUrl, 500);
        if (!Uri.TryCreate(endpointUrl, UriKind.Absolute, out var endpoint) || endpoint.Scheme is not ("http" or "https"))
        {
            return Result<AiSettingsDto>.Failure("L'URL d'API Groq doit etre une URL http(s) valide.");
        }

        var model = NormalizeRequired(request.Model, 160);
        if (string.IsNullOrWhiteSpace(model))
        {
            return Result<AiSettingsDto>.Failure("Le modele Groq est obligatoire.");
        }

        if (request.Temperature is < 0 or > 2)
        {
            return Result<AiSettingsDto>.Failure("La temperature doit etre comprise entre 0 et 2.");
        }

        if (request.MaxTokens is < 1 or > 32768)
        {
            return Result<AiSettingsDto>.Failure("Le nombre de tokens doit etre compris entre 1 et 32768.");
        }

        var settings = await LoadSettingsAsync(cancellationToken);
        settings.IsEnabled = request.IsEnabled;
        settings.Provider = provider;
        settings.EndpointUrl = endpointUrl;
        settings.Model = model;
        settings.ApiKeySecretName = Normalize(request.ApiKeySecretName, 160) ?? "GROQ_API_KEY";
        settings.Temperature = request.Temperature;
        settings.MaxTokens = request.MaxTokens;
        settings.SystemPrompt = Normalize(request.SystemPrompt, 8000);

        if (request.ClearApiKey)
        {
            settings.ApiKeyProtectedValue = null;
        }
        else if (!string.IsNullOrWhiteSpace(request.ApiKey))
        {
            settings.ApiKeyProtectedValue = ProtectSecret(request.ApiKey.Trim());
        }

        await db.SaveChangesAsync(cancellationToken);
        return Result<AiSettingsDto>.Success(Map(settings));
    }

    private async Task<AiSettings> LoadSettingsAsync(CancellationToken cancellationToken)
    {
        var settings = await db.AiSettings.OrderBy(x => x.CreatedAt).FirstOrDefaultAsync(cancellationToken);
        if (settings is not null)
        {
            return settings;
        }

        settings = new AiSettings();
        db.AiSettings.Add(settings);
        await db.SaveChangesAsync(cancellationToken);
        return settings;
    }

    private AiSettingsDto Map(AiSettings settings) => new(
        settings.Id,
        settings.IsEnabled,
        settings.Provider,
        settings.EndpointUrl,
        settings.Model,
        settings.ApiKeySecretName,
        !string.IsNullOrWhiteSpace(settings.ApiKeyProtectedValue) || HasExternalSecret(settings),
        settings.Temperature,
        settings.MaxTokens,
        settings.SystemPrompt,
        settings.UpdatedAt);

    private bool HasExternalSecret(AiSettings settings)
    {
        var name = settings.ApiKeySecretName;
        return !string.IsNullOrWhiteSpace(name)
            && (!string.IsNullOrWhiteSpace(configuration[$"Secrets:{name}"])
                || !string.IsNullOrWhiteSpace(configuration[name]));
    }

    private Result<string> ResolveApiKey(AiSettings settings)
    {
        if (!string.IsNullOrWhiteSpace(settings.ApiKeyProtectedValue))
        {
            if (settings.ApiKeyProtectedValue.Contains('.'))
            {
                return ProtectedSecretProtector.Unprotect(configuration, settings.ApiKeyProtectedValue, "Cle IA Groq");
            }

            return UnprotectLegacySecret(settings.ApiKeyProtectedValue);
        }

        var name = settings.ApiKeySecretName;
        if (!string.IsNullOrWhiteSpace(name))
        {
            var externalSecret = configuration[$"Secrets:{name}"] ?? configuration[name];
            if (!string.IsNullOrWhiteSpace(externalSecret))
            {
                return Result<string>.Success(externalSecret.Trim());
            }
        }

        return Result<string>.Success(string.Empty);
    }

    private string ProtectSecret(string secret)
    {
        using var sha = SHA256.Create();
        var seed = configuration["Secrets:EncryptionKey"]
            ?? configuration["SECRETS_ENCRYPTION_KEY"]
            ?? configuration["JWT_SIGNING_KEY"]
            ?? configuration["Jwt:SigningKey"]
            ?? "oceanerp-local-development-secret";
        var key = sha.ComputeHash(Encoding.UTF8.GetBytes(seed));
        var nonce = RandomNumberGenerator.GetBytes(12);
        var plain = Encoding.UTF8.GetBytes(secret);
        var cipher = new byte[plain.Length];
        var tag = new byte[16];

#pragma warning disable SYSLIB0053
        using var aes = new AesGcm(key);
#pragma warning restore SYSLIB0053
        aes.Encrypt(nonce, plain, cipher, tag);
        return $"v1:{Convert.ToBase64String(nonce)}:{Convert.ToBase64String(tag)}:{Convert.ToBase64String(cipher)}";
    }

    private Result<string> UnprotectLegacySecret(string protectedValue)
    {
        var parts = protectedValue.Split(':');
        if (parts.Length != 4 || parts[0] != "v1")
        {
            return Result<string>.Failure("Cle IA Groq protegee: format invalide.");
        }

        try
        {
            using var sha = SHA256.Create();
            var seed = configuration["Secrets:EncryptionKey"]
                ?? configuration["SECRETS_ENCRYPTION_KEY"]
                ?? configuration["JWT_SIGNING_KEY"]
                ?? configuration["Jwt:SigningKey"]
                ?? "oceanerp-local-development-secret";
            var key = sha.ComputeHash(Encoding.UTF8.GetBytes(seed));
            var nonce = Convert.FromBase64String(parts[1]);
            var tag = Convert.FromBase64String(parts[2]);
            var cipher = Convert.FromBase64String(parts[3]);
            var plain = new byte[cipher.Length];

#pragma warning disable SYSLIB0053
            using var aes = new AesGcm(key);
#pragma warning restore SYSLIB0053
            aes.Decrypt(nonce, cipher, tag, plain);
            return Result<string>.Success(Encoding.UTF8.GetString(plain));
        }
        catch (CryptographicException)
        {
            return Result<string>.Failure("Cle IA Groq protegee: dechiffrement impossible. Verifiez Secrets:EncryptionKey.");
        }
        catch (FormatException)
        {
            return Result<string>.Failure("Cle IA Groq protegee: format invalide.");
        }
    }

    private async Task<bool> IsAdministratorAsync(CancellationToken cancellationToken)
        => currentUser.UserId is { } userId
            && await db.UserRoles
                .AnyAsync(userRole => userRole.UserId == userId && db.Roles.Any(role => role.Id == userRole.RoleId && role.Name == "Administrator"), cancellationToken);

    private static string NormalizeRequired(string value, int maxLength)
    {
        var trimmed = (value ?? string.Empty).Trim();
        return trimmed.Length <= maxLength ? trimmed : trimmed[..maxLength];
    }

    private static string? Normalize(string? value, int maxLength)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            return null;
        }

        var trimmed = value.Trim();
        return trimmed.Length <= maxLength ? trimmed : trimmed[..maxLength];
    }
}
