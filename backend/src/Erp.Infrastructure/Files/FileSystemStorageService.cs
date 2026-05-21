using System.Security.Cryptography;
using Erp.Application.Documents;
using Microsoft.Extensions.Options;

namespace Erp.Infrastructure.Files;

public sealed class FileSystemStorageService(IOptions<FileStorageOptions> options) : IFileStorageService
{
    private readonly string _rootPath = Path.GetFullPath(options.Value.RootPath);

    public async Task<StoredFile> SaveAsync(string area, string fileName, Stream content, CancellationToken cancellationToken)
    {
        Directory.CreateDirectory(_rootPath);

        var safeArea = SanitizeSegment(area);
        var extension = Path.GetExtension(fileName);
        var relativeDirectory = Path.Combine(safeArea, DateTime.UtcNow.ToString("yyyy"), DateTime.UtcNow.ToString("MM"));
        var absoluteDirectory = Path.Combine(_rootPath, relativeDirectory);
        Directory.CreateDirectory(absoluteDirectory);

        var storedFileName = $"{Guid.NewGuid():N}{extension}";
        var absolutePath = Path.Combine(absoluteDirectory, storedFileName);

        await using var target = File.Create(absolutePath);
        using var sha = SHA256.Create();
        await using var hashing = new CryptoStream(target, sha, CryptoStreamMode.Write);
        await content.CopyToAsync(hashing, cancellationToken);
        hashing.FlushFinalBlock();

        var relativePath = Path.Combine(relativeDirectory, storedFileName).Replace('\\', '/');
        return new StoredFile(relativePath, new FileInfo(absolutePath).Length, Convert.ToHexString(sha.Hash ?? []));
    }

    public async Task<StoredFile> OverwriteAsync(string storagePath, Stream content, CancellationToken cancellationToken)
    {
        var absolutePath = GetSafeAbsolutePath(storagePath);
        var directory = Path.GetDirectoryName(absolutePath);
        if (string.IsNullOrWhiteSpace(directory))
        {
            throw new InvalidOperationException("Invalid storage path.");
        }

        Directory.CreateDirectory(directory);
        var temporaryPath = Path.Combine(directory, $"{Path.GetFileName(absolutePath)}.{Guid.NewGuid():N}.tmp");

        try
        {
            byte[]? hash;
            await using (var target = File.Create(temporaryPath))
            {
                using var sha = SHA256.Create();
                await using var hashing = new CryptoStream(target, sha, CryptoStreamMode.Write);
                await content.CopyToAsync(hashing, cancellationToken);
                hashing.FlushFinalBlock();
                hash = sha.Hash;
            }

            File.Move(temporaryPath, absolutePath, overwrite: true);

            return new StoredFile(storagePath.Replace('\\', '/'), new FileInfo(absolutePath).Length, Convert.ToHexString(hash ?? []));
        }
        catch
        {
            if (File.Exists(temporaryPath))
            {
                File.Delete(temporaryPath);
            }

            throw;
        }
    }

    public Task<Stream> OpenReadAsync(string storagePath, CancellationToken cancellationToken)
    {
        var absolutePath = GetSafeAbsolutePath(storagePath);
        Stream stream = File.OpenRead(absolutePath);
        return Task.FromResult(stream);
    }

    public Task DeleteAsync(string storagePath, CancellationToken cancellationToken)
    {
        var absolutePath = GetSafeAbsolutePath(storagePath);
        if (File.Exists(absolutePath))
        {
            File.Delete(absolutePath);
        }

        return Task.CompletedTask;
    }

    private string GetSafeAbsolutePath(string storagePath)
    {
        var absolutePath = Path.GetFullPath(Path.Combine(_rootPath, storagePath));
        if (!absolutePath.StartsWith(_rootPath, StringComparison.OrdinalIgnoreCase))
        {
            throw new InvalidOperationException("Invalid storage path.");
        }

        return absolutePath;
    }

    private static string SanitizeSegment(string value)
    {
        var invalid = Path.GetInvalidFileNameChars();
        return string.Concat(value.Select(c => invalid.Contains(c) ? '-' : c));
    }
}
