using Erp.Application.Documents;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Erp.Api.Controllers;

[ApiController]
[Route("api/drive")]
[Authorize]
public sealed class DriveController(IDriveService drive) : ControllerBase
{
    [HttpGet("folders")]
    [Authorize(Policy = "drive.read")]
    public async Task<ActionResult<IReadOnlyList<DriveFolderDto>>> Folders([FromQuery] Guid? parentFolderId, CancellationToken cancellationToken)
        => Ok(await drive.GetFoldersAsync(parentFolderId, cancellationToken));

    [HttpPost("folders")]
    [Authorize(Policy = "drive.write")]
    public async Task<ActionResult<DriveFolderDto>> CreateFolder(CreateFolderRequest request, CancellationToken cancellationToken)
    {
        var result = await drive.CreateFolderAsync(request, cancellationToken);
        return result.Succeeded ? Ok(result.Value) : BadRequest(new { error = result.Error });
    }

    [HttpGet("files")]
    [Authorize(Policy = "drive.read")]
    public async Task<ActionResult<IReadOnlyList<DriveItemDto>>> Files([FromQuery] Guid? folderId, CancellationToken cancellationToken)
        => Ok(await drive.GetFilesAsync(folderId, cancellationToken));

    [HttpPost("files")]
    [Authorize(Policy = "drive.write")]
    [RequestSizeLimit(100_000_000)]
    public async Task<ActionResult<DriveUploadResult>> Upload([FromForm] Guid? folderId, [FromForm] IFormFile file, CancellationToken cancellationToken)
    {
        await using var stream = file.OpenReadStream();
        var result = await drive.SaveFileAsync(folderId, file.FileName, file.ContentType, stream, cancellationToken);
        return result.Succeeded ? Ok(result.Value) : BadRequest(new { error = result.Error });
    }

    [HttpGet("files/{id:guid}/download")]
    [Authorize(Policy = "drive.read")]
    public async Task<IActionResult> Download(Guid id, CancellationToken cancellationToken)
    {
        var result = await drive.OpenFileAsync(id, cancellationToken);
        if (!result.Succeeded)
        {
            return NotFound(new { error = result.Error });
        }

        var file = result.Value!;
        return File(file.Content, file.MimeType, file.FileName);
    }

    [HttpDelete("files/{id:guid}")]
    [Authorize(Policy = "drive.write")]
    public async Task<IActionResult> Trash(Guid id, CancellationToken cancellationToken)
    {
        var result = await drive.TrashFileAsync(id, cancellationToken);
        return result.Succeeded ? NoContent() : NotFound(new { error = result.Error });
    }
}
