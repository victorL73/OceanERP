using System.Security.Cryptography;
using System.Text;
using Erp.Application.Common;
using Erp.Application.Documents;
using Erp.Application.Emails;
using Erp.Application.Signatures;
using Erp.Domain.Documents;
using Erp.Domain.FutureModules;
using Erp.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using QuestPDF.Fluent;
using QuestPDF.Helpers;
using QuestPDF.Infrastructure;

namespace Erp.Infrastructure.Services;

public sealed class SignatureService(ErpDbContext db, IFileStorageService fileStorageService, IEmailService emails) : ISignatureService
{
    private sealed record RecipientSecret(Guid RecipientId, string Email, string? Name, string SigningToken, string OtpCode);

    public async Task<PagedResult<SignatureRequestDto>> SearchAsync(int page, int pageSize, CancellationToken cancellationToken)
    {
        page = Math.Max(1, page);
        pageSize = Math.Clamp(pageSize, 1, 100);
        var total = await db.SignatureRequests.CountAsync(cancellationToken);
        var requests = await db.SignatureRequests
            .AsNoTracking()
            .OrderByDescending(x => x.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(cancellationToken);
        return new PagedResult<SignatureRequestDto>(await MapManyAsync(requests, BuildRelativeSigningUrl, cancellationToken), total, page, pageSize);
    }

    public async Task<Result<SignatureRequestDto>> GetAsync(Guid id, CancellationToken cancellationToken)
    {
        var request = await db.SignatureRequests.AsNoTracking().FirstOrDefaultAsync(x => x.Id == id, cancellationToken);
        return request is null
            ? Result<SignatureRequestDto>.Failure("Demande de signature introuvable.")
            : Result<SignatureRequestDto>.Success(await MapAsync(request, BuildRelativeSigningUrl, cancellationToken));
    }

    public async Task<Result<SignatureRequestDto>> CreateAsync(CreateSignatureRequestRequest request, string publicBaseUrl, CancellationToken cancellationToken)
    {
        if (request.Recipients.Count == 0)
        {
            return Result<SignatureRequestDto>.Failure("Ajoutez au moins un destinataire.");
        }

        var driveItem = await db.DriveItems.FirstOrDefaultAsync(x => x.Id == request.DriveItemId && !x.IsTrashed, cancellationToken);
        if (driveItem is null)
        {
            return Result<SignatureRequestDto>.Failure("Document Drive introuvable.");
        }

        if (request.ExpiresAt <= DateTimeOffset.UtcNow)
        {
            return Result<SignatureRequestDto>.Failure("La date d'expiration doit etre future.");
        }

        var mailAccountId = await db.MailAccounts
            .Where(x => x.IsActive)
            .OrderBy(x => x.Email)
            .Select(x => (Guid?)x.Id)
            .FirstOrDefaultAsync(cancellationToken);
        if (mailAccountId is null)
        {
            return Result<SignatureRequestDto>.Failure("Configurez une boite mail active avant de creer une demande de signature OTP.");
        }

        var signatureRequest = new SignatureRequest
        {
            DriveItemId = request.DriveItemId,
            Title = string.IsNullOrWhiteSpace(request.Title) ? driveItem.Name : request.Title.Trim(),
            Status = "Pending",
            ExpiresAt = request.ExpiresAt
        };
        db.SignatureRequests.Add(signatureRequest);

        var recipientSecrets = new List<RecipientSecret>();
        foreach (var recipientRequest in request.Recipients)
        {
            if (string.IsNullOrWhiteSpace(recipientRequest.Email))
            {
                return Result<SignatureRequestDto>.Failure("Email destinataire obligatoire.");
            }

            var token = GenerateToken();
            var otpCode = GenerateOtpCode();
            var recipient = new SignatureRecipient
            {
                SignatureRequestId = signatureRequest.Id,
                Email = recipientRequest.Email.Trim(),
                Name = NormalizeOptional(recipientRequest.Name),
                TokenHash = Hash(token),
                Status = "Pending"
            };
            db.SignatureRecipients.Add(recipient);
            db.SignatureOtps.Add(new SignatureOtp
            {
                SignatureRecipientId = recipient.Id,
                OtpHash = Hash(otpCode),
                ExpiresAt = request.ExpiresAt < DateTimeOffset.UtcNow.AddMinutes(30)
                    ? request.ExpiresAt
                    : DateTimeOffset.UtcNow.AddMinutes(30)
            });
            recipientSecrets.Add(new RecipientSecret(recipient.Id, recipient.Email, recipient.Name, token, otpCode));
        }

        await db.SaveChangesAsync(cancellationToken);

        foreach (var secret in recipientSecrets)
        {
            var sendResult = await emails.SendAsync(
                new SendEmailRequest(
                    mailAccountId.Value,
                    secret.Email,
                    $"Code OTP OceanERP - {signatureRequest.Title}",
                    BuildOtpEmailBody(secret.Name, signatureRequest.Title, BuildSigningUrl(publicBaseUrl, secret.SigningToken), secret.OtpCode)),
                cancellationToken);
            if (!sendResult.Succeeded)
            {
                return Result<SignatureRequestDto>.Failure($"Demande creee mais email OTP impossible pour {secret.Email}: {sendResult.Error}");
            }
        }

        var saved = await db.SignatureRequests.AsNoTracking().FirstAsync(x => x.Id == signatureRequest.Id, cancellationToken);
        return Result<SignatureRequestDto>.Success(await MapAsync(saved, (recipient) => BuildSigningUrl(publicBaseUrl, recipientSecrets.FirstOrDefault(secret => secret.RecipientId == recipient.Id)?.SigningToken), cancellationToken));
    }

    public async Task<Result<SignatureRequestDto>> ChangeStatusAsync(Guid id, string status, CancellationToken cancellationToken)
    {
        var request = await db.SignatureRequests.FirstOrDefaultAsync(x => x.Id == id, cancellationToken);
        if (request is null)
        {
            return Result<SignatureRequestDto>.Failure("Demande de signature introuvable.");
        }

        var normalized = NormalizeSignatureStatus(status);
        if (normalized is null)
        {
            return Result<SignatureRequestDto>.Failure("Statut de signature invalide.");
        }

        if (string.Equals(request.Status, "Completed", StringComparison.OrdinalIgnoreCase))
        {
            return Result<SignatureRequestDto>.Failure("Une demande terminee ne peut pas etre modifiee.");
        }

        request.Status = normalized;
        await db.SaveChangesAsync(cancellationToken);
        return Result<SignatureRequestDto>.Success(await MapAsync(request, BuildRelativeSigningUrl, cancellationToken));
    }

    public async Task<Result> DeleteAsync(Guid id, CancellationToken cancellationToken)
    {
        var request = await db.SignatureRequests.FirstOrDefaultAsync(x => x.Id == id, cancellationToken);
        if (request is null)
        {
            return Result.Failure("Demande de signature introuvable.");
        }

        db.SignatureRequests.Remove(request);
        await db.SaveChangesAsync(cancellationToken);
        return Result.Success();
    }

    public async Task<Result<SignatureDocumentStream>> OpenDocumentAsync(Guid id, CancellationToken cancellationToken)
    {
        var request = await db.SignatureRequests.AsNoTracking().FirstOrDefaultAsync(x => x.Id == id, cancellationToken);
        if (request is null)
        {
            return Result<SignatureDocumentStream>.Failure("Demande de signature introuvable.");
        }

        return await OpenDriveDocumentAsync(request.DriveItemId, cancellationToken);
    }

    public async Task<Result<SignatureDocumentStream>> OpenSignedDocumentAsync(Guid id, Guid signedDocumentId, CancellationToken cancellationToken)
    {
        var document = await db.SignedDocuments
            .AsNoTracking()
            .FirstOrDefaultAsync(x => x.Id == signedDocumentId && x.SignatureRequestId == id, cancellationToken);
        if (document is null)
        {
            return Result<SignatureDocumentStream>.Failure("Document signe introuvable.");
        }

        var stream = await fileStorageService.OpenReadAsync(document.StoragePath, cancellationToken);
        return Result<SignatureDocumentStream>.Success(new SignatureDocumentStream(stream, document.MimeType, document.FileName));
    }

    public async Task<Result<SignatureDocumentStream>> OpenPublicDocumentAsync(string token, bool signed, CancellationToken cancellationToken)
    {
        var recipient = await FindRecipientByTokenAsync(token, cancellationToken);
        if (recipient is null)
        {
            return Result<SignatureDocumentStream>.Failure("Lien de signature invalide.");
        }

        var request = await db.SignatureRequests.AsNoTracking().FirstAsync(x => x.Id == recipient.SignatureRequestId, cancellationToken);
        if (string.Equals(request.Status, "Revoked", StringComparison.OrdinalIgnoreCase))
        {
            return Result<SignatureDocumentStream>.Failure("Ce lien de signature est desactive.");
        }

        if (signed)
        {
            var signedDocument = await db.SignedDocuments
                .AsNoTracking()
                .Where(x => x.SignatureRequestId == request.Id)
                .OrderByDescending(x => x.CreatedAt)
                .FirstOrDefaultAsync(cancellationToken);
            if (signedDocument is not null)
            {
                var stream = await fileStorageService.OpenReadAsync(signedDocument.StoragePath, cancellationToken);
                return Result<SignatureDocumentStream>.Success(new SignatureDocumentStream(stream, signedDocument.MimeType, signedDocument.FileName));
            }
        }

        return await OpenDriveDocumentAsync(request.DriveItemId, cancellationToken);
    }

    public async Task<Result<PublicSignatureDto>> GetPublicAsync(string token, CancellationToken cancellationToken)
    {
        var recipient = await FindRecipientByTokenAsync(token, cancellationToken);
        if (recipient is null)
        {
            return Result<PublicSignatureDto>.Failure("Lien de signature invalide.");
        }

        var request = await db.SignatureRequests.FirstAsync(x => x.Id == recipient.SignatureRequestId, cancellationToken);
        var driveItem = await db.DriveItems.FirstOrDefaultAsync(x => x.Id == request.DriveItemId, cancellationToken);
        var status = PublicSignatureStatus(request, recipient);
        var requiresOtp = await db.SignatureOtps.AnyAsync(x => x.SignatureRecipientId == recipient.Id && x.UsedAt == null && x.ExpiresAt > DateTimeOffset.UtcNow, cancellationToken);
        var signedDocument = await db.SignedDocuments
            .AsNoTracking()
            .Where(x => x.SignatureRequestId == request.Id)
            .OrderByDescending(x => x.CreatedAt)
            .FirstOrDefaultAsync(cancellationToken);
        return Result<PublicSignatureDto>.Success(new PublicSignatureDto(
            request.Id,
            recipient.Id,
            request.Title,
            driveItem?.Name ?? request.DriveItemId.ToString(),
            request.ExpiresAt,
            status,
            requiresOtp,
            $"/api/signatures/public/{Uri.EscapeDataString(token)}/document",
            signedDocument is null ? null : $"/api/signatures/public/{Uri.EscapeDataString(token)}/document?signed=true",
            recipient.Name,
            recipient.Email));
    }

    public async Task<Result<SignatureRequestDto>> AcceptAsync(string token, AcceptSignatureRequest request, string? ipAddress, string? userAgent, CancellationToken cancellationToken)
    {
        if (!request.ConditionsAccepted)
        {
            return Result<SignatureRequestDto>.Failure("Les conditions doivent etre acceptees avant signature.");
        }

        var recipient = await FindRecipientByTokenAsync(token, cancellationToken);
        if (recipient is null)
        {
            return Result<SignatureRequestDto>.Failure("Lien de signature invalide.");
        }

        var signatureRequest = await db.SignatureRequests.FirstAsync(x => x.Id == recipient.SignatureRequestId, cancellationToken);
        if (string.Equals(signatureRequest.Status, "Revoked", StringComparison.OrdinalIgnoreCase))
        {
            return Result<SignatureRequestDto>.Failure("Ce lien de signature est desactive.");
        }

        if (string.Equals(recipient.Status, "Signed", StringComparison.OrdinalIgnoreCase))
        {
            return Result<SignatureRequestDto>.Failure("Ce destinataire a deja signe ce document.");
        }

        if (signatureRequest.ExpiresAt <= DateTimeOffset.UtcNow)
        {
            signatureRequest.Status = "Expired";
            await db.SaveChangesAsync(cancellationToken);
            return Result<SignatureRequestDto>.Failure("Lien de signature expire.");
        }

        var otpResult = await ValidateOtpAsync(recipient.Id, request.OtpCode, cancellationToken);
        if (!otpResult.Succeeded)
        {
            return Result<SignatureRequestDto>.Failure(otpResult.Error!);
        }

        var signerName = NormalizeOptional(request.SignerName);
        if (signerName is not null)
        {
            recipient.Name = signerName;
        }

        var signerEmail = NormalizeOptional(request.SignerEmail);
        if (signerEmail is not null)
        {
            if (!signerEmail.Contains('@', StringComparison.Ordinal))
            {
                return Result<SignatureRequestDto>.Failure("Email signataire invalide.");
            }

            recipient.Email = signerEmail;
        }

        var driveItem = await db.DriveItems.FirstOrDefaultAsync(x => x.Id == signatureRequest.DriveItemId && !x.IsTrashed, cancellationToken);
        if (driveItem is null)
        {
            return Result<SignatureRequestDto>.Failure("Document signe introuvable.");
        }

        var sha256 = await ComputeSha256Async(driveItem.StoragePath, cancellationToken);
        var signatureImage = DecodeSignatureDataUrl(request.DrawnSignatureDataUrl);
        var signatureImageSha256 = signatureImage is null ? null : Convert.ToHexString(SHA256.HashData(signatureImage)).ToLowerInvariant();
        recipient.Status = "Signed";
        recipient.SignedAt = DateTimeOffset.UtcNow;

        var evidence = new SignatureEvidence
        {
            SignatureRequestId = signatureRequest.Id,
            SignatureRecipientId = recipient.Id,
            Action = "Accepted",
            DocumentSha256 = sha256,
            ConditionsAccepted = true,
            SignatureMode = NormalizeOptional(request.SignatureMode) ?? "Click",
            DrawnSignatureDataUrl = NormalizeOptional(request.DrawnSignatureDataUrl),
            IpAddress = NormalizeOptional(ipAddress),
            UserAgent = NormalizeOptional(userAgent)
        };
        db.SignatureEvidences.Add(evidence);

        var recipients = await db.SignatureRecipients.Where(x => x.SignatureRequestId == signatureRequest.Id).ToListAsync(cancellationToken);
        if (recipients.All(x => x.Id == recipient.Id || string.Equals(x.Status, "Signed", StringComparison.OrdinalIgnoreCase)))
        {
            signatureRequest.Status = "Completed";
            signatureRequest.CompletedAt = DateTimeOffset.UtcNow;
            if (!await db.SignedDocuments.AnyAsync(x => x.SignatureRequestId == signatureRequest.Id, cancellationToken))
            {
                var certificateBytes = GenerateSignatureCertificatePdf(signatureRequest, driveItem, recipient, evidence, signatureImage, signatureImageSha256);
                await using var certificateStream = new MemoryStream(certificateBytes);
                var signedFileName = $"signed-{Path.GetFileNameWithoutExtension(driveItem.Name)}-{DateTimeOffset.UtcNow:yyyyMMddHHmmss}.pdf";
                var stored = await fileStorageService.SaveAsync("signatures", signedFileName, certificateStream, cancellationToken);
                db.SignedDocuments.Add(new SignedDocument
                {
                    SignatureRequestId = signatureRequest.Id,
                    FileName = signedFileName,
                    MimeType = "application/pdf",
                    Size = stored.Size,
                    StoragePath = stored.StoragePath,
                    DocumentSha256 = stored.Sha256.ToLowerInvariant()
                });
            }
        }

        await db.SaveChangesAsync(cancellationToken);
        return Result<SignatureRequestDto>.Success(await MapAsync(signatureRequest, BuildRelativeSigningUrl, cancellationToken));
    }

    private async Task<SignatureRecipient?> FindRecipientByTokenAsync(string token, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(token))
        {
            return null;
        }

        var trimmed = token.Trim();
        if (Guid.TryParse(trimmed, out var recipientId))
        {
            var recipientById = await db.SignatureRecipients.FirstOrDefaultAsync(x => x.Id == recipientId, cancellationToken);
            if (recipientById is not null)
            {
                return recipientById;
            }
        }

        var tokenHash = Hash(trimmed);
        return await db.SignatureRecipients.FirstOrDefaultAsync(x => x.TokenHash == tokenHash, cancellationToken);
    }

