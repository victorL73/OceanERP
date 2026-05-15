namespace Erp.Application.Emails;

public sealed record MailServerSettingsDto(Guid? Id, string SmtpHost, int SmtpPort, string ImapHost, int ImapPort, bool UseSsl, bool ImapAutoSyncEnabled, int ImapSyncIntervalMinutes, bool IsConfigured);
public sealed record MailAccountDto(Guid Id, string Email, string? DisplayName, string? SignatureHtml, string SmtpHost, int SmtpPort, string ImapHost, int ImapPort, bool UseSsl, string? UserName, string? PasswordSecretName, bool HasPassword, bool IsActive, IReadOnlyList<Guid> AuthorizedUserIds);
public sealed record EmailAttachmentDto(Guid Id, string FileName, string MimeType, long Size, string StoragePath);
public sealed record EmailLinkDto(Guid Id, string Module, Guid EntityId);
public sealed record EmailMessageDto(Guid Id, Guid? MailAccountId, string Subject, string From, string To, string? Cc, string? Bcc, string Body, string Direction, string Status, bool IsRead, string? ErrorMessage, DateTimeOffset CreatedAt, DateTimeOffset? SentAt, DateTimeOffset? ReceivedAt, IReadOnlyList<EmailAttachmentDto> Attachments, IReadOnlyList<EmailLinkDto> Links);
public sealed record EmailTemplateDto(Guid Id, string Name, string Subject, string Body, bool IsActive, DateTimeOffset CreatedAt);
public sealed record EmailSyncAccountResultDto(Guid MailAccountId, string Email, int Imported, string? Error, IReadOnlyList<Guid> NotificationUserIds);
public sealed record EmailSyncSummaryDto(int Imported, IReadOnlyList<EmailSyncAccountResultDto> Accounts);
public sealed record CreateMailAccountRequest(string Email, string? SmtpHost = null, string? ImapHost = null, int SmtpPort = 587, int ImapPort = 993, bool UseSsl = true, string? UserName = null, string? PasswordSecretName = null, string? Password = null, string? DisplayName = null, string? SignatureHtml = null, bool IsActive = true, IReadOnlyList<Guid>? AuthorizedUserIds = null);
public sealed record UpdateMailAccountRequest(string Email, string? SmtpHost = null, string? ImapHost = null, int SmtpPort = 587, int ImapPort = 993, bool UseSsl = true, string? UserName = null, string? PasswordSecretName = null, string? Password = null, bool ClearPassword = false, string? DisplayName = null, string? SignatureHtml = null, bool IsActive = true, IReadOnlyList<Guid>? AuthorizedUserIds = null);
public sealed record UpdateMailServerSettingsRequest(string SmtpHost, string ImapHost, int SmtpPort = 587, int ImapPort = 993, bool UseSsl = true, bool ImapAutoSyncEnabled = true, int ImapSyncIntervalMinutes = 5);
public sealed record SendEmailRequest(Guid MailAccountId, string To, string Subject, string Body, string? Cc = null, string? Bcc = null);
public sealed record CreateEmailTemplateRequest(string Name, string Subject, string Body, bool IsActive = true);
public sealed record UpdateEmailTemplateRequest(string Name, string Subject, string Body, bool IsActive = true);
public sealed record StoredEmailAttachment(string FileName, string MimeType, string StoragePath, long Size = 0);
public sealed record EmailLinkTarget(string Module, Guid EntityId);
