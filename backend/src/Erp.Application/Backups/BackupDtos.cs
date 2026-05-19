using Erp.Application.Common;

namespace Erp.Application.Backups;

public sealed record BackupArchiveDto(
    string Name,
    string Path,
    DateTimeOffset CreatedAt,
    long PostgresSizeBytes,
    long DocumentsSizeBytes,
    long TotalSizeBytes,
    bool HasPostgresDump,
    bool HasDocumentsArchive);

public sealed record BackupOperationResultDto(
    bool Succeeded,
    string Message,
    string? BackupName,
    string Output,
    DateTimeOffset CompletedAt);

public interface IBackupService
{
    Task<IReadOnlyList<BackupArchiveDto>> GetBackupsAsync(CancellationToken cancellationToken);
    Task<Result<BackupOperationResultDto>> CreateBackupAsync(CancellationToken cancellationToken);
    Task<Result<BackupOperationResultDto>> RestoreBackupAsync(string backupName, CancellationToken cancellationToken);
}
