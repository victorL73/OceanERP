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
    public async Task<ActionResult<IReadOnlyList<DriveFolderDto>>> Folders([FromQuery] Guid? parentFolderId, [FromQuery] string? search, [FromQuery] bool includeTrashed, CancellationToken cancellationToken)
        => Ok(await drive.GetFoldersAsync(parentFolderId, search, includeTrashed, cancellationToken));

    [HttpPost("folders")]
    [Authorize(Policy = "drive.write")]
    public async Task<ActionResult<DriveFolderDto>> CreateFolder(CreateFolderRequest request, CancellationToken cancellationToken)
    {
        var result = await drive.CreateFolderAsync(request, cancellationToken);
        return result.Succeeded ? Ok(result.Value) : BadRequest(new { error = result.Error });
    }

    [HttpPut("folders/{id:guid}/rename")]
    [Authorize(Policy = "drive.write")]
    public async Task<ActionResult<DriveFolderDto>> RenameFolder(Guid id, RenameDriveItemRequest request, CancellationToken cancellationToken)
    {
        var result = await drive.RenameFolderAsync(id, request, cancellationToken);
        return result.Succeeded ? Ok(result.Value) : BadRequest(new { error = result.Error });
    }

    [HttpPut("folders/{id:guid}/move")]
    [Authorize(Policy = "drive.write")]
    public async Task<ActionResult<DriveFolderDto>> MoveFolder(Guid id, MoveDriveItemRequest request, CancellationToken cancellationToken)
    {
        var result = await drive.MoveFolderAsync(id, request, cancellationToken);
        return result.Succeeded ? Ok(result.Value) : BadRequest(new { error = result.Error });
    }

    [HttpDelete("folders/{id:guid}")]
    [Authorize(Policy = "drive.write")]
    public async Task<IActionResult> TrashFolder(Guid id, CancellationToken cancellationToken)
    {
        var result = await drive.TrashFolderAsync(id, cancellationToken);
        return result.Succeeded ? NoContent() : NotFound(new { error = result.Error });
    }

    [HttpPost("folders/{id:guid}/restore")]
    [Authorize(Policy = "drive.write")]
    public async Task<ActionResult<DriveFolderDto>> RestoreFolder(Guid id, CancellationToken cancellationToken)
    {
        var result = await drive.RestoreFolderAsync(id, cancellationToken);
        return result.Succeeded ? Ok(result.Value) : NotFound(new { error = result.Error });
    }

    [HttpGet("files")]
    [Authorize(Policy = "drive.read")]
    public async Task<ActionResult<IReadOnlyList<DriveItemDto>>> Files([FromQuery] Guid? folderId, [FromQuery] string? search, [FromQuery] bool includeTrashed, CancellationToken cancellationToken)
        => Ok(await drive.GetFilesAsync(folderId, search, includeTrashed, cancellationToken));

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

    [HttpPut("files/{id:guid}/rename")]
    [Authorize(Policy = "drive.write")]
    public async Task<ActionResult<DriveItemDto>> RenameFile(Guid id, RenameDriveItemRequest request, CancellationToken cancellationToken)
    {
        var result = await drive.RenameFileAsync(id, request, cancellationToken);
        return result.Succeeded ? Ok(result.Value) : BadRequest(new { error = result.Error });
    }

    [HttpPut("files/{id:guid}/move")]
    [Authorize(Policy = "drive.write")]
    public async Task<ActionResult<DriveItemDto>> MoveFile(Guid id, MoveDriveItemRequest request, CancellationToken cancellationToken)
    {
        var result = await drive.MoveFileAsync(id, request, cancellationToken);
        return result.Succeeded ? Ok(result.Value) : BadRequest(new { error = result.Error });
    }

    [HttpDelete("files/{id:guid}")]
    [Authorize(Policy = "drive.write")]
    public async Task<IActionResult> Trash(Guid id, CancellationToken cancellationToken)
    {
        var result = await drive.TrashFileAsync(id, cancellationToken);
        return result.Succeeded ? NoContent() : NotFound(new { error = result.Error });
    }

    [HttpPost("files/{id:guid}/restore")]
    [Authorize(Policy = "drive.write")]
    public async Task<ActionResult<DriveItemDto>> RestoreFile(Guid id, CancellationToken cancellationToken)
    {
        var result = await drive.RestoreFileAsync(id, cancellationToken);
        return result.Succeeded ? Ok(result.Value) : NotFound(new { error = result.Error });
    }

    [HttpGet("links/{module}/{entityId:guid}")]
    [Authorize(Policy = "drive.read")]
    public async Task<ActionResult<IReadOnlyList<DocumentLinkDto>>> Links(string module, Guid entityId, CancellationToken cancellationToken)
        => Ok(await drive.GetLinksAsync(module, entityId, cancellationToken));

    [HttpPost("links")]
    [Authorize(Policy = "drive.write")]
    public async Task<ActionResult<DocumentLinkDto>> Link(CreateDocumentLinkRequest request, CancellationToken cancellationToken)
    {
        var result = await drive.LinkFileAsync(request, cancellationToken);
        return result.Succeeded ? Ok(result.Value) : BadRequest(new { error = result.Error });
    }

    [HttpDelete("links/{id:guid}")]
    [Authorize(Policy = "drive.write")]
    public async Task<IActionResult> Unlink(Guid id, CancellationToken cancellationToken)
    {
        var result = await drive.UnlinkFileAsync(id, cancellationToken);
        return result.Succeeded ? NoContent() : NotFound(new { error = result.Error });
    }
}
