using System.Security.Cryptography;
using System.Text;
using Erp.Application.Common;
using Erp.Application.Documents;
using Erp.Application.Signatures;
using Erp.Domain.FutureModules;
using Erp.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Erp.Infrastructure.Services;

public sealed class SignatureService(ErpDbContext db, IFileStorageService fileStorageService) : ISignatureService
{
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
        return new PagedResult<SignatureRequestDto>(await MapManyAsync(requests, null, cancellationToken), total, page, pageSize);
    }

    public async Task<Result<SignatureRequestDto>> GetAsync(Guid id, CancellationToken cancellationToken)
    {
        var request = await db.SignatureRequests.AsNoTracking().FirstOrDefaultAsync(x => x.Id == id, cancellationToken);
        return request is null
            ? Result<SignatureRequestDto>.Failure("Demande de signature introuvable.")
            : Result<SignatureRequestDto>.Success(await MapAsync(request, null, cancellationToken));
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

        var signatureRequest = new SignatureRequest
        {
            DriveItemId = request.DriveItemId,
            Title = string.IsNullOrWhiteSpace(request.Title) ? driveItem.Name : request.Title.Trim(),
            Status = "Pending",
            ExpiresAt = request.ExpiresAt
        };
        db.SignatureRequests.Add(signatureRequest);

        var tokenByRecipientId = new Dictionary<Guid, string>();
        foreach (var recipientRequest in request.Recipients)
        {
            if (string.IsNullOrWhiteSpace(recipientRequest.Email))
            {
                return Result<SignatureRequestDto>.Failure("Email destinataire obligatoire.");
            }

            var token = GenerateToken();
            var recipient = new SignatureRecipient
            {
                SignatureRequestId = signatureRequest.Id,
                Email = recipientRequest.Email.Trim(),
                Name = NormalizeOptional(recipientRequest.Name),
                TokenHash = Hash(token),
                Status = "Pending"
            };
            db.SignatureRecipients.Add(recipient);
            tokenByRecipientId[recipient.Id] = token;
        }

        await db.SaveChangesAsync(cancellationToken);
        var saved = await db.SignatureRequests.AsNoTracking().FirstAsync(x => x.Id == signatureRequest.Id, cancellationToken);
        return Result<SignatureRequestDto>.Success(await MapAsync(saved, (recipient) => BuildSigningUrl(publicBaseUrl, tokenByRecipientId.GetValueOrDefault(recipient.Id)), cancellationToken));
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
        return Result<PublicSignatureDto>.Success(new PublicSignatureDto(request.Id, recipient.Id, request.Title, driveItem?.Name ?? request.DriveItemId.ToString(), request.ExpiresAt, recipient.Status));
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
        if (signatureRequest.ExpiresAt <= DateTimeOffset.UtcNow)
        {
            signatureRequest.Status = "Expired";
            await db.SaveChangesAsync(cancellationToken);
            return Result<SignatureRequestDto>.Failure("Lien de signature expire.");
        }

        var driveItem = await db.DriveItems.FirstOrDefaultAsync(x => x.Id == signatureRequest.DriveItemId && !x.IsTrashed, cancellationToken);
        if (driveItem is null)
        {
            return Result<SignatureRequestDto>.Failure("Document signe introuvable.");
        }

        var sha256 = await ComputeSha256Async(driveItem.StoragePath, cancellationToken);
        recipient.Status = "Signed";
        recipient.SignedAt = DateTimeOffset.UtcNow;

        db.SignatureEvidences.Add(new SignatureEvidence
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
        });

        var recipients = await db.SignatureRecipients.Where(x => x.SignatureRequestId == signatureRequest.Id).ToListAsync(cancellationToken);
        if (recipients.All(x => x.Id == recipient.Id || string.Equals(x.Status, "Signed", StringComparison.OrdinalIgnoreCase)))
        {
            signatureRequest.Status = "Completed";
            signatureRequest.CompletedAt = DateTimeOffset.UtcNow;
            if (!await db.SignedDocuments.AnyAsync(x => x.SignatureRequestId == signatureRequest.Id, cancellationToken))
            {
                db.SignedDocuments.Add(new SignedDocument
                {
                    SignatureRequestId = signatureRequest.Id,
                    FileName = $"signed-{driveItem.Name}",
                    MimeType = driveItem.MimeType,
                    Size = driveItem.Size,
                    StoragePath = driveItem.StoragePath,
                    DocumentSha256 = sha256
                });
            }
        }

        await db.SaveChangesAsync(cancellationToken);
        return Result<SignatureRequestDto>.Success(await MapAsync(signatureRequest, null, cancellationToken));
    }

    private async Task<SignatureRecipient?> FindRecipientByTokenAsync(string token, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(token))
        {
            return null;
        }

        var tokenHash = Hash(token.Trim());
        return await db.SignatureRecipients.FirstOrDefaultAsync(x => x.TokenHash == tokenHash, cancellationToken);
    }

    private async Task<string> ComputeSha256Async(string storagePath, CancellationToken cancellationToken)
    {
        await using var stream = await fileStorageService.OpenReadAsync(storagePath, cancellationToken);
        var hash = await SHA256.HashDataAsync(stream, cancellationToken);
        return Convert.ToHexString(hash).ToLowerInvariant();
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

    private static string? NormalizeOptional(string? value)
        => string.IsNullOrWhiteSpace(value) ? null : value.Trim();
}
