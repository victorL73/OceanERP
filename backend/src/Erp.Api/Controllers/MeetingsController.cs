using Erp.Application.Meetings;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Erp.Api.Controllers;

[ApiController]
[Route("api/meetings")]
[Authorize]
public sealed class MeetingsController(IMeetingService meetings) : ControllerBase
{
    [HttpGet("dashboard")]
    [Authorize(Policy = "meet.read")]
    public async Task<ActionResult<MeetingDashboardDto>> Dashboard(CancellationToken cancellationToken)
        => Ok(await meetings.DashboardAsync(cancellationToken));

    [HttpGet("rooms/{id:guid}")]
    [Authorize(Policy = "meet.read")]
    public async Task<ActionResult<MeetingRoomStateDto>> Get(Guid id, [FromQuery] string? clientId, [FromQuery] DateTimeOffset? since, CancellationToken cancellationToken)
    {
        var result = await meetings.GetAsync(id, clientId, since, cancellationToken);
        return result.Succeeded ? Ok(result.Value) : NotFound(new { error = result.Error });
    }

    [HttpPost("rooms")]
    [Authorize(Policy = "meet.write")]
    public async Task<ActionResult<MeetingRoomStateDto>> Create(CreateMeetingRoomRequest request, CancellationToken cancellationToken)
    {
        var result = await meetings.CreateAsync(request, cancellationToken);
        return result.Succeeded ? Ok(result.Value) : BadRequest(new { error = result.Error });
    }

    [HttpPost("rooms/join")]
    [Authorize(Policy = "meet.read")]
    public async Task<ActionResult<MeetingRoomStateDto>> Join(JoinMeetingRoomRequest request, CancellationToken cancellationToken)
    {
        var result = await meetings.JoinAsync(request, cancellationToken);
        return result.Succeeded ? Ok(result.Value) : BadRequest(new { error = result.Error });
    }

    [HttpPost("rooms/{id:guid}/invite")]
    [Authorize(Policy = "meet.write")]
    public async Task<ActionResult> EnsureInvite(Guid id, CancellationToken cancellationToken)
    {
        var result = await meetings.EnsureInviteAsync(id, cancellationToken);
        return result.Succeeded ? Ok(new { token = result.Value }) : NotFound(new { error = result.Error });
    }

    [HttpPost("rooms/{id:guid}/sync")]
    [Authorize(Policy = "meet.read")]
    public async Task<ActionResult<MeetingRoomStateDto>> Sync(Guid id, SyncMeetingRoomRequest request, CancellationToken cancellationToken)
    {
        var result = await meetings.SyncAsync(id, request, cancellationToken);
        return result.Succeeded ? Ok(result.Value) : NotFound(new { error = result.Error });
    }

    [HttpPost("rooms/{id:guid}/signals")]
    [Authorize(Policy = "meet.write")]
    public async Task<ActionResult<MeetingSignalDto>> Signal(Guid id, SendMeetingSignalRequest request, CancellationToken cancellationToken)
    {
        var result = await meetings.SendSignalAsync(id, request, cancellationToken);
        return result.Succeeded ? Ok(result.Value) : BadRequest(new { error = result.Error });
    }

    [HttpPost("rooms/{id:guid}/transcripts")]
    [Authorize(Policy = "meet.write")]
    public async Task<ActionResult<MeetingTranscriptDto>> Transcript(Guid id, AddMeetingTranscriptRequest request, CancellationToken cancellationToken)
    {
        var result = await meetings.AddTranscriptAsync(id, request, cancellationToken);
        return result.Succeeded ? Ok(result.Value) : BadRequest(new { error = result.Error });
    }

    [HttpPost("rooms/{id:guid}/chat")]
    [Authorize(Policy = "meet.write")]
    public async Task<ActionResult<MeetingChatMessageDto>> Chat(Guid id, AddMeetingChatMessageRequest request, CancellationToken cancellationToken)
    {
        var result = await meetings.AddChatMessageAsync(id, request, cancellationToken);
        return result.Succeeded ? Ok(result.Value) : BadRequest(new { error = result.Error });
    }

    [HttpPost("rooms/{id:guid}/leave")]
    [Authorize(Policy = "meet.read")]
    public async Task<IActionResult> Leave(Guid id, LeaveMeetingRoomRequest request, CancellationToken cancellationToken)
    {
        var result = await meetings.LeaveAsync(id, request, cancellationToken);
        return result.Succeeded ? NoContent() : NotFound(new { error = result.Error });
    }

    [HttpDelete("rooms/{id:guid}")]
    [Authorize(Policy = "meet.write")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken cancellationToken)
    {
        var result = await meetings.DeleteAsync(id, cancellationToken);
        return result.Succeeded ? NoContent() : NotFound(new { error = result.Error });
    }

    [HttpGet("chat/{messageId:guid}/attachment")]
    [Authorize(Policy = "meet.read")]
    public async Task<IActionResult> DownloadAttachment(Guid messageId, CancellationToken cancellationToken)
    {
        var result = await meetings.OpenChatAttachmentAsync(messageId, cancellationToken);
        if (!result.Succeeded)
        {
            return NotFound(new { error = result.Error });
        }

        var file = result.Value!;
        return File(file.Content, file.MimeType, file.FileName);
    }
}
