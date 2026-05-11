namespace Erp.Application.Documents;

public interface IFileStorageService
{
    Task<StoredFile> SaveAsync(string area, string fileName, Stream content, CancellationToken cancellationToken);
    Task<Stream> OpenReadAsync(string storagePath, CancellationToken cancellationToken);
    Task DeleteAsync(string storagePath, CancellationToken cancellationToken);
}

public sealed record StoredFile(string StoragePath, long Size, string Sha256);

