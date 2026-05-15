using Erp.Application.Common;
using Erp.Application.Documents;
using Erp.Application.Emails;
using Erp.Domain.FutureModules;
using Erp.Infrastructure.Persistence;
using MailKit;
using MailKit.Net.Imap;
using MailKit.Net.Smtp;
using MailKit.Search;
using MailKit.Security;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using MimeKit;

namespace Erp.Infrastructure.Services;

public sealed class EmailService(ErpDbContext db, IConfiguration configuration, IFileStorageService fileStorageService, ICurrentUserService currentUser) : IEmailService
{
    private const string IncomingAttachmentFolder = "email-attachments";

    private sealed record MailServerValues(string SmtpHost, int SmtpPort, string ImapHost, int ImapPort, bool UseSsl);

    public async Task<MailServerSettingsDto> GetServerSettingsAsync(CancellationToken cancellationToken)
    {
        var settings = await db.MailServerSettings
            .OrderBy(x => x.CreatedAt)
            .FirstOrDefaultAsync(cancellationToken);
        return Map(settings);
    }

    public async Task<Result<MailServerSettingsDto>> UpdateServerSettingsAsync(UpdateMailServerSettingsRequest request, CancellationToken cancellationToken)
    {
        if (!await IsAdministratorAsync(cancellationToken))
        {
            return Result<MailServerSettingsDto>.Failure("Seul un administrateur peut modifier les serveurs SMTP/IMAP.");
        }

        var validation = ValidateServerSettings(request.SmtpHost, request.ImapHost, request.SmtpPort, request.ImapPort);
        if (!validation.Succeeded)
        {
            return Result<MailServerSettingsDto>.Failure(validation.Error!);
        }

        if (request.ImapSyncIntervalMinutes is < 1 or > 1440)
        {
            return Result<MailServerSettingsDto>.Failure("L'intervalle de synchronisation IMAP doit etre compris entre 1 et 1440 minutes.");
        }

        var settings = await db.MailServerSettings
            .OrderBy(x => x.CreatedAt)
            .FirstOrDefaultAsync(cancellationToken);
        if (settings is null)
        {
            settings = new MailServerSettings();
            db.MailServerSettings.Add(settings);
        }

        ApplyServerSettings(settings, request.SmtpHost, request.SmtpPort, request.ImapHost, request.ImapPort, request.UseSsl, request.ImapAutoSyncEnabled, request.ImapSyncIntervalMinutes);

        var accounts = await db.MailAccounts.ToListAsync(cancellationToken);
        foreach (var account in accounts)
        {
            account.SmtpHost = settings.SmtpHost;
            account.SmtpPort = settings.SmtpPort;
            account.ImapHost = settings.ImapHost;
            account.ImapPort = settings.ImapPort;
            account.UseSsl = settings.UseSsl;
        }

        await db.SaveChangesAsync(cancellationToken);
        return Result<MailServerSettingsDto>.Success(Map(settings));
    }

    public async Task<IReadOnlyList<MailAccountDto>> GetAccountsAsync(CancellationToken cancellationToken)
    {
        var query = db.MailAccounts.Include(x => x.Accesses).AsQueryable();
        if (!await IsAdministratorAsync(cancellationToken))
        {
            if (currentUser.UserId is not { } userId)
            {
                return [];
            }

            query = query.Where(x => x.CreatedByUserId == userId || x.Accesses.Any(access => access.UserId == userId));
        }

        var accounts = await query
            .OrderByDescending(x => x.IsActive)
            .ThenBy(x => x.Email)
            .ToListAsync(cancellationToken);

        return accounts.Select(Map).ToList();
    }

    public async Task<Result<MailAccountDto>> CreateAccountAsync(CreateMailAccountRequest request, CancellationToken cancellationToken)
    {
        if (!await IsAdministratorAsync(cancellationToken))
        {
            return Result<MailAccountDto>.Failure("Seul un administrateur peut creer une boite mail.");
        }

        var validation = ValidateAccount(request.Email);
        if (!validation.Succeeded)
        {
            return Result<MailAccountDto>.Failure(validation.Error!);
        }

        var serverValues = await ResolveServerValuesAsync(request.SmtpHost, request.SmtpPort, request.ImapHost, request.ImapPort, request.UseSsl, cancellationToken);
        if (!serverValues.Succeeded)
        {
            return Result<MailAccountDto>.Failure(serverValues.Error!);
        }

        var account = new MailAccount();
        ApplyAccount(account, request.Email, serverValues.Value!, request.UserName, request.PasswordSecretName, request.DisplayName, request.SignatureHtml, request.IsActive);
        SetPassword(account, request.Password, clearPassword: false);
        var accessResult = await ApplyAccessesAsync(account, request.AuthorizedUserIds, cancellationToken);
        if (!accessResult.Succeeded)
        {
            return Result<MailAccountDto>.Failure(accessResult.Error!);
        }

        db.MailAccounts.Add(account);
        await db.SaveChangesAsync(cancellationToken);
        return Result<MailAccountDto>.Success(Map(account));
    }

    public async Task<Result<MailAccountDto>> UpdateAccountAsync(Guid id, UpdateMailAccountRequest request, CancellationToken cancellationToken)
    {
        var account = await db.MailAccounts.Include(x => x.Accesses).FirstOrDefaultAsync(x => x.Id == id, cancellationToken);
        if (account is null)
        {
            return Result<MailAccountDto>.Failure("Compte mail introuvable.");
        }

        var isAdministrator = await IsAdministratorAsync(cancellationToken);
        if (!isAdministrator && !await CanAccessAccountAsync(account.Id, cancellationToken))
        {
            return Result<MailAccountDto>.Failure("Vous ne pouvez pas modifier cette boite mail.");
        }

        if (!isAdministrator)
        {
            account.DisplayName = NormalizeOptional(request.DisplayName);
            account.SignatureHtml = NormalizeSignature(request.SignatureHtml);
            await db.SaveChangesAsync(cancellationToken);
            return Result<MailAccountDto>.Success(Map(account));
        }

        var validation = ValidateAccount(request.Email);
        if (!validation.Succeeded)
        {
            return Result<MailAccountDto>.Failure(validation.Error!);
        }

        var serverValues = await ResolveServerValuesAsync(request.SmtpHost, request.SmtpPort, request.ImapHost, request.ImapPort, request.UseSsl, cancellationToken);
        if (!serverValues.Succeeded)
        {
            return Result<MailAccountDto>.Failure(serverValues.Error!);
        }

        ApplyAccount(account, request.Email, serverValues.Value!, request.UserName, request.PasswordSecretName, request.DisplayName, request.SignatureHtml, request.IsActive);
        SetPassword(account, request.Password, request.ClearPassword);
        var accessResult = await ApplyAccessesAsync(account, request.AuthorizedUserIds, cancellationToken);
        if (!accessResult.Succeeded)
        {
            return Result<MailAccountDto>.Failure(accessResult.Error!);
        }

        await db.SaveChangesAsync(cancellationToken);
        return Result<MailAccountDto>.Success(Map(account));
    }

