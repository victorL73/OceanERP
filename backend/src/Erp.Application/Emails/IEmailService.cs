using Erp.Application.Common;

namespace Erp.Application.Emails;

public interface IEmailService
{
    Task<IReadOnlyList<MailAccountDto>> GetAccountsAsync(CancellationToken cancellationToken);
    Task<Result<MailAccountDto>> CreateAccountAsync(CreateMailAccountRequest request, CancellationToken cancellationToken);
    Task<PagedResult<EmailMessageDto>> GetMessagesAsync(int page, int pageSize, CancellationToken cancellationToken);
    Task<Result<EmailMessageDto>> SendAsync(SendEmailRequest request, CancellationToken cancellationToken);
}

