using System.Diagnostics;
using System.Globalization;
using System.IO.Compression;
using System.Text;
using System.Text.Json;
using Erp.Application.Backups;
using Erp.Application.Common;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Renci.SshNet;

namespace Erp.Infrastructure.Services;

public sealed class BackupService(IOptions<BackupOptions> options, ILogger<BackupService> logger) : IBackupService
{
    private static readonly SemaphoreSlim OperationLock = new(1, 1);
    private static readonly SemaphoreSlim ScheduleLock = new(1, 1);
    private static readonly SemaphoreSlim RemoteStorageLock = new(1, 1);
    private readonly BackupOptions options = options.Value;

    public Task<IReadOnlyList<BackupArchiveDto>> GetBackupsAsync(CancellationToken cancellationToken)
    {
        cancellationToken.ThrowIfCancellationRequested();
        var backupsDirectory = FullPath(options.BackupsDirectory);
        if (!Directory.Exists(backupsDirectory))
        {
            return Task.FromResult<IReadOnlyList<BackupArchiveDto>>([]);
        }

        var backups = Directory
            .EnumerateDirectories(backupsDirectory)
            .Select(ReadBackupArchive)
            .OrderByDescending(x => x.CreatedAt)
            .ToList();

        return Task.FromResult<IReadOnlyList<BackupArchiveDto>>(backups);
    }

    public async Task<Result<BackupOperationResultDto>> CreateBackupAsync(CancellationToken cancellationToken)
    {
        var scriptPath = ResolveScriptPath(options.BackupScript);
        if (!File.Exists(scriptPath))
        {
            return Result<BackupOperationResultDto>.Failure($"Script de sauvegarde introuvable : {scriptPath}");
        }

        var result = await RunLockedAsync("backup", scriptPath, [], null, cancellationToken);
        if (!result.Succeeded || result.Value is null || !result.Value.Succeeded || string.IsNullOrWhiteSpace(result.Value.BackupName))
        {
            return result;
        }

        var remote = await ReadRemoteStorageStateAsync(cancellationToken);
        if (!remote.Enabled || !remote.UploadAfterBackup)
        {
            return result;
        }

        var uploadResult = await UploadBackupAsync(result.Value.BackupName, cancellationToken);
        if (!uploadResult.Succeeded || uploadResult.Value is null || !uploadResult.Value.Succeeded)
        {
            var message = uploadResult.Error ?? uploadResult.Value?.Message ?? "Erreur inconnue.";
            return Result<BackupOperationResultDto>.Success(result.Value with
            {
                Message = $"{result.Value.Message} Envoi externe impossible : {message}",
                Output = AppendOutput(result.Value.Output, uploadResult.Value?.Output ?? message)
            });
        }

        return Result<BackupOperationResultDto>.Success(result.Value with
        {
            Message = $"{result.Value.Message} Envoi externe effectue.",
            Output = AppendOutput(result.Value.Output, uploadResult.Value.Output)
        });
    }

    public async Task<Result<BackupOperationResultDto>> RestoreBackupAsync(string backupName, CancellationToken cancellationToken)
    {
        var scriptPath = ResolveScriptPath(options.RestoreScript);
        if (!File.Exists(scriptPath))
        {
            return Result<BackupOperationResultDto>.Failure($"Script de restauration introuvable : {scriptPath}");
        }

        var backupPathResult = ResolveBackupPath(backupName);
        if (!backupPathResult.Succeeded || backupPathResult.Value is null)
        {
            return Result<BackupOperationResultDto>.Failure(backupPathResult.Error ?? "Sauvegarde introuvable.");
        }

        if (!File.Exists(Path.Combine(backupPathResult.Value, "postgres.sql.gz")) || !File.Exists(Path.Combine(backupPathResult.Value, "documents.tar.gz")))
        {
            return Result<BackupOperationResultDto>.Failure("Sauvegarde incomplete : postgres.sql.gz et documents.tar.gz sont obligatoires.");
        }

        return await RunLockedAsync("restore", scriptPath, [backupPathResult.Value], Path.GetFileName(backupPathResult.Value), cancellationToken);
    }

    public async Task<Result<BackupDownloadDto>> OpenBackupDownloadAsync(string backupName, CancellationToken cancellationToken)
    {
        var backupPathResult = ResolveBackupPath(backupName);
        if (!backupPathResult.Succeeded || backupPathResult.Value is null)
        {
            return Result<BackupDownloadDto>.Failure(backupPathResult.Error ?? "Sauvegarde introuvable.");
        }

        if (!File.Exists(Path.Combine(backupPathResult.Value, "postgres.sql.gz")) || !File.Exists(Path.Combine(backupPathResult.Value, "documents.tar.gz")))
        {
            return Result<BackupDownloadDto>.Failure("Sauvegarde incomplete : postgres.sql.gz et documents.tar.gz sont obligatoires.");
        }

        var safeName = Path.GetFileName(backupPathResult.Value);
        var tempPath = string.Empty;

        try
        {
            tempPath = await CreateBackupZipAsync(backupPathResult.Value, safeName, cancellationToken);

            var stream = new FileStream(
                tempPath,
                FileMode.Open,
                FileAccess.Read,
                FileShare.Read,
                bufferSize: 64 * 1024,
                FileOptions.Asynchronous | FileOptions.DeleteOnClose);

            return Result<BackupDownloadDto>.Success(new BackupDownloadDto(
                $"oceanerp-backup-{safeName}.zip",
                "application/zip",
                stream));
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            if (!string.IsNullOrWhiteSpace(tempPath))
            {
                TryDelete(tempPath);
            }

            logger.LogError(ex, "Backup archive download failed for {BackupName}", backupName);
            return Result<BackupDownloadDto>.Failure($"Telechargement impossible : {ex.Message}");
        }
    }

