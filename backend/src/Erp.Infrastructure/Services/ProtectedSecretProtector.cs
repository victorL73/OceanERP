using Erp.Application.Common;
using Microsoft.Extensions.Configuration;
using System.Security.Cryptography;
using System.Text;

namespace Erp.Infrastructure.Services;

internal static class ProtectedSecretProtector
{
    public static string Protect(IConfiguration configuration, string secret)
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

    public static Result<string> Unprotect(IConfiguration configuration, string protectedValue, string label)
    {
        var parts = protectedValue.Split('.');
        if (parts.Length != 4 || parts[0] != "v1")
        {
            return Result<string>.Failure($"{label} protege: format invalide.");
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
            return Result<string>.Failure($"{label} protege: dechiffrement impossible. Verifiez Secrets:EncryptionKey.");
        }
        catch (FormatException)
        {
            return Result<string>.Failure($"{label} protege: format invalide.");
        }
    }

    private static byte[] GetEncryptionKey(IConfiguration configuration)
        => SHA256.HashData(Encoding.UTF8.GetBytes(configuration["Secrets:EncryptionKey"] ?? configuration["Jwt:SigningKey"] ?? "OceanERP-development-secret-key"));
}
