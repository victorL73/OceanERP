using System.Diagnostics;
using System.Globalization;
using System.IO.Compression;
using System.Text.Json;
using Erp.Application.Backups;
using Erp.Application.Common;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace Erp.Infrastructure.Services;

public sealed class BackupService(IOptions<BackupOptions> options, ILogger<BackupService> logger) : IBackupService
{
    private static readonly SemaphoreSlim OperationLock = new(1, 1);
    private static readonly SemaphoreSlim ScheduleLock = new(1, 1);
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

        return await RunLockedAsync("backup", scriptPath, [], null, cancellationToken);
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
        var tempPath = Path.Combine(Path.GetTempPath(), $"oceanerp-backup-{safeName}-{Guid.NewGuid():N}.zip");

        try
        {
            await Task.Run(
                () =>
                {
                    using var archive = ZipFile.Open(tempPath, ZipArchiveMode.Create);
                    foreach (var filePath in Directory.EnumerateFiles(backupPathResult.Value).OrderBy(Path.GetFileName))
                    {
                        cancellationToken.ThrowIfCancellationRequested();
                        archive.CreateEntryFromFile(filePath, Path.GetFileName(filePath), CompressionLevel.Fastest);
                    }
                },
                cancellationToken);

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
            TryDelete(tempPath);
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

        await ScheduleLock.WaitAsync(cancellationToken);
        try
        {
            var existing = await ReadScheduleStateUnlockedAsync(cancellationToken);
            var intervalHours = NormalizeInterval(request.IntervalHours);
            var now = DateTimeOffset.UtcNow;
            var state = new BackupScheduleState(
                request.Enabled,
                intervalHours,
                existing.LastRunAt,
                request.Enabled ? CalculateNextRun(existing.LastRunAt, intervalHours, now) : null);

            await WriteScheduleStateUnlockedAsync(state, cancellationToken);
            return Result<BackupScheduleDto>.Success(ToScheduleDto(state));
        }
        finally
        {
            ScheduleLock.Release();
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
            var state = existing with
            {
                IntervalHours = intervalHours,
                LastRunAt = completedAt,
                NextRunAt = existing.Enabled ? completedAt.AddHours(intervalHours) : null
            };

            await WriteScheduleStateUnlockedAsync(state, cancellationToken);
        }
        finally
        {
            ScheduleLock.Release();
        }
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
            return new BackupScheduleState(
                options.ScheduleEnabled,
                intervalHours,
                null,
                options.ScheduleEnabled ? DateTimeOffset.UtcNow : null);
        }

        try
        {
            await using var stream = File.OpenRead(schedulePath);
            var state = await JsonSerializer.DeserializeAsync<BackupScheduleState>(stream, cancellationToken: cancellationToken);
            if (state is null)
            {
                return new BackupScheduleState(false, NormalizeInterval(options.ScheduleIntervalHours), null, null);
            }

            var intervalHours = NormalizeInterval(state.IntervalHours);
            return state with { IntervalHours = intervalHours };
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            logger.LogWarning(ex, "Backup schedule file could not be read");
            return new BackupScheduleState(false, NormalizeInterval(options.ScheduleIntervalHours), null, null);
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

    private static BackupScheduleDto ToScheduleDto(BackupScheduleState state)
    {
        return new BackupScheduleDto(state.Enabled, NormalizeInterval(state.IntervalHours), state.LastRunAt, state.Enabled ? state.NextRunAt : null);
    }

    private static DateTimeOffset CalculateNextRun(DateTimeOffset? lastRunAt, int intervalHours, DateTimeOffset now)
    {
        if (lastRunAt is null)
        {
            return now.AddHours(intervalHours);
        }

        var next = lastRunAt.Value.AddHours(intervalHours);
        while (next <= now)
        {
            next = next.AddHours(intervalHours);
        }

        return next;
    }

    private static int NormalizeInterval(int hours)
    {
        return Math.Clamp(hours, 1, 24 * 30);
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
        DateTimeOffset? LastRunAt,
        DateTimeOffset? NextRunAt);
}