    public async Task<BackupScheduleDto> GetScheduleAsync(CancellationToken cancellationToken)
    {
        var state = await ReadScheduleStateAsync(cancellationToken);
        return ToScheduleDto(state);
    }

    public async Task<Result<BackupScheduleDto>> UpdateScheduleAsync(UpdateBackupScheduleRequest request, CancellationToken cancellationToken)
    {
        if (request.IntervalHours < 1 || request.IntervalHours > 24 * 30)
        {
            return Result<BackupScheduleDto>.Failure("La frequence doit etre comprise entre 1 heure et 30 jours.");
        }

        var timeOfDay = NormalizeScheduleTime(request.TimeOfDay);
        if (timeOfDay is null)
        {
            return Result<BackupScheduleDto>.Failure("L'heure de sauvegarde doit etre au format HH:mm.");
        }

        if (request.RetentionDays < 1 || request.RetentionDays > 3650)
        {
            return Result<BackupScheduleDto>.Failure("La conservation doit etre comprise entre 1 et 3650 jours.");
        }

        await ScheduleLock.WaitAsync(cancellationToken);
        try
        {
            var existing = await ReadScheduleStateUnlockedAsync(cancellationToken);
            var intervalHours = NormalizeInterval(request.IntervalHours);
            var retentionDays = NormalizeRetentionDays(request.RetentionDays);
            var now = DateTimeOffset.UtcNow;
            var state = new BackupScheduleState(
                request.Enabled,
                intervalHours,
                timeOfDay,
                retentionDays,
                existing.LastRunAt,
                request.Enabled ? CalculateNextRun(existing.LastRunAt, intervalHours, timeOfDay, now) : null);

            await WriteScheduleStateUnlockedAsync(state, cancellationToken);
            return Result<BackupScheduleDto>.Success(ToScheduleDto(state));
        }
        finally
        {
            ScheduleLock.Release();
        }
    }

    public async Task<BackupRemoteStorageDto> GetRemoteStorageAsync(CancellationToken cancellationToken)
    {
        var state = await ReadRemoteStorageStateAsync(cancellationToken);
        return ToRemoteStorageDto(state);
    }

    public async Task<Result<BackupRemoteStorageDto>> UpdateRemoteStorageAsync(UpdateBackupRemoteStorageRequest request, CancellationToken cancellationToken)
    {
        var validation = ValidateRemoteStorageRequest(request, requireConnectionFields: request.Enabled);
        if (!validation.Succeeded)
        {
            return Result<BackupRemoteStorageDto>.Failure(validation.Error ?? "Configuration de stockage externe invalide.");
        }

        await RemoteStorageLock.WaitAsync(cancellationToken);
        try
        {
            var existing = await ReadRemoteStorageStateUnlockedAsync(cancellationToken);
            var encodedPassword = existing.EncodedPassword;
            if (request.ClearPassword)
            {
                encodedPassword = null;
            }
            else if (!string.IsNullOrWhiteSpace(request.Password))
            {
                encodedPassword = EncodeSecret(request.Password);
            }

            var state = existing with
            {
                Enabled = request.Enabled,
                UploadAfterBackup = request.UploadAfterBackup,
                Host = request.Host.Trim(),
                Port = NormalizePort(request.Port),
                Username = request.Username.Trim(),
                EncodedPassword = encodedPassword,
                RemotePath = NormalizeRemotePath(request.RemotePath)
            };

            await WriteRemoteStorageStateUnlockedAsync(state, cancellationToken);
            return Result<BackupRemoteStorageDto>.Success(ToRemoteStorageDto(state));
        }
        finally
        {
            RemoteStorageLock.Release();
        }
    }

    public async Task<Result<BackupOperationResultDto>> TestRemoteStorageAsync(CancellationToken cancellationToken)
    {
        var state = await ReadRemoteStorageStateAsync(cancellationToken);
        var validation = ValidateRemoteStorageState(state);
        if (!validation.Succeeded)
        {
            return Result<BackupOperationResultDto>.Failure(validation.Error ?? "Configuration SFTP incomplete.");
        }

        var output = new List<string>();
        var testResult = await RunRemoteStorageTestAsync(state, output, cancellationToken);
        var completedAt = DateTimeOffset.UtcNow;
        await UpdateRemoteStorageStatusAsync(testAt: completedAt, testStatus: testResult.Succeeded ? "Connexion SFTP valide." : testResult.Error, uploadAt: null, uploadStatus: null, cancellationToken);

        return testResult.Succeeded
            ? Result<BackupOperationResultDto>.Success(new BackupOperationResultDto(true, "Connexion SFTP valide.", null, string.Join(Environment.NewLine, output), completedAt))
            : Result<BackupOperationResultDto>.Failure(testResult.Error ?? "Connexion SFTP impossible.");
    }

