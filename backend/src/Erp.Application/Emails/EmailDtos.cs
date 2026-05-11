namespace Erp.Application.Emails;

public sealed record MailAccountDto(Guid Id, string Email, string SmtpHost, string ImapHost);
public sealed record EmailMessageDto(Guid Id, string Subject, string From, string To, DateTimeOffset CreatedAt);
public sealed record CreateMailAccountRequest(string Email, string SmtpHost, string ImapHost);
public sealed record SendEmailRequest(Guid MailAccountId, string To, string Subject, string Body);