    private async Task<Result> ValidateOtpAsync(Guid recipientId, string? code, CancellationToken cancellationToken)
    {
        var otp = await db.SignatureOtps
            .Where(x => x.SignatureRecipientId == recipientId && x.UsedAt == null)
            .OrderByDescending(x => x.ExpiresAt)
            .FirstOrDefaultAsync(cancellationToken);
        if (otp is null)
        {
            return Result.Failure("Aucun code OTP valide pour ce destinataire.");
        }

        if (otp.ExpiresAt <= DateTimeOffset.UtcNow)
        {
            return Result.Failure("Code OTP expire. Demandez une nouvelle signature.");
        }

        if (string.IsNullOrWhiteSpace(code) || !string.Equals(Hash(code.Trim()), otp.OtpHash, StringComparison.OrdinalIgnoreCase))
        {
            return Result.Failure("Code OTP invalide.");
        }

        otp.UsedAt = DateTimeOffset.UtcNow;
        return Result.Success();
    }

    private async Task<string> ComputeSha256Async(string storagePath, CancellationToken cancellationToken)
    {
        await using var stream = await fileStorageService.OpenReadAsync(storagePath, cancellationToken);
        var hash = await SHA256.HashDataAsync(stream, cancellationToken);
        return Convert.ToHexString(hash).ToLowerInvariant();
    }