    public async Task<Result> DeleteAccountAsync(Guid id, CancellationToken cancellationToken)
    {
        var account = await db.MailAccounts.FirstOrDefaultAsync(x => x.Id == id, cancellationToken);
        if (account is null)
        {
            return Result.Failure("Compte mail introuvable.");
        }

        if (!await IsAdministratorAsync(cancellationToken))
        {
            return Result.Failure("Seul un administrateur peut supprimer une boite mail.");
        }

        db.MailAccounts.Remove(account);
        await db.SaveChangesAsync(cancellationToken);
        return Result.Success();
    }

    public async Task<Result> TestSmtpAsync(Guid id, CancellationToken cancellationToken)
    {
        var account = await db.MailAccounts.FirstOrDefaultAsync(x => x.Id == id, cancellationToken);
        if (account is null)
        {
            return Result.Failure("Compte mail introuvable.");
        }

        if (!await CanAccessAccountAsync(account.Id, cancellationToken))
        {
            return Result.Failure("Vous n'avez pas acces a cette boite mail.");
        }

        var serverValues = await ResolveEffectiveServerValuesAsync(account, cancellationToken);
        if (!serverValues.Succeeded)
        {
            return Result.Failure(serverValues.Error!);
        }

        var password = ResolvePassword(account);
        if (!password.Succeeded)
        {
            return Result.Failure(password.Error!);
        }

        try
        {
            using var smtp = new SmtpClient();
            await smtp.ConnectAsync(serverValues.Value!.SmtpHost, serverValues.Value.SmtpPort, ResolveSmtpSocketOptions(serverValues.Value), cancellationToken);
            await smtp.AuthenticateAsync(account.UserName ?? account.Email, password.Value!, cancellationToken);
            await smtp.DisconnectAsync(true, cancellationToken);
            return Result.Success();
        }
        catch (Exception ex)
        {
            return Result.Failure($"Test SMTP impossible: {ex.Message}");
        }
    }

    public async Task<Result<int>> SyncImapAsync(Guid id, int limit, CancellationToken cancellationToken)
    {
        var account = await db.MailAccounts.FirstOrDefaultAsync(x => x.Id == id && x.IsActive, cancellationToken);
        if (account is null)
        {
            return Result<int>.Failure("Compte mail introuvable ou inactif.");
        }

        if (!await CanAccessAccountAsync(account.Id, cancellationToken))
        {
            return Result<int>.Failure("Vous n'avez pas acces a cette boite mail.");
        }

        return await SyncAccountAsync(account, limit, cancellationToken);
    }

    public async Task<Result<EmailSyncSummaryDto>> SyncAccessibleImapAsync(int limit, CancellationToken cancellationToken)
    {
        var query = db.MailAccounts.Include(x => x.Accesses).Where(x => x.IsActive);
        if (!await IsAdministratorAsync(cancellationToken))
        {
            if (currentUser.UserId is not { } userId)
            {
                return Result<EmailSyncSummaryDto>.Failure("Utilisateur non authentifie.");
            }

            query = query.Where(x => x.CreatedByUserId == userId || x.Accesses.Any(access => access.UserId == userId));
        }

        var accounts = await query
            .OrderBy(x => x.Email)
            .ToListAsync(cancellationToken);

        return Result<EmailSyncSummaryDto>.Success(await SyncAccountsAsync(accounts, limit, cancellationToken));
    }

    public async Task<EmailSyncSummaryDto> SyncActiveImapAsync(int limit, CancellationToken cancellationToken)
    {
        var accounts = await db.MailAccounts
            .Include(x => x.Accesses)
            .Where(x => x.IsActive)
            .OrderBy(x => x.Email)
            .ToListAsync(cancellationToken);

        return await SyncAccountsAsync(accounts, limit, cancellationToken);
    }

