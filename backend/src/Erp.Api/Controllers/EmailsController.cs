using Erp.Application.Emails;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Erp.Api.Controllers;

[ApiController]
[Route("api/emails")]
[Authorize]
public sealed class EmailsController(IEmailService emails) : ControllerBase
{
    [HttpGet("server-settings")]
    [Authorize(Policy = "emails.read")]
    public async Task<ActionResult<MailServerSettingsDto>> ServerSettings(CancellationToken cancellationToken)
        => Ok(await emails.GetServerSettingsAsync(cancellationToken));

    [HttpPut("server-settings")]
    [Authorize(Policy = "emails.write")]
    public async Task<ActionResult<MailServerSettingsDto>> UpdateServerSettings(UpdateMailServerSettingsRequest request, CancellationToken cancellationToken)
    {
        var result = await emails.UpdateServerSettingsAsync(request, cancellationToken);
        return result.Succeeded ? Ok(result.Value) : BadRequest(new { error = result.Error });
    }

    [HttpGet("accounts")]
    [Authorize(Policy = "emails.read")]
    public async Task<ActionResult<IReadOnlyList<MailAccountDto>>> Accounts(CancellationToken cancellationToken)
        => Ok(await emails.GetAccountsAsync(cancellationToken));

    [HttpPost("accounts")]
    [Authorize(Policy = "emails.write")]
    public async Task<ActionResult<MailAccountDto>> CreateAccount(CreateMailAccountRequest request, CancellationToken cancellationToken)
    {
        var result = await emails.CreateAccountAsync(request, cancellationToken);
        return result.Succeeded ? Ok(result.Value) : BadRequest(new { error = result.Error });
    }

    [HttpPut("accounts/{id:guid}")]
    [Authorize(Policy = "emails.write")]
    public async Task<ActionResult<MailAccountDto>> UpdateAccount(Guid id, UpdateMailAccountRequest request, CancellationToken cancellationToken)
    {
        var result = await emails.UpdateAccountAsync(id, request, cancellationToken);
        return result.Succeeded ? Ok(result.Value) : BadRequest(new { error = result.Error });
    }

    [HttpDelete("accounts/{id:guid}")]
    [Authorize(Policy = "emails.write")]
    public async Task<ActionResult> DeleteAccount(Guid id, CancellationToken cancellationToken)
    {
        var result = await emails.DeleteAccountAsync(id, cancellationToken);
        return result.Succeeded ? NoContent() : BadRequest(new { error = result.Error });
    }

    [HttpPost("accounts/{id:guid}/test-smtp")]
    [Authorize(Policy = "emails.write")]
    public async Task<ActionResult> TestSmtp(Guid id, CancellationToken cancellationToken)
    {
        var result = await emails.TestSmtpAsync(id, cancellationToken);
        return result.Succeeded ? Ok(new { status = "ok" }) : BadRequest(new { error = result.Error });
    }

    [HttpPost("accounts/{id:guid}/sync-imap")]
    [Authorize(Policy = "emails.write")]
    public async Task<ActionResult> SyncImap(Guid id, [FromQuery] int limit = 50, CancellationToken cancellationToken = default)
    {
        var result = await emails.SyncImapAsync(id, limit, cancellationToken);
        return result.Succeeded ? Ok(new { imported = result.Value }) : BadRequest(new { error = result.Error });
    }

    [HttpGet("messages")]
    [Authorize(Policy = "emails.read")]
    public async Task<ActionResult> Messages([FromQuery] string? search, [FromQuery] Guid? accountId, [FromQuery] int page = 1, [FromQuery] int pageSize = 20, CancellationToken cancellationToken = default)
        => Ok(await emails.GetMessagesAsync(search, accountId, page, pageSize, cancellationToken));

    [HttpGet("messages/{id:guid}")]
    [Authorize(Policy = "emails.read")]
    public async Task<ActionResult<EmailMessageDto>> Message(Guid id, CancellationToken cancellationToken)
    {
        var result = await emails.GetMessageAsync(id, cancellationToken);
        return result.Succeeded ? Ok(result.Value) : NotFound(new { error = result.Error });
    }

    [HttpPost("messages/{id:guid}/read")]
    [Authorize(Policy = "emails.write")]
    public async Task<ActionResult<EmailMessageDto>> MarkRead(Guid id, [FromQuery] bool isRead = true, CancellationToken cancellationToken = default)
    {
        var result = await emails.MarkReadAsync(id, isRead, cancellationToken);
        return result.Succeeded ? Ok(result.Value) : NotFound(new { error = result.Error });
    }

    [HttpGet("messages/{messageId:guid}/attachments/{attachmentId:guid}/download")]
    [Authorize(Policy = "emails.read")]
    public async Task<IActionResult> DownloadAttachment(Guid messageId, Guid attachmentId, CancellationToken cancellationToken)
    {
        var result = await emails.OpenAttachmentAsync(messageId, attachmentId, cancellationToken);
        if (!result.Succeeded)
        {
            return NotFound(new { error = result.Error });
        }

        var file = result.Value!;
        return File(file.Content, file.MimeType, file.FileName);
    }

    [HttpPost("send")]
    [Authorize(Policy = "emails.write")]
    public async Task<ActionResult<EmailMessageDto>> Send(SendEmailRequest request, CancellationToken cancellationToken)
    {
        var result = await emails.SendAsync(request, cancellationToken);
        return result.Succeeded ? Ok(result.Value) : BadRequest(new { error = result.Error });
    }

    [HttpGet("templates")]
    [Authorize(Policy = "emails.read")]
    public async Task<ActionResult<IReadOnlyList<EmailTemplateDto>>> Templates(CancellationToken cancellationToken)
        => Ok(await emails.GetTemplatesAsync(cancellationToken));

    [HttpPost("templates")]
    [Authorize(Policy = "emails.write")]
    public async Task<ActionResult<EmailTemplateDto>> CreateTemplate(CreateEmailTemplateRequest request, CancellationToken cancellationToken)
    {
        var result = await emails.CreateTemplateAsync(request, cancellationToken);
        return result.Succeeded ? Ok(result.Value) : BadRequest(new { error = result.Error });
    }

    [HttpPut("templates/{id:guid}")]
    [Authorize(Policy = "emails.write")]
    public async Task<ActionResult<EmailTemplateDto>> UpdateTemplate(Guid id, UpdateEmailTemplateRequest request, CancellationToken cancellationToken)
    {
        var result = await emails.UpdateTemplateAsync(id, request, cancellationToken);
        return result.Succeeded ? Ok(result.Value) : BadRequest(new { error = result.Error });
    }

    [HttpDelete("templates/{id:guid}")]
    [Authorize(Policy = "emails.write")]
    public async Task<ActionResult> DeleteTemplate(Guid id, CancellationToken cancellationToken)
    {
        var result = await emails.DeleteTemplateAsync(id, cancellationToken);
        return result.Succeeded ? NoContent() : BadRequest(new { error = result.Error });
    }
}