    private async Task<Result<SignatureDocumentStream>> OpenDriveDocumentAsync(Guid driveItemId, CancellationToken cancellationToken)
    {
        var driveItem = await db.DriveItems.AsNoTracking().FirstOrDefaultAsync(x => x.Id == driveItemId && !x.IsTrashed, cancellationToken);
        if (driveItem is null)
        {
            return Result<SignatureDocumentStream>.Failure("Document Drive introuvable.");
        }

        var stream = await fileStorageService.OpenReadAsync(driveItem.StoragePath, cancellationToken);
        return Result<SignatureDocumentStream>.Success(new SignatureDocumentStream(stream, driveItem.MimeType, driveItem.Name));
    }

    private static string? NormalizeSignatureStatus(string status)
    {
        return status.Trim().ToLowerInvariant() switch
        {
            "pending" or "active" or "restore" => "Pending",
            "revoked" or "revoke" or "disabled" => "Revoked",
            _ => null
        };
    }

    private static string PublicSignatureStatus(SignatureRequest request, SignatureRecipient recipient)
    {
        if (string.Equals(request.Status, "Revoked", StringComparison.OrdinalIgnoreCase))
        {
            return "Revoked";
        }

        if (request.ExpiresAt <= DateTimeOffset.UtcNow && !string.Equals(recipient.Status, "Signed", StringComparison.OrdinalIgnoreCase))
        {
            return "Expired";
        }

        return recipient.Status;
    }

