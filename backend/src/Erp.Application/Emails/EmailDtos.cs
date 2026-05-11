namespace Erp.Application.Emails;

public sealed record MailAccountDto(Guid Id, string Email, string SmtpHost, int SmtpPort, string ImapHost, int ImapPort, bool UseSsl, string? UserName, string? PasswordSecretName);
public sealed record EmailMessageDto(Guid Id, string Subject, string From, string To, string Direction, string Status, bool IsRead, DateTimeOffset CreatedAt, DateTimeOffset? SentAt);
public sealed record CreateMailAccountRequest(string Email, string SmtpHost, string ImapHost, int SmtpPort = 587, int ImapPort = 993, bool UseSsl = true, string? UserName = null, string? PasswordSecretName = null);
public sealed record SendEmailRequest(Guid MailAccountId, string To, string Subject, string Body);