    public async Task<PagedResult<EmailMessageDto>> GetMessagesAsync(string? search, Guid? accountId, int page, int pageSize, CancellationToken cancellationToken)
    {
        page = Math.Max(1, page);
        pageSize = Math.Clamp(pageSize, 1, 100);
        var query = await ApplyMessageAccessAsync(BaseMessagesQuery(), cancellationToken);

        if (accountId.HasValue)
        {
            if (!await CanAccessAccountAsync(accountId.Value, cancellationToken))
            {
                return new PagedResult<EmailMessageDto>([], 0, page, pageSize);
            }

            query = query.Where(x => x.MailAccountId == accountId.Value);
        }

        if (!string.IsNullOrWhiteSpace(search))
        {
            var term = search.Trim();
            query = query.Where(x => x.Subject.Contains(term) || x.From.Contains(term) || x.To.Contains(term) || (x.Cc != null && x.Cc.Contains(term)) || (x.Bcc != null && x.Bcc.Contains(term)) || x.Body.Contains(term));
        }

        var total = await query.CountAsync(cancellationToken);
        var messages = await query
            .OrderByDescending(x => x.ReceivedAt ?? x.SentAt ?? x.CreatedAt)
            .ThenByDescending(x => x.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(cancellationToken);

        return new PagedResult<EmailMessageDto>(await MapManyAsync(messages, cancellationToken), total, page, pageSize);
    }

    public async Task<Result<EmailMessageDto>> GetMessageAsync(Guid id, CancellationToken cancellationToken)
    {
        var message = await (await ApplyMessageAccessAsync(db.EmailMessages.AsQueryable(), cancellationToken)).FirstOrDefaultAsync(x => x.Id == id, cancellationToken);
        if (message is null)
        {
            return Result<EmailMessageDto>.Failure("Email introuvable.");
        }

        if (ShouldRefreshFromImap(message))
        {
            await TryRefreshMessageFromImapAsync(message, cancellationToken);
        }

        return Result<EmailMessageDto>.Success(await MapAsync(message, cancellationToken));
    }

    public async Task<Result<EmailMessageDto>> MarkReadAsync(Guid id, bool isRead, CancellationToken cancellationToken)
    {
        var message = await (await ApplyMessageAccessAsync(db.EmailMessages.AsQueryable(), cancellationToken)).FirstOrDefaultAsync(x => x.Id == id, cancellationToken);
        if (message is null)
        {
            return Result<EmailMessageDto>.Failure("Email introuvable.");
        }

        message.IsRead = isRead;
        await db.SaveChangesAsync(cancellationToken);
        var loaded = await BaseMessagesQuery().FirstAsync(x => x.Id == id, cancellationToken);
        return Result<EmailMessageDto>.Success(await MapAsync(loaded, cancellationToken));
    }

    public async Task<Result> DeleteMessageAsync(Guid id, CancellationToken cancellationToken)
    {
        var message = await (await ApplyMessageAccessAsync(db.EmailMessages.AsQueryable(), cancellationToken)).FirstOrDefaultAsync(x => x.Id == id, cancellationToken);
        if (message is null)
        {
            return Result.Failure("Email introuvable.");
        }

        message.IsDeleted = true;
        message.DeletedAt = DateTimeOffset.UtcNow;
        message.IsRead = true;
        await db.SaveChangesAsync(cancellationToken);
        return Result.Success();
    }

    public async Task<Result<(Stream Content, string FileName, string MimeType)>> OpenAttachmentAsync(Guid messageId, Guid attachmentId, CancellationToken cancellationToken)
    {
        var canAccessMessage = await (await ApplyMessageAccessAsync(BaseMessagesQuery(), cancellationToken)).AnyAsync(x => x.Id == messageId, cancellationToken);
        if (!canAccessMessage)
        {
            return Result<(Stream, string, string)>.Failure("Email introuvable.");
        }

        var attachment = await db.EmailAttachments
            .AsNoTracking()
            .FirstOrDefaultAsync(x => x.Id == attachmentId && x.EmailMessageId == messageId, cancellationToken);
        if (attachment is null)
        {
            return Result<(Stream, string, string)>.Failure("Piece jointe email introuvable.");
        }

        var stream = await fileStorageService.OpenReadAsync(attachment.StoragePath, cancellationToken);
        return Result<(Stream, string, string)>.Success((stream, attachment.FileName, attachment.MimeType));
    }

    public Task<Result<EmailMessageDto>> SendAsync(SendEmailRequest request, CancellationToken cancellationToken)
        => SendAsync(request, [], [], cancellationToken);

    public async Task<Result<EmailMessageDto>> SendAsync(SendEmailRequest request, IReadOnlyList<StoredEmailAttachment> attachments, IReadOnlyList<EmailLinkTarget> links, CancellationToken cancellationToken)
    {
        var account = await db.MailAccounts.FirstOrDefaultAsync(x => x.Id == request.MailAccountId && x.IsActive, cancellationToken);
        if (account is null)
        {
            return Result<EmailMessageDto>.Failure("Compte mail introuvable ou inactif.");
        }

        if (!await CanAccessAccountAsync(account.Id, cancellationToken))
        {
            return Result<EmailMessageDto>.Failure("Vous n'avez pas acces a cette boite mail.");
        }

        var recipients = ParseAddresses(request.To, "Destinataire");
        if (!recipients.Succeeded)
        {
            return Result<EmailMessageDto>.Failure(recipients.Error!);
        }

        var ccRecipients = ParseOptionalAddresses(request.Cc, "Cc");
        if (!ccRecipients.Succeeded)
        {
            return Result<EmailMessageDto>.Failure(ccRecipients.Error!);
        }

        var bccRecipients = ParseOptionalAddresses(request.Bcc, "Cci");
        if (!bccRecipients.Succeeded)
        {
            return Result<EmailMessageDto>.Failure(bccRecipients.Error!);
        }

        if (string.IsNullOrWhiteSpace(request.Subject))
        {
            return Result<EmailMessageDto>.Failure("Sujet obligatoire.");
        }

        var smtpSendingEnabled = configuration.GetValue<bool>("Email:EnableSmtpSending");
        var body = ApplySignature(request.Body, account.SignatureHtml);
        var message = new EmailMessage
        {
            MailAccountId = account.Id,
            From = account.Email,
            To = FormatAddressList(recipients.Value!),
            Cc = FormatOptionalAddressList(ccRecipients.Value!),
            Bcc = FormatOptionalAddressList(bccRecipients.Value!),
            Subject = request.Subject.Trim(),
            Body = body,
            Direction = "Outgoing",
            Status = smtpSendingEnabled ? "Queued" : "Logged",
            ErrorMessage = smtpSendingEnabled ? null : "Envoi SMTP reel desactive sur le serveur (EMAIL_ENABLE_SMTP_SENDING=false).",
            IsRead = true
        };

        db.EmailMessages.Add(message);
        foreach (var attachment in attachments)
        {
            db.EmailAttachments.Add(new EmailAttachment
            {
                EmailMessageId = message.Id,
                FileName = attachment.FileName,
                MimeType = attachment.MimeType,
                StoragePath = attachment.StoragePath,
                Size = attachment.Size
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

        if (smtpSendingEnabled)
        {
            var sendResult = await TrySendSmtpAsync(account, request.Subject, body, attachments, recipients.Value!, ccRecipients.Value!, bccRecipients.Value!, cancellationToken);
            if (!sendResult.Succeeded)
            {
                message.Status = "Failed";
                message.ErrorMessage = sendResult.Error;
                await db.SaveChangesAsync(cancellationToken);
                return Result<EmailMessageDto>.Failure(sendResult.Error!);
            }

            message.Status = "Sent";
            message.SentAt = DateTimeOffset.UtcNow;
        }

        await db.SaveChangesAsync(cancellationToken);
        var loaded = await BaseMessagesQuery().FirstAsync(x => x.Id == message.Id, cancellationToken);
        return Result<EmailMessageDto>.Success(await MapAsync(loaded, cancellationToken));
    }

    public async Task<IReadOnlyList<EmailTemplateDto>> GetTemplatesAsync(CancellationToken cancellationToken)
        => await db.EmailTemplates
            .OrderByDescending(x => x.IsActive)
            .ThenBy(x => x.Name)
            .Select(x => Map(x))
            .ToListAsync(cancellationToken);

    public async Task<Result<EmailTemplateDto>> CreateTemplateAsync(CreateEmailTemplateRequest request, CancellationToken cancellationToken)
    {
        var validation = ValidateTemplate(request.Name, request.Subject, request.Body);
        if (!validation.Succeeded)
        {
            return Result<EmailTemplateDto>.Failure(validation.Error!);
        }

        var template = new EmailTemplate
        {
            Name = request.Name.Trim(),
            Subject = request.Subject.Trim(),
            Body = request.Body,
            IsActive = request.IsActive
        };
        db.EmailTemplates.Add(template);
        await db.SaveChangesAsync(cancellationToken);
        return Result<EmailTemplateDto>.Success(Map(template));
    }

    public async Task<Result<EmailTemplateDto>> UpdateTemplateAsync(Guid id, UpdateEmailTemplateRequest request, CancellationToken cancellationToken)
    {
        var template = await db.EmailTemplates.FirstOrDefaultAsync(x => x.Id == id, cancellationToken);
        if (template is null)
        {
            return Result<EmailTemplateDto>.Failure("Modele email introuvable.");
        }

        var validation = ValidateTemplate(request.Name, request.Subject, request.Body);
        if (!validation.Succeeded)
        {
            return Result<EmailTemplateDto>.Failure(validation.Error!);
        }

        template.Name = request.Name.Trim();
        template.Subject = request.Subject.Trim();
        template.Body = request.Body;
        template.IsActive = request.IsActive;
        await db.SaveChangesAsync(cancellationToken);
        return Result<EmailTemplateDto>.Success(Map(template));
    }

    public async Task<Result> DeleteTemplateAsync(Guid id, CancellationToken cancellationToken)
    {
        var template = await db.EmailTemplates.FirstOrDefaultAsync(x => x.Id == id, cancellationToken);
        if (template is null)
        {
            return Result.Failure("Modele email introuvable.");
        }

        db.EmailTemplates.Remove(template);
        await db.SaveChangesAsync(cancellationToken);
        return Result.Success();
    }

    private async Task<Result> TrySendSmtpAsync(MailAccount account, string subject, string body, IReadOnlyList<StoredEmailAttachment> attachments, InternetAddressList recipients, InternetAddressList ccRecipients, InternetAddressList bccRecipients, CancellationToken cancellationToken)
    {
        var serverValues = await ResolveEffectiveServerValuesAsync(account, cancellationToken);
        if (!serverValues.Succeeded)
        {
            return Result.Failure(serverValues.Error!);
        }

        var password = ResolvePassword(account);
        if (!password.Succeeded)
        {
            return Result.Failure(password.Error!);
        }

        try
        {
            var mime = new MimeMessage();
            var envelopeSender = new MailboxAddress(account.DisplayName ?? account.Email, account.Email);
            mime.From.Add(envelopeSender);
            mime.To.AddRange(recipients);
            mime.Cc.AddRange(ccRecipients);
            mime.Subject = subject;
            var envelopeRecipients = recipients.Mailboxes
                .Concat(ccRecipients.Mailboxes)
                .Concat(bccRecipients.Mailboxes)
                .DistinctBy(x => x.Address, StringComparer.OrdinalIgnoreCase)
                .ToList();

            var builder = new BodyBuilder();
            if (LooksLikeHtml(body))
            {
                builder.HtmlBody = body;
                builder.TextBody = StripHtmlFallback(body);
            }
            else
            {
                builder.TextBody = body;
            }

            foreach (var attachment in attachments)
            {
                await using var content = await fileStorageService.OpenReadAsync(attachment.StoragePath, cancellationToken);
                await builder.Attachments.AddAsync(attachment.FileName, content, ContentType.Parse(attachment.MimeType), cancellationToken);
            }

            mime.Body = builder.ToMessageBody();

            using var smtp = new SmtpClient();
            await smtp.ConnectAsync(serverValues.Value!.SmtpHost, serverValues.Value.SmtpPort, ResolveSmtpSocketOptions(serverValues.Value), cancellationToken);
            await smtp.AuthenticateAsync(account.UserName ?? account.Email, password.Value!, cancellationToken);
            await smtp.SendAsync(FormatOptions.Default, mime, envelopeSender, envelopeRecipients, cancellationToken);
            await smtp.DisconnectAsync(true, cancellationToken);
            return Result.Success();
        }
        catch (Exception ex)
        {
            return Result.Failure($"Envoi SMTP impossible: {ex.Message}");
        }
    }

    private IQueryable<EmailMessage> BaseMessagesQuery()
        => db.EmailMessages.AsNoTracking().Where(x => !x.IsDeleted);

    private async Task<EmailSyncSummaryDto> SyncAccountsAsync(IReadOnlyList<MailAccount> accounts, int limit, CancellationToken cancellationToken)
    {
        var results = new List<EmailSyncAccountResultDto>();
        foreach (var account in accounts)
        {
            var result = await SyncAccountAsync(account, limit, cancellationToken);
            results.Add(new EmailSyncAccountResultDto(
                account.Id,
                account.Email,
                result.Succeeded ? result.Value : 0,
                result.Succeeded ? null : result.Error,
                NotificationUserIds(account)));
        }

        return new EmailSyncSummaryDto(results.Sum(x => x.Imported), results);
    }

    private async Task<Result<int>> SyncAccountAsync(MailAccount account, int limit, CancellationToken cancellationToken)
    {
        var serverValues = await ResolveEffectiveServerValuesAsync(account, cancellationToken);
        if (!serverValues.Succeeded)
        {
            return Result<int>.Failure(serverValues.Error!);
        }

        var password = ResolvePassword(account);
        if (!password.Succeeded)
        {
            return Result<int>.Failure(password.Error!);
        }

        try
        {
            using var imap = new ImapClient();
            await imap.ConnectAsync(serverValues.Value!.ImapHost, serverValues.Value.ImapPort, ResolveImapSocketOptions(serverValues.Value), cancellationToken);
            await imap.AuthenticateAsync(account.UserName ?? account.Email, password.Value!, cancellationToken);

            var inbox = imap.Inbox ?? throw new InvalidOperationException("Boite de reception IMAP introuvable.");
            await inbox.OpenAsync(FolderAccess.ReadOnly, cancellationToken);
            var uids = await inbox.SearchAsync(SearchQuery.All, cancellationToken);
            var latestUids = uids.OrderByDescending(x => x.Id).Take(Math.Clamp(limit, 1, 200)).Reverse().ToList();
            var imported = 0;

            foreach (var uid in latestUids)
            {
                var mime = await inbox.GetMessageAsync(uid, cancellationToken);
                var externalMessageId = NormalizeLength(
                    string.IsNullOrWhiteSpace(mime.MessageId) ? $"imap:{uid.Id}" : mime.MessageId,
                    512) ?? $"imap:{uid.Id}";
                var body = BuildIncomingBody(mime);
                var existingMessage = await db.EmailMessages.FirstOrDefaultAsync(x => x.MailAccountId == account.Id && x.ExternalMessageId == externalMessageId, cancellationToken);
                if (existingMessage is not null)
                {
                    if (existingMessage.IsDeleted)
                    {
                        continue;
                    }

                    if (LooksLikeHtml(body) && !LooksLikeHtml(existingMessage.Body))
                    {
                        existingMessage.Body = body;
                        existingMessage.ReceivedAt ??= NormalizeMailDate(mime.Date);
                    }

                    existingMessage.Cc ??= NormalizeLength(mime.Cc.ToString(), 1000);
                    existingMessage.Bcc ??= NormalizeLength(mime.Bcc.ToString(), 1000);
                    continue;
                }

                var message = new EmailMessage
                {
                    MailAccountId = account.Id,
                    ExternalMessageId = externalMessageId,
                    Subject = NormalizeLength(mime.Subject, 300) ?? "(Sans sujet)",
                    From = NormalizeLength(mime.From.Mailboxes.FirstOrDefault()?.Address ?? mime.From.ToString(), 320) ?? string.Empty,
                    To = NormalizeLength(mime.To.ToString(), 1000) ?? account.Email,
                    Cc = NormalizeLength(mime.Cc.ToString(), 1000),
                    Bcc = NormalizeLength(mime.Bcc.ToString(), 1000),
                    Body = body,
                    Direction = "Incoming",
                    Status = "Received",
                    IsRead = false,
                    ReceivedAt = NormalizeMailDate(mime.Date)
                };

                db.EmailMessages.Add(message);
                await StoreIncomingAttachmentsAsync(message, mime, cancellationToken);
                imported++;
            }

            await db.SaveChangesAsync(cancellationToken);
            await imap.DisconnectAsync(true, cancellationToken);
            return Result<int>.Success(imported);
        }
        catch (DbUpdateException ex)
        {
            return Result<int>.Failure($"Synchronisation IMAP impossible: {FormatDatabaseError(ex)}");
        }
        catch (Exception ex)
        {
            return Result<int>.Failure($"Synchronisation IMAP impossible: {ex.Message}");
        }
    }

    private static IReadOnlyList<Guid> NotificationUserIds(MailAccount account)
    {
        var userIds = account.Accesses.Select(x => x.UserId).ToList();
        if (account.CreatedByUserId is Guid createdByUserId)
        {
            userIds.Add(createdByUserId);
        }

        return userIds.Distinct().OrderBy(x => x).ToList();
    }

    private async Task StoreIncomingAttachmentsAsync(EmailMessage message, MimeMessage mime, CancellationToken cancellationToken)
    {
        foreach (var attachment in mime.Attachments)
        {
            if (attachment is MimePart mimePart)
            {
                await StoreIncomingMimePartAttachmentAsync(message, mimePart, cancellationToken);
                continue;
            }

            if (attachment is MessagePart messagePart)
            {
                await StoreIncomingMessageAttachmentAsync(message, messagePart, cancellationToken);
            }
        }
    }

    private async Task StoreIncomingMimePartAttachmentAsync(EmailMessage message, MimePart attachment, CancellationToken cancellationToken)
    {
        var sourceFileName = string.IsNullOrWhiteSpace(attachment.FileName) ? $"piece-jointe-{Guid.NewGuid():N}.bin" : attachment.FileName;
        var fileName = NormalizeLength(sourceFileName, 260) ?? $"piece-jointe-{Guid.NewGuid():N}.bin";
        if (attachment.Content is null)
        {
            return;
        }

        await using var stream = new MemoryStream();
        await attachment.Content.DecodeToAsync(stream, cancellationToken);
        stream.Position = 0;
        var stored = await fileStorageService.SaveAsync(IncomingAttachmentFolder, fileName, stream, cancellationToken);
        db.EmailAttachments.Add(new EmailAttachment
        {
            EmailMessageId = message.Id,
            FileName = fileName,
            MimeType = NormalizeLength(attachment.ContentType.MimeType, 120) ?? "application/octet-stream",
            StoragePath = stored.StoragePath,
            Size = stored.Size
        });
    }

    private async Task StoreIncomingMessageAttachmentAsync(EmailMessage message, MessagePart attachment, CancellationToken cancellationToken)
    {
        var attachmentName = attachment.ContentDisposition?.FileName ?? attachment.ContentType.Name;
        var sourceFileName = string.IsNullOrWhiteSpace(attachmentName) ? $"email-joint-{Guid.NewGuid():N}.eml" : attachmentName;
        var fileName = NormalizeLength(sourceFileName, 260) ?? $"email-joint-{Guid.NewGuid():N}.eml";
        if (attachment.Message is null)
        {
            return;
        }

        await using var stream = new MemoryStream();
        await attachment.Message.WriteToAsync(stream, cancellationToken);
        stream.Position = 0;
        var stored = await fileStorageService.SaveAsync(IncomingAttachmentFolder, fileName, stream, cancellationToken);
        db.EmailAttachments.Add(new EmailAttachment
        {
            EmailMessageId = message.Id,
            FileName = fileName,
            MimeType = "message/rfc822",
            StoragePath = stored.StoragePath,
            Size = stored.Size
        });
    }

    private bool ShouldRefreshFromImap(EmailMessage message)
        => message.Direction.Equals("Incoming", StringComparison.OrdinalIgnoreCase)
            && message.MailAccountId.HasValue
            && !LooksLikeHtml(message.Body);

    private async Task TryRefreshMessageFromImapAsync(EmailMessage message, CancellationToken cancellationToken)
    {
        if (!message.MailAccountId.HasValue || string.IsNullOrWhiteSpace(message.ExternalMessageId))
        {
            return;
        }

        var account = await db.MailAccounts.FirstOrDefaultAsync(x => x.Id == message.MailAccountId.Value && x.IsActive, cancellationToken);
        if (account is null)
        {
            return;
        }

        var serverValues = await ResolveEffectiveServerValuesAsync(account, cancellationToken);
        var password = ResolvePassword(account);
        if (!serverValues.Succeeded || !password.Succeeded)
        {
            return;
        }

        try
        {
            using var imap = new ImapClient();
            await imap.ConnectAsync(serverValues.Value!.ImapHost, serverValues.Value.ImapPort, ResolveImapSocketOptions(serverValues.Value), cancellationToken);
            await imap.AuthenticateAsync(account.UserName ?? account.Email, password.Value!, cancellationToken);

            var inbox = imap.Inbox ?? throw new InvalidOperationException("Boite de reception IMAP introuvable.");
            await inbox.OpenAsync(FolderAccess.ReadOnly, cancellationToken);
            var uids = await FindMessageUidsAsync(inbox, message.ExternalMessageId, cancellationToken);
            if (uids.Count == 0)
            {
                await imap.DisconnectAsync(true, cancellationToken);
                return;
            }

            var mime = await inbox.GetMessageAsync(uids[^1], cancellationToken);
            var body = BuildIncomingBody(mime);
            if (!string.IsNullOrWhiteSpace(body))
            {
                message.Body = body;
            }

            message.Subject = NormalizeLength(mime.Subject, 300) ?? message.Subject;
            message.From = NormalizeLength(mime.From.Mailboxes.FirstOrDefault()?.Address ?? mime.From.ToString(), 320) ?? message.From;
            message.To = NormalizeLength(mime.To.ToString(), 1000) ?? message.To;
            message.Cc = NormalizeLength(mime.Cc.ToString(), 1000);
            message.Bcc = NormalizeLength(mime.Bcc.ToString(), 1000);
            message.ReceivedAt = NormalizeMailDate(mime.Date);
            await ReplaceIncomingAttachmentsAsync(message, mime, cancellationToken);
            await db.SaveChangesAsync(cancellationToken);
            await imap.DisconnectAsync(true, cancellationToken);
        }
        catch
        {
            // L'ouverture d'un email ne doit pas echouer si le serveur IMAP est temporairement indisponible.
        }
    }

    private static async Task<IList<UniqueId>> FindMessageUidsAsync(IMailFolder inbox, string externalMessageId, CancellationToken cancellationToken)
    {
        var normalized = externalMessageId.Trim();
        if (normalized.StartsWith("imap:", StringComparison.OrdinalIgnoreCase))
        {
            return [];
        }

        var candidates = new[]
            {
                normalized,
                normalized.Trim('<', '>'),
                $"<{normalized.Trim('<', '>')}>"
            }
            .Where(value => !string.IsNullOrWhiteSpace(value))
            .Distinct(StringComparer.OrdinalIgnoreCase);

        foreach (var candidate in candidates)
        {
            var uids = await inbox.SearchAsync(SearchQuery.HeaderContains("Message-ID", candidate), cancellationToken);
            if (uids.Count > 0)
            {
                return uids;
            }
        }

        return [];
    }

    private async Task ReplaceIncomingAttachmentsAsync(EmailMessage message, MimeMessage mime, CancellationToken cancellationToken)
    {
        var attachments = await db.EmailAttachments.Where(x => x.EmailMessageId == message.Id).ToListAsync(cancellationToken);
        foreach (var attachment in attachments)
        {
            await fileStorageService.DeleteAsync(attachment.StoragePath, cancellationToken);
        }

        db.EmailAttachments.RemoveRange(attachments);
        await StoreIncomingAttachmentsAsync(message, mime, cancellationToken);
    }

    private static string BuildIncomingBody(MimeMessage mime)
    {
        var htmlBody = FindHtmlBody(mime);
        if (!string.IsNullOrWhiteSpace(htmlBody))
        {
            return CleanDatabaseText(EmbedInlineImages(htmlBody, mime));
        }

        return CleanDatabaseText(FindTextBody(mime) ?? string.Empty);
    }

    private static string? FindHtmlBody(MimeMessage mime)
        => !string.IsNullOrWhiteSpace(mime.HtmlBody)
            ? mime.HtmlBody
            : mime.BodyParts
                .OfType<TextPart>()
                .FirstOrDefault(part => part.IsHtml || part.ContentType.MimeType.Equals("text/html", StringComparison.OrdinalIgnoreCase))
                ?.Text;

    private static string? FindTextBody(MimeMessage mime)
        => !string.IsNullOrWhiteSpace(mime.TextBody)
            ? mime.TextBody
            : mime.BodyParts
                .OfType<TextPart>()
                .FirstOrDefault(part => part.IsPlain || part.ContentType.MimeType.Equals("text/plain", StringComparison.OrdinalIgnoreCase))
                ?.Text;

    private static string EmbedInlineImages(string html, MimeMessage mime)
    {
        var inlineImages = mime.BodyParts
            .OfType<MimePart>()
            .Where(part => !string.IsNullOrWhiteSpace(part.ContentId) && part.Content is not null && part.ContentType.MimeType.StartsWith("image/", StringComparison.OrdinalIgnoreCase))
            .GroupBy(part => NormalizeContentId(part.ContentId!), StringComparer.OrdinalIgnoreCase)
            .ToDictionary(group => group.Key, group => group.First(), StringComparer.OrdinalIgnoreCase);

        if (inlineImages.Count == 0)
        {
            return html;
        }

        return System.Text.RegularExpressions.Regex.Replace(
            html,
            "cid:([^\"'\\)\\s>]+)",
            match =>
            {
                var contentId = NormalizeContentId(Uri.UnescapeDataString(match.Groups[1].Value));
                if (!inlineImages.TryGetValue(contentId, out var part))
                {
                    return match.Value;
                }

                try
                {
                    if (part.Content is null)
                    {
                        return match.Value;
                    }

                    using var stream = new MemoryStream();
                    part.Content.DecodeTo(stream);
                    return $"data:{part.ContentType.MimeType};base64,{Convert.ToBase64String(stream.ToArray())}";
                }
                catch
                {
                    return match.Value;
                }
            },
            System.Text.RegularExpressions.RegexOptions.IgnoreCase);
    }

    private static string NormalizeContentId(string value)
        => value.Trim().Trim('<', '>');

    private Result<string> ResolvePassword(MailAccount account)
    {
        if (!string.IsNullOrWhiteSpace(account.PasswordProtectedValue))
        {
            return ProtectedSecretProtector.Unprotect(configuration, account.PasswordProtectedValue, "Mot de passe mail");
        }

        if (!string.IsNullOrWhiteSpace(account.PasswordSecretName))
        {
            var secret = configuration[$"Secrets:{account.PasswordSecretName}"] ?? configuration[account.PasswordSecretName];
            return string.IsNullOrWhiteSpace(secret)
                ? Result<string>.Failure($"Secret mail '{account.PasswordSecretName}' absent de la configuration.")
                : Result<string>.Success(secret);
        }

        return Result<string>.Failure("Aucun mot de passe SMTP/IMAP configure pour ce compte.");
    }

    private void SetPassword(MailAccount account, string? password, bool clearPassword)
    {
        if (clearPassword)
        {
            account.PasswordProtectedValue = null;
            account.PasswordSecretName = null;
            return;
        }

        if (string.IsNullOrWhiteSpace(password))
        {
            return;
        }

        account.PasswordProtectedValue = ProtectedSecretProtector.Protect(configuration, password.Trim());
        account.PasswordSecretName = "DATABASE_PROTECTED";
    }

    private async Task<Result> ApplyAccessesAsync(MailAccount account, IReadOnlyList<Guid>? authorizedUserIds, CancellationToken cancellationToken)
    {
        var isAdministrator = await IsAdministratorAsync(cancellationToken);
        var userIds = isAdministrator
            ? (authorizedUserIds ?? []).Where(id => id != Guid.Empty).Distinct().ToList()
            : currentUser.UserId is { } userId ? [userId] : [];

        if (!isAdministrator && userIds.Count == 0)
        {
            return Result.Failure("Utilisateur courant introuvable pour l'affectation de la boite mail.");
        }

        if (userIds.Count > 0)
        {
            var existingUsers = await db.Users
                .Where(x => userIds.Contains(x.Id))
                .Select(x => x.Id)
                .ToListAsync(cancellationToken);
            if (existingUsers.Count != userIds.Count)
            {
                return Result.Failure("Un ou plusieurs utilisateurs affectes a la boite mail sont introuvables.");
            }
        }

        account.Accesses = await db.MailAccountAccesses
            .Where(x => x.MailAccountId == account.Id)
            .ToListAsync(cancellationToken);

        foreach (var access in account.Accesses.Where(access => !userIds.Contains(access.UserId)).ToList())
        {
            db.MailAccountAccesses.Remove(access);
            account.Accesses.Remove(access);
        }

        var existingUserIds = account.Accesses.Select(access => access.UserId).ToHashSet();
        foreach (var authorizedUserId in userIds.Where(authorizedUserId => !existingUserIds.Contains(authorizedUserId)))
        {
            account.Accesses.Add(new MailAccountAccess { MailAccountId = account.Id, UserId = authorizedUserId });
        }

        return Result.Success();
    }

    private async Task<IQueryable<EmailMessage>> ApplyMessageAccessAsync(IQueryable<EmailMessage> query, CancellationToken cancellationToken)
    {
        query = query.Where(x => !x.IsDeleted);

        if (await IsAdministratorAsync(cancellationToken))
        {
            return query;
        }

        if (currentUser.UserId is not { } userId)
        {
            return query.Where(x => false);
        }

        return query.Where(message =>
            message.MailAccountId.HasValue
            && db.MailAccounts.Any(account =>
                account.Id == message.MailAccountId.Value
                && (account.CreatedByUserId == userId || db.MailAccountAccesses.Any(access => access.MailAccountId == account.Id && access.UserId == userId))));
    }

    private async Task<bool> CanAccessAccountAsync(Guid accountId, CancellationToken cancellationToken)
    {
        if (await IsAdministratorAsync(cancellationToken))
        {
            return true;
        }

        return currentUser.UserId is { } userId
            && await db.MailAccounts.AnyAsync(
                account => account.Id == accountId && (account.CreatedByUserId == userId || db.MailAccountAccesses.Any(access => access.MailAccountId == account.Id && access.UserId == userId)),
                cancellationToken);
    }

    private async Task<bool> CanManageAccountAsync(MailAccount account, CancellationToken cancellationToken)
        => await IsAdministratorAsync(cancellationToken) || account.CreatedByUserId == currentUser.UserId;

    private async Task<bool> IsAdministratorAsync(CancellationToken cancellationToken)
        => currentUser.UserId is { } userId
            && await db.UserRoles.AnyAsync(userRole => userRole.UserId == userId && db.Roles.Any(role => role.Id == userRole.RoleId && role.Name == "Administrator"), cancellationToken);

    private async Task<Result<MailServerValues>> ResolveServerValuesAsync(string? smtpHost, int smtpPort, string? imapHost, int imapPort, bool useSsl, CancellationToken cancellationToken)
    {
        var settings = await db.MailServerSettings
            .OrderBy(x => x.CreatedAt)
            .FirstOrDefaultAsync(cancellationToken);
        if (settings is not null && IsServerConfigured(settings))
        {
            return Result<MailServerValues>.Success(new(settings.SmtpHost, settings.SmtpPort, settings.ImapHost, settings.ImapPort, settings.UseSsl));
        }

        var validation = ValidateServerSettings(smtpHost, imapHost, smtpPort, imapPort);
        return validation.Succeeded
            ? Result<MailServerValues>.Success(new(smtpHost!.Trim(), smtpPort, imapHost!.Trim(), imapPort, useSsl))
            : Result<MailServerValues>.Failure("Configurez les serveurs SMTP/IMAP globaux avant de creer une boite mail.");
    }

    private async Task<Result<MailServerValues>> ResolveEffectiveServerValuesAsync(MailAccount account, CancellationToken cancellationToken)
    {
        var settings = await db.MailServerSettings
            .OrderBy(x => x.CreatedAt)
            .FirstOrDefaultAsync(cancellationToken);
        if (settings is not null && IsServerConfigured(settings))
        {
            return Result<MailServerValues>.Success(new(settings.SmtpHost, settings.SmtpPort, settings.ImapHost, settings.ImapPort, settings.UseSsl));
        }

        var validation = ValidateServerSettings(account.SmtpHost, account.ImapHost, account.SmtpPort, account.ImapPort);
        return validation.Succeeded
            ? Result<MailServerValues>.Success(new(account.SmtpHost, account.SmtpPort, account.ImapHost, account.ImapPort, account.UseSsl))
            : Result<MailServerValues>.Failure("Serveurs SMTP/IMAP non configures.");
    }

    private static void ApplyServerSettings(MailServerSettings settings, string smtpHost, int smtpPort, string imapHost, int imapPort, bool useSsl, bool imapAutoSyncEnabled, int imapSyncIntervalMinutes)
    {
        settings.SmtpHost = smtpHost.Trim();
        settings.SmtpPort = smtpPort;
        settings.ImapHost = imapHost.Trim();
        settings.ImapPort = imapPort;
        settings.UseSsl = useSsl;
        settings.ImapAutoSyncEnabled = imapAutoSyncEnabled;
        settings.ImapSyncIntervalMinutes = Math.Clamp(imapSyncIntervalMinutes, 1, 1440);
    }

    private static void ApplyAccount(MailAccount account, string email, MailServerValues serverValues, string? userName, string? passwordSecretName, string? displayName, string? signatureHtml, bool isActive)
    {
        account.Email = email.Trim();
        account.DisplayName = NormalizeOptional(displayName);
        account.SignatureHtml = NormalizeSignature(signatureHtml);
        account.SmtpHost = serverValues.SmtpHost;
        account.SmtpPort = serverValues.SmtpPort;
        account.ImapHost = serverValues.ImapHost;
        account.ImapPort = serverValues.ImapPort;
        account.UseSsl = serverValues.UseSsl;
        account.UserName = string.IsNullOrWhiteSpace(userName) ? account.Email : userName.Trim();
        if (!string.Equals(passwordSecretName, "DATABASE_PROTECTED", StringComparison.OrdinalIgnoreCase))
        {
            account.PasswordSecretName = NormalizeOptional(passwordSecretName);
        }

        account.IsActive = isActive;
    }

    private static Result ValidateAccount(string email)
    {
        if (!MailboxAddress.TryParse(email, out _))
        {
            return Result.Failure("Adresse email invalide.");
        }

        return Result.Success();
    }

    private static Result ValidateServerSettings(string? smtpHost, string? imapHost, int smtpPort, int imapPort)
    {
        if (string.IsNullOrWhiteSpace(smtpHost) || string.IsNullOrWhiteSpace(imapHost))
        {
            return Result.Failure("Serveurs SMTP et IMAP obligatoires.");
        }

        if (smtpPort is < 1 or > 65535 || imapPort is < 1 or > 65535)
        {
            return Result.Failure("Ports SMTP/IMAP invalides.");
        }

        return Result.Success();
    }

    private static Result ValidateTemplate(string name, string subject, string body)
    {
        if (string.IsNullOrWhiteSpace(name) || string.IsNullOrWhiteSpace(subject))
        {
            return Result.Failure("Nom et sujet du modele obligatoires.");
        }

        if (string.IsNullOrWhiteSpace(body))
        {
            return Result.Failure("Corps du modele obligatoire.");
        }

        return Result.Success();
    }

    private static Result<InternetAddressList> ParseAddresses(string value, string label)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            return Result<InternetAddressList>.Failure($"{label} obligatoire.");
        }

        try
        {
            return Result<InternetAddressList>.Success(InternetAddressList.Parse(value.Replace(';', ',')));
        }
        catch (ParseException)
        {
            return Result<InternetAddressList>.Failure($"{label} invalide.");
        }
    }

    private static Result<InternetAddressList> ParseOptionalAddresses(string? value, string label)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            return Result<InternetAddressList>.Success([]);
        }

        return ParseAddresses(value, label);
    }

