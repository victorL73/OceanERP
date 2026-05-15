using Erp.Application.Common;

namespace Erp.Application.Emails;

public interface IEmailService
{
    Task<MailServerSettingsDto> GetServerSettingsAsync(CancellationToken cancellationToken);
    Task<Result<MailServerSettingsDto>> UpdateServerSettingsAsync(UpdateMailServerSettingsRequest request, CancellationToken cancellationToken);
    Task<IReadOnlyList<MailAccountDto>> GetAccountsAsync(CancellationToken cancellationToken);
    Task<Result<MailAccountDto>> CreateAccountAsync(CreateMailAccountRequest request, CancellationToken cancellationToken);
    Task<Result<MailAccountDto>> UpdateAccountAsync(Guid id, UpdateMailAccountRequest request, CancellationToken cancellationToken);
    Task<Result> DeleteAccountAsync(Guid id, CancellationToken cancellationToken);
    Task<Result> TestSmtpAsync(Guid id, CancellationToken cancellationToken);
    Task<Result<int>> SyncImapAsync(Guid id, int limit, CancellationToken cancellationToken);
    Task<Result<EmailSyncSummaryDto>> SyncAccessibleImapAsync(int limit, CancellationToken cancellationToken);
    Task<EmailSyncSummaryDto> SyncActiveImapAsync(int limit, CancellationToken cancellationToken);
    Task<PagedResult<EmailMessageDto>> GetMessagesAsync(string? search, Guid? accountId, int page, int pageSize, CancellationToken cancellationToken);
    Task<Result<EmailMessageDto>> GetMessageAsync(Guid id, CancellationToken cancellationToken);
    Task<Result<EmailMessageDto>> MarkReadAsync(Guid id, bool isRead, CancellationToken cancellationToken);
    Task<Result<(Stream Content, string FileName, string MimeType)>> OpenAttachmentAsync(Guid messageId, Guid attachmentId, CancellationToken cancellationToken);
    Task<Result<EmailMessageDto>> SendAsync(SendEmailRequest request, CancellationToken cancellationToken);
    Task<Result<EmailMessageDto>> SendAsync(SendEmailRequest request, IReadOnlyList<StoredEmailAttachment> attachments, IReadOnlyList<EmailLinkTarget> links, CancellationToken cancellationToken);
    Task<IReadOnlyList<EmailTemplateDto>> GetTemplatesAsync(CancellationToken cancellationToken);
    Task<Result<EmailTemplateDto>> CreateTemplateAsync(CreateEmailTemplateRequest request, CancellationToken cancellationToken);
    Task<Result<EmailTemplateDto>> UpdateTemplateAsync(Guid id, UpdateEmailTemplateRequest request, CancellationToken cancellationToken);
    Task<Result> DeleteTemplateAsync(Guid id, CancellationToken cancellationToken);
}