    private static byte[]? DecodeSignatureDataUrl(string? dataUrl)
    {
        if (string.IsNullOrWhiteSpace(dataUrl))
        {
            return null;
        }

        var marker = "base64,";
        var index = dataUrl.IndexOf(marker, StringComparison.OrdinalIgnoreCase);
        if (index < 0 || !dataUrl.StartsWith("data:image/", StringComparison.OrdinalIgnoreCase))
        {
            return null;
        }

        try
        {
            var base64 = dataUrl[(index + marker.Length)..].Trim();
            var bytes = Convert.FromBase64String(base64);
            return bytes.Length < 80 || bytes.Length > 2 * 1024 * 1024 ? null : bytes;
        }
        catch (FormatException)
        {
            return null;
        }
    }

    private static byte[] GenerateSignatureCertificatePdf(
        SignatureRequest request,
        DriveItem driveItem,
        SignatureRecipient recipient,
        SignatureEvidence evidence,
        byte[]? signatureImage,
        string? signatureImageSha256)
    {
        QuestPDF.Settings.License = LicenseType.Community;
        var signedAt = recipient.SignedAt ?? DateTimeOffset.UtcNow;

        return Document.Create(container =>
        {
            container.Page(page =>
            {
                page.Margin(40);
                page.Size(PageSizes.A4);
                page.DefaultTextStyle(x => x.FontSize(10));

                page.Header().Row(row =>
                {
                    row.RelativeItem().Column(column =>
                    {
                        column.Item().Text("OceanERP").FontSize(22).Bold();
                        column.Item().Text("Certificat de signature electronique interne").FontSize(13).FontColor(Colors.Teal.Darken2);
                    });
                    row.ConstantItem(170).AlignRight().Column(column =>
                    {
                        column.Item().Text($"Date: {signedAt:dd/MM/yyyy HH:mm}").Bold();
                        column.Item().Text($"Demande: {request.Id}");
                    });
                });

                page.Content().PaddingVertical(24).Column(column =>
                {
                    column.Spacing(16);
                    column.Item().Border(1).BorderColor(Colors.Teal.Lighten2).Background(Colors.Teal.Lighten5).Padding(14).Text(
                        "Ce document constitue une preuve interne de signature. Il trace l'accord donne via un lien securise OceanERP et ne pretend pas etre une signature qualifiee eIDAS.").FontSize(10);

                    column.Item().Row(row =>
                    {
                        row.RelativeItem().Element(Card).Column(card =>
                        {
                            card.Item().Text("Document").FontSize(9).FontColor(Colors.Grey.Darken2).Bold();
                            card.Item().Text(driveItem.Name).FontSize(13).Bold();
                            card.Item().Text($"Empreinte SHA-256: {evidence.DocumentSha256}").FontSize(8).FontColor(Colors.Grey.Darken1);
                        });

                        row.RelativeItem().Element(Card).Column(card =>
                        {
                            card.Item().Text("Signataire").FontSize(9).FontColor(Colors.Grey.Darken2).Bold();
                            card.Item().Text(recipient.Name ?? recipient.Email).FontSize(13).Bold();
                            card.Item().Text(recipient.Email).FontSize(9).FontColor(Colors.Grey.Darken1);
                        });
                    });

                    column.Item().Element(Card).Column(card =>
                    {
                        card.Spacing(6);
                        card.Item().Text("Preuve").FontSize(12).Bold();
                        Fact(card, "Action", evidence.Action);
                        Fact(card, "Mode", evidence.SignatureMode ?? "Click");
                        Fact(card, "Conditions acceptees", evidence.ConditionsAccepted ? "Oui" : "Non");
                        Fact(card, "IP", evidence.IpAddress ?? "-");
                        Fact(card, "Navigateur", evidence.UserAgent ?? "-");
                        Fact(card, "Empreinte image signature", signatureImageSha256 ?? "-");
                    });

                    column.Item().Element(Card).Column(card =>
                    {
                        card.Item().Text("Signature").FontSize(12).Bold();
                        if (signatureImage is { Length: > 0 })
                        {
                            card.Item().Height(90).Width(260).Image(signatureImage).FitArea();
                        }
                        else
                        {
                            card.Item().PaddingTop(10).Text($"Signe par clic par {recipient.Name ?? recipient.Email}.").FontSize(11);
                        }
                    });
                });

                page.Footer().AlignCenter().DefaultTextStyle(x => x.FontSize(8).FontColor(Colors.Grey.Darken2)).Text(text =>
                {
                    text.Span("OceanERP - piste de preuve interne - Page ");
                    text.CurrentPageNumber();
                    text.Span(" / ");
                    text.TotalPages();
                });
            });
        }).GeneratePdf();

        static IContainer Card(IContainer container)
            => container.Border(1).BorderColor(Colors.Grey.Lighten2).Padding(12);

        static void Fact(ColumnDescriptor column, string label, string value)
        {
            column.Item().Row(row =>
            {
                row.ConstantItem(145).Text(label).FontColor(Colors.Grey.Darken2).Bold();
                row.RelativeItem().Text(value);
            });
        }
    }