    private static string FormatAddressList(InternetAddressList addresses)
        => NormalizeLength(addresses.ToString(false), 1000) ?? string.Empty;

    private static string? FormatOptionalAddressList(InternetAddressList addresses)
    {
        if (addresses.Count == 0)
        {
            return null;
        }

        return FormatAddressList(addresses);
    }

    private static SecureSocketOptions ResolveSmtpSocketOptions(MailServerValues serverValues)
    {
        if (!serverValues.UseSsl)
        {
            return SecureSocketOptions.None;
        }

        return serverValues.SmtpPort == 465
            ? SecureSocketOptions.SslOnConnect
            : SecureSocketOptions.StartTlsWhenAvailable;
    }

    private static SecureSocketOptions ResolveImapSocketOptions(MailServerValues serverValues)
    {
        if (!serverValues.UseSsl)
        {
            return SecureSocketOptions.None;
        }

        return serverValues.ImapPort == 993
            ? SecureSocketOptions.SslOnConnect
            : SecureSocketOptions.StartTlsWhenAvailable;
    }

    private static string StripHtmlFallback(string? html)
        => string.IsNullOrWhiteSpace(html) ? string.Empty : System.Text.RegularExpressions.Regex.Replace(html, "<.*?>", string.Empty);

    private static string ApplySignature(string body, string? signatureHtml)
    {
        if (string.IsNullOrWhiteSpace(signatureHtml))
        {
            return body;
        }

        var signature = signatureHtml.Trim();
        var bodyHtml = LooksLikeHtml(body)
            ? body
            : ApplySignatureToPlainText(body, signature);

        return LooksLikeHtml(body) ? $"{bodyHtml}<br><br>{signature}" : bodyHtml;
    }

