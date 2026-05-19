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

    [HttpPost("{name}/restore")]
    [Authorize(Policy = "backup.write")]
    public async Task<ActionResult<BackupOperationResultDto>> Restore(string name, CancellationToken cancellationToken)
    {
        var result = await backups.RestoreBackupAsync(Uri.UnescapeDataString(name), cancellationToken);
        return result.Succeeded ? Ok(result.Value) : BadRequest(new { error = result.Error });
    }
}