    public async Task<Result<BackupOperationResultDto>> UploadBackupAsync(string backupName, CancellationToken cancellationToken)
    {
        var backupPathResult = ResolveBackupPath(backupName);
        if (!backupPathResult.Succeeded || backupPathResult.Value is null)
        {
            return Result<BackupOperationResultDto>.Failure(backupPathResult.Error ?? "Sauvegarde introuvable.");
        }

        if (!File.Exists(Path.Combine(backupPathResult.Value, "postgres.sql.gz")) || !File.Exists(Path.Combine(backupPathResult.Value, "documents.tar.gz")))
        {
            return Result<BackupOperationResultDto>.Failure("Sauvegarde incomplete : postgres.sql.gz et documents.tar.gz sont obligatoires.");
        }

        var state = await ReadRemoteStorageStateAsync(cancellationToken);
        var validation = ValidateRemoteStorageState(state);
        if (!validation.Succeeded)
        {
            return Result<BackupOperationResultDto>.Failure(validation.Error ?? "Configuration SFTP incomplete.");
        }

        if (!await RemoteStorageLock.WaitAsync(0, cancellationToken))
        {
            return Result<BackupOperationResultDto>.Failure("Un transfert de sauvegarde externe est deja en cours.");
        }

        try
        {
            var output = new List<string>();
            var result = await UploadBackupToRemoteAsync(state, backupName, backupPathResult.Value, output, cancellationToken);
            var completedAt = DateTimeOffset.UtcNow;
            await UpdateRemoteStorageStatusUnlockedAsync(null, null, completedAt, result.Succeeded ? result.Value : result.Error, cancellationToken);

            return result.Succeeded
                ? Result<BackupOperationResultDto>.Success(new BackupOperationResultDto(true, result.Value ?? "Sauvegarde envoyee vers le serveur externe.", backupName, string.Join(Environment.NewLine, output), completedAt))
                : Result<BackupOperationResultDto>.Failure(result.Error ?? "Envoi externe impossible.");
        }
        finally
        {
            RemoteStorageLock.Release();
        }
    }

    public async Task<bool> IsScheduleDueAsync(DateTimeOffset now, CancellationToken cancellationToken)
    {
        var state = await ReadScheduleStateAsync(cancellationToken);
        return state.Enabled && state.NextRunAt is not null && state.NextRunAt <= now;
    }

    public async Task MarkScheduledRunAsync(DateTimeOffset completedAt, CancellationToken cancellationToken)
    {
        await ScheduleLock.WaitAsync(cancellationToken);
        try
        {
            var existing = await ReadScheduleStateUnlockedAsync(cancellationToken);
            var intervalHours = NormalizeInterval(existing.IntervalHours);
            var timeOfDay = NormalizeScheduleTime(existing.TimeOfDay) ?? NormalizeScheduleTime(options.ScheduleTimeLocal) ?? "02:00";
            var retentionDays = NormalizeRetentionDays(existing.RetentionDays);
            var state = existing with
            {
                IntervalHours = intervalHours,
                TimeOfDay = timeOfDay,
                RetentionDays = retentionDays,
                LastRunAt = completedAt,
                NextRunAt = existing.Enabled ? CalculateNextRun(completedAt, intervalHours, timeOfDay, completedAt) : null
            };

            await WriteScheduleStateUnlockedAsync(state, cancellationToken);
        }
        finally
        {
            ScheduleLock.Release();
        }
    }

    private async Task<Result<string>> RunRemoteStorageTestAsync(BackupRemoteStorageState state, List<string> output, CancellationToken cancellationToken)
    {
        var connection = BuildSftpConnection(state);
        if (!connection.Succeeded || connection.Value is null)
        {
            return Result<string>.Failure(connection.Error ?? "Connexion SFTP impossible.");
        }

        try
        {
            await Task.Run(
                () =>
                {
                    cancellationToken.ThrowIfCancellationRequested();
                    using var client = new SftpClient(connection.Value);
                    output.Add($"Connexion a {state.Username}@{state.Host}:{state.Port}...");
                    client.Connect();
                    EnsureRemoteDirectory(client, state.RemotePath);
                    var testFile = CombineRemotePath(state.RemotePath, $".oceanerp-test-{Guid.NewGuid():N}.txt");
                    using var stream = new MemoryStream(Encoding.UTF8.GetBytes($"OceanERP test {DateTimeOffset.UtcNow:O}"));
                    client.UploadFile(stream, testFile, true);
                    client.DeleteFile(testFile);
                    client.Disconnect();
                    output.Add($"Dossier distant disponible : {state.RemotePath}");
                },
                cancellationToken);

            return Result<string>.Success("Connexion SFTP valide.");
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            logger.LogWarning(ex, "External backup storage test failed");
            return Result<string>.Failure($"Connexion SFTP impossible : {ex.Message}");
        }
    }