    private static string ApplySignatureToPlainText(string body, string signatureHtml)
    {
        var normalized = body.Replace("\r\n", "\n");
        var quotedStart = FindQuotedConversationStart(normalized);
        if (quotedStart < 0)
        {
            return $"{PlainTextToHtml(normalized)}<br><br>{signatureHtml}";
        }

        var replyText = normalized[..quotedStart].TrimEnd();
        var quotedText = normalized[quotedStart..].TrimStart();
        var replyHtml = PlainTextToHtml(replyText);
        var quotedHtml = PlainTextToHtml(quotedText);

        return string.IsNullOrWhiteSpace(replyText)
            ? $"{signatureHtml}<br><br>{quotedHtml}"
            : $"{replyHtml}<br><br>{signatureHtml}<br><br>{quotedHtml}";
    }

    private static int FindQuotedConversationStart(string body)
    {
        var match = System.Text.RegularExpressions.Regex.Match(
            body,
            "(^|\\n{2,})(Le\\s+.+?\\s+a\\s+(ecrit|\\u00e9crit)\\s*:)",
            System.Text.RegularExpressions.RegexOptions.IgnoreCase | System.Text.RegularExpressions.RegexOptions.CultureInvariant);

        return match.Success ? match.Groups[2].Index : -1;
    }

