using Erp.Application.Emails;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Erp.Api.Controllers;

[ApiController]
[Route("api/emails")]
[Authorize]
public sealed class EmailsController(IEmailService emails) : ControllerBase
{
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

    [HttpGet("messages")]
    [Authorize(Policy = "emails.read")]
    public async Task<ActionResult> Messages([FromQuery] int page = 1, [FromQuery] int pageSize = 20, CancellationToken cancellationToken = default)
        => Ok(await emails.GetMessagesAsync(page, pageSize, cancellationToken));

    [HttpPost("send")]
    [Authorize(Policy = "emails.write")]
    public async Task<ActionResult<EmailMessageDto>> Send(SendEmailRequest request, CancellationToken cancellationToken)
    {
        var result = await emails.SendAsync(request, cancellationToken);
        return result.Succeeded ? Ok(result.Value) : BadRequest(new { error = result.Error });
    }
}