    private async Task<Result<string>> UploadBackupToRemoteAsync(BackupRemoteStorageState state, string backupName, string backupPath, List<string> output, CancellationToken cancellationToken)
    {
        var connection = BuildSftpConnection(state);
        if (!connection.Succeeded || connection.Value is null)
        {
            return Result<string>.Failure(connection.Error ?? "Connexion SFTP impossible.");
        }

        var safeName = Path.GetFileName(backupPath);
        var tempPath = string.Empty;
        var remoteFile = CombineRemotePath(state.RemotePath, $"oceanerp-backup-{safeName}.zip");
        try
        {
            tempPath = await CreateBackupZipAsync(backupPath, safeName, cancellationToken);
            await Task.Run(
                () =>
                {
                    cancellationToken.ThrowIfCancellationRequested();
                    using var client = new SftpClient(connection.Value);
                    output.Add($"Connexion a {state.Username}@{state.Host}:{state.Port}...");
                    client.Connect();
                    EnsureRemoteDirectory(client, state.RemotePath);
                    using var stream = File.OpenRead(tempPath);
                    output.Add($"Envoi de oceanerp-backup-{safeName}.zip vers {remoteFile}...");
                    client.UploadFile(stream, remoteFile, true);
                    client.Disconnect();
                    output.Add("Transfert SFTP termine.");
                },
                cancellationToken);

            return Result<string>.Success($"Sauvegarde {backupName} envoyee vers {state.Host}:{remoteFile}.");
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            logger.LogError(ex, "External backup upload failed for {BackupName}", backupName);
            return Result<string>.Failure($"Envoi externe impossible : {ex.Message}");
        }
        finally
        {
            if (!string.IsNullOrWhiteSpace(tempPath))
            {
                TryDelete(tempPath);
            }
        }
    }

    private async Task<string> CreateBackupZipAsync(string backupPath, string safeName, CancellationToken cancellationToken)
    {
        var tempPath = Path.Combine(Path.GetTempPath(), $"oceanerp-backup-{safeName}-{Guid.NewGuid():N}.zip");
        await Task.Run(
            () =>
            {
                using var archive = ZipFile.Open(tempPath, ZipArchiveMode.Create);
                foreach (var filePath in Directory.EnumerateFiles(backupPath).OrderBy(Path.GetFileName))
                {
                    cancellationToken.ThrowIfCancellationRequested();
                    archive.CreateEntryFromFile(filePath, Path.GetFileName(filePath), CompressionLevel.Fastest);
                }
            },
            cancellationToken);

        return tempPath;
    }

    private BackupArchiveDto ReadBackupArchive(string directory)
    {
        var postgresPath = Path.Combine(directory, "postgres.sql.gz");
        var documentsPath = Path.Combine(directory, "documents.tar.gz");
        var postgresSize = File.Exists(postgresPath) ? new FileInfo(postgresPath).Length : 0;
        var documentsSize = File.Exists(documentsPath) ? new FileInfo(documentsPath).Length : 0;
        var directoryInfo = new DirectoryInfo(directory);

        return new BackupArchiveDto(
            directoryInfo.Name,
            directoryInfo.FullName,
            ParseBackupDate(directoryInfo.Name) ?? directoryInfo.LastWriteTimeUtc,
            postgresSize,
            documentsSize,
            postgresSize + documentsSize,
            postgresSize > 0,
            documentsSize > 0);
    }

    private async Task<BackupScheduleState> ReadScheduleStateAsync(CancellationToken cancellationToken)
    {
        await ScheduleLock.WaitAsync(cancellationToken);
        try
        {
            return await ReadScheduleStateUnlockedAsync(cancellationToken);
        }
        finally
        {
            ScheduleLock.Release();
        }
    }

    private async Task<BackupScheduleState> ReadScheduleStateUnlockedAsync(CancellationToken cancellationToken)
    {
        var schedulePath = ScheduleFilePath();
        if (!File.Exists(schedulePath))
        {
            var intervalHours = NormalizeInterval(options.ScheduleIntervalHours);
            var timeOfDay = NormalizeScheduleTime(options.ScheduleTimeLocal) ?? "02:00";
            var retentionDays = NormalizeRetentionDays(options.RetentionDays);
            return new BackupScheduleState(
                options.ScheduleEnabled,
                intervalHours,
                timeOfDay,
                retentionDays,
                null,
                options.ScheduleEnabled ? CalculateNextRun(null, intervalHours, timeOfDay, DateTimeOffset.UtcNow) : null);
        }

        try
        {
            await using var stream = File.OpenRead(schedulePath);
            var state = await JsonSerializer.DeserializeAsync<BackupScheduleState>(stream, cancellationToken: cancellationToken);
            if (state is null)
            {
                return DefaultScheduleState(enabled: false);
            }

            var intervalHours = NormalizeInterval(state.IntervalHours);
            var timeOfDay = NormalizeScheduleTime(state.TimeOfDay) ?? NormalizeScheduleTime(options.ScheduleTimeLocal) ?? "02:00";
            var retentionDays = NormalizeRetentionDays(state.RetentionDays);
            var nextRunAt = state.Enabled && state.NextRunAt is null
                ? CalculateNextRun(state.LastRunAt, intervalHours, timeOfDay, DateTimeOffset.UtcNow)
                : state.NextRunAt;

            return state with
            {
                IntervalHours = intervalHours,
                TimeOfDay = timeOfDay,
                RetentionDays = retentionDays,
                NextRunAt = state.Enabled ? nextRunAt : null
            };
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            logger.LogWarning(ex, "Backup schedule file could not be read");
            return DefaultScheduleState(enabled: false);
        }
    }