    private static string PlainTextToHtml(string value)
        => System.Net.WebUtility.HtmlEncode(value).Replace("\n", "<br>");

    private static bool LooksLikeHtml(string? value)
        => !string.IsNullOrWhiteSpace(value) && System.Text.RegularExpressions.Regex.IsMatch(value, "<\\s*[a-zA-Z][^>]*>");

    private static string? NormalizeOptional(string? value)
    {
        var cleaned = CleanDatabaseText(value);
        return string.IsNullOrWhiteSpace(cleaned) ? null : cleaned.Trim();
    }

    private static string? NormalizeSignature(string? value)
    {
        var normalized = NormalizeOptional(value);
        return normalized is null || normalized.Length <= 10000 ? normalized : normalized[..10000];
    }

    private static string? NormalizeLength(string? value, int maxLength)
    {
        var normalized = NormalizeOptional(value);
        return normalized is null || normalized.Length <= maxLength ? normalized : normalized[..maxLength];
    }

    private static string CleanDatabaseText(string? value)
        => string.IsNullOrEmpty(value) ? string.Empty : value.Replace("\0", string.Empty);

    private static DateTimeOffset NormalizeMailDate(DateTimeOffset value)
        => value == DateTimeOffset.MinValue ? DateTimeOffset.UtcNow : value.ToUniversalTime();

