using Erp.Application.Backups;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Erp.Api.Controllers;

[ApiController]
[Route("api/backups")]
[Authorize]
public sealed class BackupsController(IBackupService backups) : ControllerBase
{
    [HttpGet]
    [Authorize(Policy = "backup.read")]
    public async Task<ActionResult<IReadOnlyList<BackupArchiveDto>>> Get(CancellationToken cancellationToken)
        => Ok(await backups.GetBackupsAsync(cancellationToken));

    [HttpPost]
    [Authorize(Policy = "backup.write")]
    public async Task<ActionResult<BackupOperationResultDto>> Create(CancellationToken cancellationToken)
    {
        var result = await backups.CreateBackupAsync(cancellationToken);
        return result.Succeeded ? Ok(result.Value) : BadRequest(new { error = result.Error });
    }

    [HttpGet("schedule")]
    [Authorize(Policy = "backup.read")]
    public async Task<ActionResult<BackupScheduleDto>> GetSchedule(CancellationToken cancellationToken)
        => Ok(await backups.GetScheduleAsync(cancellationToken));

    [HttpPut("schedule")]
    [Authorize(Policy = "backup.write")]
    public async Task<ActionResult<BackupScheduleDto>> UpdateSchedule(UpdateBackupScheduleRequest request, CancellationToken cancellationToken)
    {
        var result = await backups.UpdateScheduleAsync(request, cancellationToken);
        return result.Succeeded ? Ok(result.Value) : BadRequest(new { error = result.Error });
    }

    [HttpGet("remote-storage")]
    [Authorize(Policy = "backup.read")]
    public async Task<ActionResult<BackupRemoteStorageDto>> GetRemoteStorage(CancellationToken cancellationToken)
        => Ok(await backups.GetRemoteStorageAsync(cancellationToken));

    [HttpPut("remote-storage")]
    [Authorize(Policy = "backup.write")]
    public async Task<ActionResult<BackupRemoteStorageDto>> UpdateRemoteStorage(UpdateBackupRemoteStorageRequest request, CancellationToken cancellationToken)
    {
        var result = await backups.UpdateRemoteStorageAsync(request, cancellationToken);
        return result.Succeeded ? Ok(result.Value) : BadRequest(new { error = result.Error });
    }

    [HttpPost("remote-storage/test")]
    [Authorize(Policy = "backup.write")]
    public async Task<ActionResult<BackupOperationResultDto>> TestRemoteStorage(CancellationToken cancellationToken)
    {
        var result = await backups.TestRemoteStorageAsync(cancellationToken);
        return result.Succeeded ? Ok(result.Value) : BadRequest(new { error = result.Error });
    }

    [HttpGet("{name}/download")]
    [Authorize(Policy = "backup.read")]
    public async Task<IActionResult> Download(string name, CancellationToken cancellationToken)
    {
        var result = await backups.OpenBackupDownloadAsync(Uri.UnescapeDataString(name), cancellationToken);
        if (!result.Succeeded || result.Value is null)
        {
            return BadRequest(new { error = result.Error });
        }

        return File(result.Value.Content, result.Value.ContentType, result.Value.FileName);
    }

    [HttpPost("{name}/restore")]
    [Authorize(Policy = "backup.write")]
    public async Task<ActionResult<BackupOperationResultDto>> Restore(string name, CancellationToken cancellationToken)
    {
        var result = await backups.RestoreBackupAsync(Uri.UnescapeDataString(name), cancellationToken);
        return result.Succeeded ? Ok(result.Value) : BadRequest(new { error = result.Error });
    }

    [HttpPost("{name}/upload")]
    [Authorize(Policy = "backup.write")]
    public async Task<ActionResult<BackupOperationResultDto>> Upload(string name, CancellationToken cancellationToken)
    {
        var result = await backups.UploadBackupAsync(Uri.UnescapeDataString(name), cancellationToken);
        return result.Succeeded ? Ok(result.Value) : BadRequest(new { error = result.Error });
    }
}