    private async Task WriteScheduleStateUnlockedAsync(BackupScheduleState state, CancellationToken cancellationToken)
    {
        var backupsDirectory = FullPath(options.BackupsDirectory);
        Directory.CreateDirectory(backupsDirectory);
        await using var stream = File.Create(ScheduleFilePath());
        await JsonSerializer.SerializeAsync(stream, state, new JsonSerializerOptions { WriteIndented = true }, cancellationToken);
    }

    private string ScheduleFilePath()
    {
        var backupsDirectory = FullPath(options.BackupsDirectory);
        return Path.Combine(backupsDirectory, "schedule.json");
    }

    private async Task<BackupRemoteStorageState> ReadRemoteStorageStateAsync(CancellationToken cancellationToken)
    {
        await RemoteStorageLock.WaitAsync(cancellationToken);
        try
        {
            return await ReadRemoteStorageStateUnlockedAsync(cancellationToken);
        }
        finally
        {
            RemoteStorageLock.Release();
        }
    }

    private async Task<BackupRemoteStorageState> ReadRemoteStorageStateUnlockedAsync(CancellationToken cancellationToken)
    {
        var path = RemoteStorageFilePath();
        if (!File.Exists(path))
        {
            return DefaultRemoteStorageState();
        }

        try
        {
            await using var stream = File.OpenRead(path);
            var state = await JsonSerializer.DeserializeAsync<BackupRemoteStorageState>(stream, cancellationToken: cancellationToken);
            if (state is null)
            {
                return DefaultRemoteStorageState();
            }

            return state with
            {
                Port = NormalizePort(state.Port),
                RemotePath = NormalizeRemotePath(state.RemotePath)
            };
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            logger.LogWarning(ex, "External backup storage file could not be read");
            return DefaultRemoteStorageState();
        }
    }

    private async Task WriteRemoteStorageStateUnlockedAsync(BackupRemoteStorageState state, CancellationToken cancellationToken)
    {
        var backupsDirectory = FullPath(options.BackupsDirectory);
        Directory.CreateDirectory(backupsDirectory);
        await using var stream = File.Create(RemoteStorageFilePath());
        await JsonSerializer.SerializeAsync(stream, state, new JsonSerializerOptions { WriteIndented = true }, cancellationToken);
    }

    private async Task UpdateRemoteStorageStatusAsync(DateTimeOffset? testAt, string? testStatus, DateTimeOffset? uploadAt, string? uploadStatus, CancellationToken cancellationToken)
    {
        await RemoteStorageLock.WaitAsync(cancellationToken);
        try
        {
            await UpdateRemoteStorageStatusUnlockedAsync(testAt, testStatus, uploadAt, uploadStatus, cancellationToken);
        }
        finally
        {
            RemoteStorageLock.Release();
        }
    }

    private async Task UpdateRemoteStorageStatusUnlockedAsync(DateTimeOffset? testAt, string? testStatus, DateTimeOffset? uploadAt, string? uploadStatus, CancellationToken cancellationToken)
    {
        var existing = await ReadRemoteStorageStateUnlockedAsync(cancellationToken);
        var state = existing with
        {
            LastTestAt = testAt ?? existing.LastTestAt,
            LastTestStatus = testStatus ?? existing.LastTestStatus,
            LastUploadAt = uploadAt ?? existing.LastUploadAt,
            LastUploadStatus = uploadStatus ?? existing.LastUploadStatus
        };

        await WriteRemoteStorageStateUnlockedAsync(state, cancellationToken);
    }

    private string RemoteStorageFilePath()
    {
        var backupsDirectory = FullPath(options.BackupsDirectory);
        return Path.Combine(backupsDirectory, "remote-storage.json");
    }

    private static BackupScheduleDto ToScheduleDto(BackupScheduleState state)
    {
        var timeOfDay = NormalizeScheduleTime(state.TimeOfDay) ?? "02:00";
        return new BackupScheduleDto(
            state.Enabled,
            NormalizeInterval(state.IntervalHours),
            timeOfDay,
            NormalizeRetentionDays(state.RetentionDays),
            state.LastRunAt,
            state.Enabled ? state.NextRunAt : null);
    }

    private static BackupRemoteStorageDto ToRemoteStorageDto(BackupRemoteStorageState state)
    {
        return new BackupRemoteStorageDto(
            state.Enabled,
            state.UploadAfterBackup,
            state.Host,
            NormalizePort(state.Port),
            state.Username,
            NormalizeRemotePath(state.RemotePath),
            !string.IsNullOrWhiteSpace(state.EncodedPassword),
            state.LastTestAt,
            state.LastTestStatus,
            state.LastUploadAt,
            state.LastUploadStatus);
    }