    private static string FormatDatabaseError(DbUpdateException ex)
    {
        var detail = ex.InnerException?.Message;
        return string.IsNullOrWhiteSpace(detail)
            ? ex.Message
            : $"{ex.Message} Detail: {detail}";
    }

    private static bool HasPassword(MailAccount account)
        => !string.IsNullOrWhiteSpace(account.PasswordProtectedValue) || !string.IsNullOrWhiteSpace(account.PasswordSecretName);

    private static bool IsServerConfigured(MailServerSettings settings)
        => !string.IsNullOrWhiteSpace(settings.SmtpHost) && !string.IsNullOrWhiteSpace(settings.ImapHost);

    private static MailServerSettingsDto Map(MailServerSettings? settings)
        => settings is null
            ? new MailServerSettingsDto(null, string.Empty, 587, string.Empty, 993, true, true, 5, false)
            : new MailServerSettingsDto(settings.Id, settings.SmtpHost, settings.SmtpPort, settings.ImapHost, settings.ImapPort, settings.UseSsl, settings.ImapAutoSyncEnabled, Math.Clamp(settings.ImapSyncIntervalMinutes, 1, 1440), IsServerConfigured(settings));

    private static MailAccountDto Map(MailAccount account)
        => new(account.Id, account.Email, account.DisplayName, account.SignatureHtml, account.SmtpHost, account.SmtpPort, account.ImapHost, account.ImapPort, account.UseSsl, account.UserName, account.PasswordSecretName, HasPassword(account), account.IsActive, account.Accesses.Select(x => x.UserId).OrderBy(x => x).ToList());