    private async Task<IReadOnlyList<SignatureRequestDto>> MapManyAsync(IReadOnlyList<SignatureRequest> requests, Func<SignatureRecipient, string?>? signingUrlFactory, CancellationToken cancellationToken)
    {
        var mapped = new List<SignatureRequestDto>();
        foreach (var request in requests)
        {
            mapped.Add(await MapAsync(request, signingUrlFactory, cancellationToken));
        }

        return mapped;
    }

    private async Task<SignatureRequestDto> MapAsync(SignatureRequest request, Func<SignatureRecipient, string?>? signingUrlFactory, CancellationToken cancellationToken)
    {
        var driveItemName = await db.DriveItems.Where(x => x.Id == request.DriveItemId).Select(x => x.Name).FirstOrDefaultAsync(cancellationToken);
        var recipients = await db.SignatureRecipients.Where(x => x.SignatureRequestId == request.Id).OrderBy(x => x.Email).ToListAsync(cancellationToken);
        var evidence = await db.SignatureEvidences.Where(x => x.SignatureRequestId == request.Id).OrderByDescending(x => x.CreatedAt).ToListAsync(cancellationToken);
        var signedDocuments = await db.SignedDocuments.Where(x => x.SignatureRequestId == request.Id).OrderByDescending(x => x.CreatedAt).ToListAsync(cancellationToken);
        return new SignatureRequestDto(
            request.Id,
            request.DriveItemId,
            driveItemName,
            request.Title,
            request.Status,
            request.ExpiresAt,
            request.CompletedAt,
            recipients.Select(x => new SignatureRecipientDto(x.Id, x.Email, x.Name, x.Status, x.SignedAt, signingUrlFactory?.Invoke(x))).ToList(),
            evidence.Select(x => new SignatureEvidenceDto(x.Id, x.SignatureRecipientId, x.Action, x.DocumentSha256, x.ConditionsAccepted, x.SignatureMode, x.IpAddress, x.UserAgent, x.CreatedAt)).ToList(),
            signedDocuments.Select(x => new SignedDocumentDto(x.Id, x.FileName, x.MimeType, x.Size, x.DocumentSha256, x.CreatedAt)).ToList());
    }

