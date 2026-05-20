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

public sealed record BackupDownloadDto(
    string FileName,
    string ContentType,
    Stream Content);

public sealed record BackupScheduleDto(
    bool Enabled,
    int IntervalHours,
    DateTimeOffset? LastRunAt,
    DateTimeOffset? NextRunAt);

public sealed record UpdateBackupScheduleRequest(
    bool Enabled,
    int IntervalHours);

public sealed record BackupRemoteStorageDto(
    bool Enabled,
    bool UploadAfterBackup,
    string Host,
    int Port,
    string Username,
    string RemotePath,
    bool HasPassword,
    DateTimeOffset? LastTestAt,
    string? LastTestStatus,
    DateTimeOffset? LastUploadAt,
    string? LastUploadStatus);

public sealed record UpdateBackupRemoteStorageRequest(
    bool Enabled,
    bool UploadAfterBackup,
    string Host,
    int Port,
    string Username,
    string? Password,
    bool ClearPassword,
    string RemotePath);

public interface IBackupService
{
    Task<IReadOnlyList<BackupArchiveDto>> GetBackupsAsync(CancellationToken cancellationToken);
    Task<Result<BackupOperationResultDto>> CreateBackupAsync(CancellationToken cancellationToken);
    Task<Result<BackupOperationResultDto>> RestoreBackupAsync(string backupName, CancellationToken cancellationToken);
    Task<Result<BackupDownloadDto>> OpenBackupDownloadAsync(string backupName, CancellationToken cancellationToken);
    Task<BackupScheduleDto> GetScheduleAsync(CancellationToken cancellationToken);
    Task<Result<BackupScheduleDto>> UpdateScheduleAsync(UpdateBackupScheduleRequest request, CancellationToken cancellationToken);
    Task<BackupRemoteStorageDto> GetRemoteStorageAsync(CancellationToken cancellationToken);
    Task<Result<BackupRemoteStorageDto>> UpdateRemoteStorageAsync(UpdateBackupRemoteStorageRequest request, CancellationToken cancellationToken);
    Task<Result<BackupOperationResultDto>> TestRemoteStorageAsync(CancellationToken cancellationToken);
    Task<Result<BackupOperationResultDto>> UploadBackupAsync(string backupName, CancellationToken cancellationToken);
    Task<bool> IsScheduleDueAsync(DateTimeOffset now, CancellationToken cancellationToken);
    Task MarkScheduledRunAsync(DateTimeOffset completedAt, CancellationToken cancellationToken);
}
