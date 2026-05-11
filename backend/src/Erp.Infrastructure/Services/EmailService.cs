using Erp.Application.Common;
using Erp.Application.Emails;
using Erp.Domain.FutureModules;
using Erp.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Erp.Infrastructure.Services;

public sealed class EmailService(ErpDbContext db) : IEmailService
{
    public async Task<IReadOnlyList<MailAccountDto>> GetAccountsAsync(CancellationToken cancellationToken)
        => await db.MailAccounts.OrderBy(x => x.Email).Select(x => new MailAccountDto(x.Id, x.Email, x.SmtpHost, x.ImapHost)).ToListAsync(cancellationToken);

    public async Task<Result<MailAccountDto>> CreateAccountAsync(CreateMailAccountRequest request, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.Email))
        {
            return Result<MailAccountDto>.Failure("Email account is required.");
        }

        var account = new MailAccount { Email = request.Email.Trim(), SmtpHost = request.SmtpHost.Trim(), ImapHost = request.ImapHost.Trim() };
        db.MailAccounts.Add(account);
        await db.SaveChangesAsync(cancellationToken);
        return Result<MailAccountDto>.Success(new MailAccountDto(account.Id, account.Email, account.SmtpHost, account.ImapHost));
    }

    public async Task<PagedResult<EmailMessageDto>> GetMessagesAsync(int page, int pageSize, CancellationToken cancellationToken)
    {
        page = Math.Max(1, page);
        pageSize = Math.Clamp(pageSize, 1, 100);
        var total = await db.EmailMessages.CountAsync(cancellationToken);
        var items = await db.EmailMessages.OrderByDescending(x => x.CreatedAt).Skip((page - 1) * pageSize).Take(pageSize)
            .Select(x => new EmailMessageDto(x.Id, x.Subject, x.From, x.To, x.CreatedAt))
            .ToListAsync(cancellationToken);
        return new PagedResult<EmailMessageDto>(items, total, page, pageSize);
    }

    public async Task<Result<EmailMessageDto>> SendAsync(SendEmailRequest request, CancellationToken cancellationToken)
    {
        var account = await db.MailAccounts.FirstOrDefaultAsync(x => x.Id == request.MailAccountId, cancellationToken);
        if (account is null)
        {
            return Result<EmailMessageDto>.Failure("Mail account not found.");
        }

        // Phase 2 base: persist an outgoing email log. SMTP credentials/encryption are added before production sending.
        var message = new EmailMessage { From = account.Email, To = request.To, Subject = request.Subject };
        db.EmailMessages.Add(message);
        await db.SaveChangesAsync(cancellationToken);
        return Result<EmailMessageDto>.Success(new EmailMessageDto(message.Id, message.Subject, message.From, message.To, message.CreatedAt));
    }
}