    private static BackupRemoteStorageState DefaultRemoteStorageState()
    {
        return new BackupRemoteStorageState(false, false, string.Empty, 22, string.Empty, null, "/backups/oceanerp", null, null, null, null);
    }

    private BackupScheduleState DefaultScheduleState(bool enabled)
    {
        var intervalHours = NormalizeInterval(options.ScheduleIntervalHours);
        var timeOfDay = NormalizeScheduleTime(options.ScheduleTimeLocal) ?? "02:00";
        var retentionDays = NormalizeRetentionDays(options.RetentionDays);
        return new BackupScheduleState(
            enabled,
            intervalHours,
            timeOfDay,
            retentionDays,
            null,
            enabled ? CalculateNextRun(null, intervalHours, timeOfDay, DateTimeOffset.UtcNow) : null);
    }

    private static DateTimeOffset CalculateNextRun(DateTimeOffset? lastRunAt, int intervalHours, string timeOfDay, DateTimeOffset now)
    {
        var interval = NormalizeInterval(intervalHours);
        var time = ParseScheduleTime(timeOfDay) ?? new TimeOnly(2, 0);
        var minimum = lastRunAt is not null && lastRunAt > now ? lastRunAt.Value : now;
        var localMinimum = TimeZoneInfo.ConvertTime(minimum, TimeZoneInfo.Local);
        var candidateLocal = localMinimum.Date.Add(time.ToTimeSpan());

        while (candidateLocal <= localMinimum.DateTime)
        {
            candidateLocal = candidateLocal.AddHours(interval);
        }

        return new DateTimeOffset(candidateLocal, TimeZoneInfo.Local.GetUtcOffset(candidateLocal));
    }

    private static string? NormalizeScheduleTime(string? value)
    {
        var parsed = ParseScheduleTime(value);
        return parsed?.ToString("HH:mm", CultureInfo.InvariantCulture);
    }

