using System.Diagnostics;
using System.Globalization;
using Erp.Application.Backups;
using Erp.Application.Common;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace Erp.Infrastructure.Services;

public sealed class BackupService(IOptions<BackupOptions> options, ILogger<BackupService> logger) : IBackupService
{
    private static readonly SemaphoreSlim OperationLock = new(1, 1);
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
}