    private async Task<IReadOnlyList<EmailMessageDto>> MapManyAsync(IReadOnlyList<EmailMessage> messages, CancellationToken cancellationToken)
    {
        var ids = messages.Select(x => x.Id).ToList();
        var attachments = await db.EmailAttachments
            .Where(x => ids.Contains(x.EmailMessageId))
            .OrderBy(x => x.FileName)
            .ToListAsync(cancellationToken);
        var links = await db.EmailLinks
            .Where(x => ids.Contains(x.EmailMessageId))
            .OrderBy(x => x.Module)
            .ToListAsync(cancellationToken);

        return messages
            .Select(message => Map(
                message,
                attachments.Where(x => x.EmailMessageId == message.Id).Select(Map).ToList(),
                links.Where(x => x.EmailMessageId == message.Id).Select(Map).ToList()))
            .ToList();
    }

    private async Task<EmailMessageDto> MapAsync(EmailMessage message, CancellationToken cancellationToken)
    {
        var attachments = await db.EmailAttachments
            .Where(x => x.EmailMessageId == message.Id)
            .OrderBy(x => x.FileName)
            .ToListAsync(cancellationToken);
        var links = await db.EmailLinks
            .Where(x => x.EmailMessageId == message.Id)
            .OrderBy(x => x.Module)
            .ToListAsync(cancellationToken);

        return Map(message, attachments.Select(Map).ToList(), links.Select(Map).ToList());
    }

    private static EmailMessageDto Map(EmailMessage message, IReadOnlyList<EmailAttachmentDto> attachments, IReadOnlyList<EmailLinkDto> links)
        => new(
            message.Id,
            message.MailAccountId,
            message.Subject,
            message.From,
            message.To,
            message.Cc,
            message.Bcc,
            message.Body,
            message.Direction,
            message.Status,
            message.IsRead,
            message.ErrorMessage,
            message.CreatedAt,
            message.SentAt,
            message.ReceivedAt,
            attachments,
            links);

    private static EmailAttachmentDto Map(EmailAttachment attachment)
        => new(attachment.Id, attachment.FileName, attachment.MimeType, attachment.Size, attachment.StoragePath);

    private static EmailLinkDto Map(EmailLink link)
        => new(link.Id, link.Module, link.EntityId);

    private static EmailTemplateDto Map(EmailTemplate template)
        => new(template.Id, template.Name, template.Subject, template.Body, template.IsActive, template.CreatedAt);
}