    private static TimeOnly? ParseScheduleTime(string? value)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            return null;
        }

        return TimeOnly.TryParseExact(value.Trim(), "HH:mm", CultureInfo.InvariantCulture, DateTimeStyles.None, out var parsed)
            ? parsed
            : null;
    }

    private static int NormalizeInterval(int hours)
    {
        return Math.Clamp(hours, 1, 24 * 30);
    }

    private static int NormalizeRetentionDays(int days)
    {
        return Math.Clamp(days <= 0 ? 14 : days, 1, 3650);
    }

    private static int NormalizePort(int port)
    {
        return Math.Clamp(port <= 0 ? 22 : port, 1, 65535);
    }

    private static Result ValidateRemoteStorageRequest(UpdateBackupRemoteStorageRequest request, bool requireConnectionFields)
    {
        if (request.Port is < 1 or > 65535)
        {
            return Result.Failure("Le port SFTP doit etre compris entre 1 et 65535.");
        }

        if (string.IsNullOrWhiteSpace(request.RemotePath))
        {
            return Result.Failure("Le chemin distant est obligatoire.");
        }

        var remotePath = NormalizeRemotePath(request.RemotePath);
        if (remotePath.Contains("..", StringComparison.Ordinal))
        {
            return Result.Failure("Le chemin distant ne doit pas contenir '..'.");
        }

        if (!requireConnectionFields)
        {
            return Result.Success();
        }

        if (string.IsNullOrWhiteSpace(request.Host))
        {
            return Result.Failure("L'hote SFTP est obligatoire.");
        }

        if (string.IsNullOrWhiteSpace(request.Username))
        {
            return Result.Failure("L'utilisateur SFTP est obligatoire.");
        }

        return Result.Success();
    }

    private static Result ValidateRemoteStorageState(BackupRemoteStorageState state)
    {
        if (string.IsNullOrWhiteSpace(state.Host))
        {
            return Result.Failure("Configurez l'hote du serveur externe avant de lancer un test ou un envoi.");
        }

        if (string.IsNullOrWhiteSpace(state.Username))
        {
            return Result.Failure("Configurez l'utilisateur du serveur externe avant de lancer un test ou un envoi.");
        }

        if (string.IsNullOrWhiteSpace(state.EncodedPassword))
        {
            return Result.Failure("Configurez le mot de passe SFTP avant de lancer un test ou un envoi.");
        }

        return Result.Success();
    }

    private static Result<ConnectionInfo> BuildSftpConnection(BackupRemoteStorageState state)
    {
        var password = DecodeSecret(state.EncodedPassword);
        if (string.IsNullOrWhiteSpace(password))
        {
            return Result<ConnectionInfo>.Failure("Mot de passe SFTP manquant.");
        }

        var connection = new ConnectionInfo(
            state.Host.Trim(),
            NormalizePort(state.Port),
            state.Username.Trim(),
            new PasswordAuthenticationMethod(state.Username.Trim(), password))
        {
            Timeout = TimeSpan.FromSeconds(30)
        };

        return Result<ConnectionInfo>.Success(connection);
    }

    private static void EnsureRemoteDirectory(SftpClient client, string remotePath)
    {
        var normalized = NormalizeRemotePath(remotePath);
        if (normalized == "/")
        {
            return;
        }

        var current = string.Empty;
        foreach (var part in normalized.Split('/', StringSplitOptions.RemoveEmptyEntries))
        {
            current += "/" + part;
            if (!client.Exists(current))
            {
                client.CreateDirectory(current);
            }
        }
    }

    private static string CombineRemotePath(string directory, string fileName)
    {
        return $"{NormalizeRemotePath(directory).TrimEnd('/')}/{fileName}";
    }

    private static string NormalizeRemotePath(string path)
    {
        var trimmed = string.IsNullOrWhiteSpace(path) ? "/backups/oceanerp" : path.Trim().Replace('\\', '/');
        return trimmed.StartsWith("/", StringComparison.Ordinal) ? trimmed : "/" + trimmed;
    }

    private static string? EncodeSecret(string? value)
    {
        return string.IsNullOrEmpty(value) ? null : Convert.ToBase64String(Encoding.UTF8.GetBytes(value));
    }

    private static string? DecodeSecret(string? value)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            return null;
        }

        try
        {
            return Encoding.UTF8.GetString(Convert.FromBase64String(value));
        }
        catch (FormatException)
        {
            return null;
        }
    }

    private static string AppendOutput(string existing, string? extra)
    {
        if (string.IsNullOrWhiteSpace(extra))
        {
            return existing;
        }

        return string.IsNullOrWhiteSpace(existing) ? extra : $"{existing}{Environment.NewLine}{extra}";
    }

    private static DateTimeOffset? ParseBackupDate(string name)
    {
        return DateTimeOffset.TryParseExact(
            name,
            "yyyyMMdd'T'HHmmss'Z'",
            CultureInfo.InvariantCulture,
            DateTimeStyles.AssumeUniversal | DateTimeStyles.AdjustToUniversal,
            out var timestamp)
            ? timestamp
            : null;
    }

    private Result<string> ResolveBackupPath(string backupName)
    {
        if (string.IsNullOrWhiteSpace(backupName))
        {
            return Result<string>.Failure("Nom de sauvegarde obligatoire.");
        }

        var backupsDirectory = EnsureTrailingSeparator(FullPath(options.BackupsDirectory));
        var backupPath = FullPath(Path.Combine(backupsDirectory, backupName));
        if (!backupPath.StartsWith(backupsDirectory, StringComparison.OrdinalIgnoreCase))
        {
            return Result<string>.Failure("Chemin de sauvegarde invalide.");
        }

        return Directory.Exists(backupPath)
            ? Result<string>.Success(backupPath)
            : Result<string>.Failure($"Sauvegarde introuvable : {backupName}");
    }

    private async Task<Result<BackupOperationResultDto>> RunLockedAsync(string action, string scriptPath, IReadOnlyList<string> arguments, string? backupName, CancellationToken cancellationToken)
    {
        if (!await OperationLock.WaitAsync(0, cancellationToken))
        {
            return Result<BackupOperationResultDto>.Failure("Une operation de sauvegarde ou restauration est deja en cours.");
        }

        try
        {
            var result = await RunScriptAsync(action, scriptPath, arguments, backupName, cancellationToken);
            return Result<BackupOperationResultDto>.Success(result);
        }
        finally
        {
            OperationLock.Release();
        }
    }

    private async Task<BackupOperationResultDto> RunScriptAsync(string action, string scriptPath, IReadOnlyList<string> arguments, string? backupName, CancellationToken cancellationToken)
    {
        var output = new List<string>();
        var outputLock = new object();
        var retentionDays = NormalizeRetentionDays(options.RetentionDays);
        if (action == "backup")
        {
            var scheduleState = await ReadScheduleStateAsync(cancellationToken);
            retentionDays = NormalizeRetentionDays(scheduleState.RetentionDays);
        }

        var startInfo = new ProcessStartInfo
        {
            FileName = OperatingSystem.IsWindows() ? "bash" : "/usr/bin/env",
            WorkingDirectory = FullPath(options.ScriptDirectory),
            RedirectStandardOutput = true,
            RedirectStandardError = true,
            UseShellExecute = false
        };

        if (!OperatingSystem.IsWindows())
        {
            startInfo.ArgumentList.Add("bash");
        }

        startInfo.ArgumentList.Add(scriptPath);
        foreach (var argument in arguments)
        {
            startInfo.ArgumentList.Add(argument);
        }

        startInfo.Environment["BACKUP_RETENTION_DAYS"] = retentionDays.ToString(CultureInfo.InvariantCulture);

        using var process = new Process { StartInfo = startInfo, EnableRaisingEvents = true };
        try
        {
            if (!process.Start())
            {
                return Operation(false, action, backupName, "Impossible de demarrer le script.", output);
            }

            var standardOutput = ReadToEndAsync(process.StandardOutput, output, outputLock, cancellationToken);
            var standardError = ReadToEndAsync(process.StandardError, output, outputLock, cancellationToken);
            var timeout = TimeSpan.FromSeconds(Math.Max(30, options.CommandTimeoutSeconds));
            var waitTask = process.WaitForExitAsync(cancellationToken);
            var completed = await Task.WhenAny(waitTask, Task.Delay(timeout, cancellationToken));
            if (completed != waitTask)
            {
                TryKill(process);
                return Operation(false, action, backupName, $"Timeout apres {timeout.TotalSeconds:N0} secondes.", output);
            }

            await Task.WhenAll(standardOutput, standardError);
            if (process.ExitCode != 0)
            {
                return Operation(false, action, backupName, $"Script termine en erreur avec le code {process.ExitCode}.", output);
            }

            var finalBackupName = backupName ?? DetectLatestBackupName();
            if (action == "backup")
            {
                CleanupOldBackups(retentionDays, finalBackupName, output);
            }

            return Operation(true, action, finalBackupName, action == "restore" ? "Restauration terminee." : "Sauvegarde terminee.", output);
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            logger.LogError(ex, "Backup script {Action} failed", action);
            return Operation(false, action, backupName, ex.Message, output);
        }
    }

    private static async Task ReadToEndAsync(StreamReader reader, List<string> output, object outputLock, CancellationToken cancellationToken)
    {
        string? line;
        while ((line = await reader.ReadLineAsync(cancellationToken)) is not null)
        {
            lock (outputLock)
            {
                output.Add(line);
            }
        }
    }

    private static void TryKill(Process process)
    {
        try
        {
            if (!process.HasExited)
            {
                process.Kill(entireProcessTree: true);
            }
        }
        catch
        {
            // L'erreur initiale reste le timeout ; l'echec de kill ne doit pas la masquer.
        }
    }

    private static void TryDelete(string path)
    {
        try
        {
            if (File.Exists(path))
            {
                File.Delete(path);
            }
        }
        catch
        {
            // Le fichier temporaire sera nettoye par le systeme si la suppression immediate echoue.
        }
    }

    private BackupOperationResultDto Operation(bool succeeded, string action, string? backupName, string message, IReadOnlyList<string> output)
    {
        var trimmedOutput = string.Join(Environment.NewLine, output.TakeLast(120));
        return new BackupOperationResultDto(succeeded, message, backupName, trimmedOutput, DateTimeOffset.UtcNow);
    }

    private string? DetectLatestBackupName()
    {
        var backupsDirectory = FullPath(options.BackupsDirectory);
        if (!Directory.Exists(backupsDirectory))
        {
            return null;
        }

        return Directory
            .EnumerateDirectories(backupsDirectory)
            .Select(path => new DirectoryInfo(path))
            .OrderByDescending(info => info.LastWriteTimeUtc)
            .FirstOrDefault()
            ?.Name;
    }

    private void CleanupOldBackups(int retentionDays, string? preservedBackupName, List<string> output)
    {
        var backupsDirectory = FullPath(options.BackupsDirectory);
        if (!Directory.Exists(backupsDirectory))
        {
            return;
        }

        var cutoff = DateTimeOffset.UtcNow.AddDays(-NormalizeRetentionDays(retentionDays));
        var deleted = 0;
        foreach (var directory in Directory.EnumerateDirectories(backupsDirectory))
        {
            cancellationSafeCleanup(directory);
        }

        if (deleted > 0)
        {
            output.Add($"{deleted} ancienne(s) sauvegarde(s) supprimee(s) par la retention de {NormalizeRetentionDays(retentionDays)} jour(s).");
        }

        void cancellationSafeCleanup(string directory)
        {
            try
            {
                var info = new DirectoryInfo(directory);
                if (string.Equals(info.Name, preservedBackupName, StringComparison.OrdinalIgnoreCase))
                {
                    return;
                }

                var createdAt = ParseBackupDate(info.Name) ?? info.LastWriteTimeUtc;
                if (createdAt >= cutoff)
                {
                    return;
                }

                info.Delete(recursive: true);
                deleted++;
            }
            catch (Exception ex)
            {
                logger.LogWarning(ex, "Old backup cleanup failed for {BackupDirectory}", directory);
                output.Add($"Nettoyage impossible pour {Path.GetFileName(directory)} : {ex.Message}");
            }
        }
    }

    private string ResolveScriptPath(string scriptName)
    {
        return FullPath(Path.Combine(options.ScriptDirectory, scriptName));
    }

    private static string FullPath(string path)
    {
        return Path.GetFullPath(Environment.ExpandEnvironmentVariables(path));
    }

    private static string EnsureTrailingSeparator(string path)
    {
        return path.EndsWith(Path.DirectorySeparatorChar) ? path : path + Path.DirectorySeparatorChar;
    }

    private sealed record BackupScheduleState(
        bool Enabled,
        int IntervalHours,
        string? TimeOfDay,
        int RetentionDays,
        DateTimeOffset? LastRunAt,
        DateTimeOffset? NextRunAt);

    private sealed record BackupRemoteStorageState(
        bool Enabled,
        bool UploadAfterBackup,
        string Host,
        int Port,
        string Username,
        string? EncodedPassword,
        string RemotePath,
        DateTimeOffset? LastTestAt,
        string? LastTestStatus,
        DateTimeOffset? LastUploadAt,
        string? LastUploadStatus);
}
