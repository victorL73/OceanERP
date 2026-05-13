using Erp.Application.Common;
using Erp.Application.Documents;
using Erp.Application.Emails;
using Erp.Domain.FutureModules;
using Erp.Infrastructure.Persistence;
using MailKit.Net.Smtp;
using Microsoft.Extensions.Configuration;
using Microsoft.EntityFrameworkCore;
using MimeKit;

namespace Erp.Infrastructure.Services;

public sealed class EmailService(ErpDbContext db, IConfiguration configuration, IFileStorageService fileStorageService) : IEmailService
{
    public async Task<IReadOnlyList<MailAccountDto>> GetAccountsAsync(CancellationToken cancellationToken)
        => await db.MailAccounts.OrderBy(x => x.Email).Select(x => Map(x)).ToListAsync(cancellationToken);

    public async Task<Result<MailAccountDto>> CreateAccountAsync(CreateMailAccountRequest request, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.Email))
        {
            return Result<MailAccountDto>.Failure("Email account is required.");
        }

        if (string.IsNullOrWhiteSpace(request.SmtpHost) || string.IsNullOrWhiteSpace(request.ImapHost))
        {
            return Result<MailAccountDto>.Failure("SMTP and IMAP hosts are required.");
        }

        var account = new MailAccount
        {
            Email = request.Email.Trim(),
            SmtpHost = request.SmtpHost.Trim(),
            SmtpPort = request.SmtpPort,
            ImapHost = request.ImapHost.Trim(),
            ImapPort = request.ImapPort,
            UseSsl = request.UseSsl,
            UserName = string.IsNullOrWhiteSpace(request.UserName) ? request.Email.Trim() : request.UserName.Trim(),
            PasswordSecretName = string.IsNullOrWhiteSpace(request.PasswordSecretName) ? null : request.PasswordSecretName.Trim()
        };
        db.MailAccounts.Add(account);
        await db.SaveChangesAsync(cancellationToken);
        return Result<MailAccountDto>.Success(Map(account));
    }

    public async Task<PagedResult<EmailMessageDto>> GetMessagesAsync(int page, int pageSize, CancellationToken cancellationToken)
    {
        page = Math.Max(1, page);
        pageSize = Math.Clamp(pageSize, 1, 100);
        var total = await db.EmailMessages.CountAsync(cancellationToken);
        var items = await db.EmailMessages.OrderByDescending(x => x.CreatedAt).Skip((page - 1) * pageSize).Take(pageSize)
            .Select(x => new EmailMessageDto(x.Id, x.Subject, x.From, x.To, x.Direction, x.Status, x.IsRead, x.CreatedAt, x.SentAt))
            .ToListAsync(cancellationToken);
        return new PagedResult<EmailMessageDto>(items, total, page, pageSize);
    }

    public Task<Result<EmailMessageDto>> SendAsync(SendEmailRequest request, CancellationToken cancellationToken)
        => SendAsync(request, [], [], cancellationToken);

    public async Task<Result<EmailMessageDto>> SendAsync(SendEmailRequest request, IReadOnlyList<StoredEmailAttachment> attachments, IReadOnlyList<EmailLinkTarget> links, CancellationToken cancellationToken)
    {
        var account = await db.MailAccounts.FirstOrDefaultAsync(x => x.Id == request.MailAccountId, cancellationToken);
        if (account is null)
        {
            return Result<EmailMessageDto>.Failure("Mail account not found.");
        }

        if (string.IsNullOrWhiteSpace(request.To) || string.IsNullOrWhiteSpace(request.Subject))
        {
            return Result<EmailMessageDto>.Failure("Recipient and subject are required.");
        }

        var message = new EmailMessage
        {
            From = account.Email,
            To = request.To.Trim(),
            Subject = request.Subject.Trim(),
            Body = request.Body,
            Direction = "Outgoing",
            Status = "Queued"
        };

        db.EmailMessages.Add(message);

        foreach (var attachment in attachments)
        {
            db.EmailAttachments.Add(new EmailAttachment
            {
                EmailMessageId = message.Id,
                StoragePath = attachment.StoragePath
            });
        }

        foreach (var link in links)
        {
            db.EmailLinks.Add(new EmailLink
            {
                EmailMessageId = message.Id,
                Module = link.Module,
                EntityId = link.EntityId
            });
        }

        if (configuration.GetValue<bool>("Email:EnableSmtpSending"))
        {
            var sendResult = await TrySendSmtpAsync(account, request, attachments, cancellationToken);
            if (!sendResult.Succeeded)
            {
                message.Status = "Failed";
                await db.SaveChangesAsync(cancellationToken);
                return Result<EmailMessageDto>.Failure(sendResult.Error!);
            }

            message.Status = "Sent";
            message.SentAt = DateTimeOffset.UtcNow;
        }

        await db.SaveChangesAsync(cancellationToken);
        return Result<EmailMessageDto>.Success(Map(message));
    }

    private async Task<Result> TrySendSmtpAsync(MailAccount account, SendEmailRequest request, IReadOnlyList<StoredEmailAttachment> attachments, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(account.PasswordSecretName))
        {
            return Result.Failure("SMTP sending is enabled but no password secret name is configured for this account.");
        }

        var password = configuration[$"Secrets:{account.PasswordSecretName}"] ?? configuration[account.PasswordSecretName];
        if (string.IsNullOrWhiteSpace(password))
        {
            return Result.Failure($"SMTP password secret '{account.PasswordSecretName}' is missing from configuration.");
        }

        var mime = new MimeMessage();
        mime.From.Add(MailboxAddress.Parse(account.Email));
        mime.To.Add(MailboxAddress.Parse(request.To));
        mime.Subject = request.Subject;
        if (attachments.Count == 0)
        {
            mime.Body = new TextPart("plain") { Text = request.Body };
        }
        else
        {
            var builder = new BodyBuilder { TextBody = request.Body };
            foreach (var attachment in attachments)
            {
                await using var content = await fileStorageService.OpenReadAsync(attachment.StoragePath, cancellationToken);
                await builder.Attachments.AddAsync(attachment.FileName, content, ContentType.Parse(attachment.MimeType), cancellationToken);
            }

            mime.Body = builder.ToMessageBody();
        }

        using var smtp = new SmtpClient();
        await smtp.ConnectAsync(account.SmtpHost, account.SmtpPort, account.UseSsl, cancellationToken);
        await smtp.AuthenticateAsync(account.UserName ?? account.Email, password, cancellationToken);
        await smtp.SendAsync(mime, cancellationToken);
        await smtp.DisconnectAsync(true, cancellationToken);
        return Result.Success();
    }

    private static MailAccountDto Map(MailAccount account)
        => new(account.Id, account.Email, account.SmtpHost, account.SmtpPort, account.ImapHost, account.ImapPort, account.UseSsl, account.UserName, account.PasswordSecretName);

    private static EmailMessageDto Map(EmailMessage message)
        => new(message.Id, message.Subject, message.From, message.To, message.Direction, message.Status, message.IsRead, message.CreatedAt, message.SentAt);
}