    private static string GenerateToken()
    {
        Span<byte> bytes = stackalloc byte[32];
        RandomNumberGenerator.Fill(bytes);
        return Convert.ToBase64String(bytes).TrimEnd('=').Replace('+', '-').Replace('/', '_');
    }

    private static string GenerateOtpCode()
        => RandomNumberGenerator.GetInt32(0, 1_000_000).ToString("D6");

    private static string Hash(string value)
    {
        var bytes = SHA256.HashData(Encoding.UTF8.GetBytes(value));
        return Convert.ToHexString(bytes).ToLowerInvariant();
    }

    private static string? BuildSigningUrl(string publicBaseUrl, string? token)
    {
        if (string.IsNullOrWhiteSpace(token))
        {
            return null;
        }

        var baseUrl = string.IsNullOrWhiteSpace(publicBaseUrl) ? "/" : publicBaseUrl.TrimEnd('/') + "/";
        return new Uri(new Uri(baseUrl, UriKind.Absolute), $"signature/{Uri.EscapeDataString(token)}").ToString();
    }

    private static string? BuildRelativeSigningUrl(SignatureRecipient recipient)
        => $"/signature/{recipient.Id:N}";

    private static string BuildOtpEmailBody(string? recipientName, string title, string? signingUrl, string otpCode)
    {
        var greeting = string.IsNullOrWhiteSpace(recipientName) ? "Bonjour," : $"Bonjour {recipientName},";
        return $"""
            <p>{greeting}</p>
            <p>Une demande de signature OceanERP vous attend pour le document <strong>{System.Net.WebUtility.HtmlEncode(title)}</strong>.</p>
            <p>Code OTP: <strong style="font-size:18px">{otpCode}</strong></p>
            <p>Ce code expire dans 30 minutes ou a l'expiration du lien.</p>
            <p><a href="{System.Net.WebUtility.HtmlEncode(signingUrl ?? string.Empty)}">Ouvrir la signature</a></p>
            """;
    }

    private static string? NormalizeOptional(string? value)
        => string.IsNullOrWhiteSpace(value) ? null : value.Trim();
}
