using Erp.Application.Common;
using Erp.Domain.FutureModules;
using Microsoft.Extensions.Configuration;
using System.Security.Cryptography;
using System.Text;

namespace Erp.Infrastructure.Services;

internal static class PrestashopSecretProtector
{
    public static string ProtectSecret(IConfiguration configuration, string secret)
    {
        var key = GetEncryptionKey(configuration);
        var nonce = RandomNumberGenerator.GetBytes(12);
        var plaintext = Encoding.UTF8.GetBytes(secret);
        var ciphertext = new byte[plaintext.Length];
        var tag = new byte[16];

        using var aes = new AesGcm(key, tag.Length);
        aes.Encrypt(nonce, plaintext, ciphertext, tag);

        return string.Join('.',
            "v1",
            Convert.ToBase64String(nonce),
            Convert.ToBase64String(tag),
            Convert.ToBase64String(ciphertext));
    }

    public static Result<string> ResolveApiKey(IConfiguration configuration, PrestashopConnection connection)
    {
        if (!string.IsNullOrWhiteSpace(connection.ApiKeyProtectedValue))
        {
            return UnprotectSecret(configuration, connection.ApiKeyProtectedValue);
        }

        if (!string.IsNullOrWhiteSpace(connection.ApiKeySecretName))
        {
            var secret = configuration[$"Secrets:{connection.ApiKeySecretName}"];
            return string.IsNullOrWhiteSpace(secret)
                ? Result<string>.Failure("PrestaShop API key is not configured.")
                : Result<string>.Success(secret);
        }

        return Result<string>.Failure("PrestaShop API key is not configured.");
    }

    private static Result<string> UnprotectSecret(IConfiguration configuration, string protectedValue)
    {
        var parts = protectedValue.Split('.');
        if (parts.Length != 4 || parts[0] != "v1")
        {
            return Result<string>.Failure("Protected PrestaShop API key format is invalid.");
        }

        try
        {
            var key = GetEncryptionKey(configuration);
            var nonce = Convert.FromBase64String(parts[1]);
            var tag = Convert.FromBase64String(parts[2]);
            var ciphertext = Convert.FromBase64String(parts[3]);
            var plaintext = new byte[ciphertext.Length];

            using var aes = new AesGcm(key, tag.Length);
            aes.Decrypt(nonce, ciphertext, tag, plaintext);
            return Result<string>.Success(Encoding.UTF8.GetString(plaintext));
        }
        catch (CryptographicException)
        {
            return Result<string>.Failure("Protected PrestaShop API key cannot be decrypted. Check Secrets:EncryptionKey.");
        }
        catch (FormatException)
        {
            return Result<string>.Failure("Protected PrestaShop API key format is invalid.");
        }
    }

    private static byte[] GetEncryptionKey(IConfiguration configuration)
        => SHA256.HashData(Encoding.UTF8.GetBytes(configuration["Secrets:EncryptionKey"] ?? configuration["Jwt:SigningKey"] ?? "OceanERP-development-secret-key"));
}
