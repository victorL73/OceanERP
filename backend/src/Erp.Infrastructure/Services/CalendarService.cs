using System.Net;
using System.Security.Cryptography;
using System.Text;
using Erp.Application.Calendar;
using Erp.Application.Common;
using Erp.Application.Emails;
using Erp.Domain.Auth;
using Erp.Domain.FutureModules;
using Erp.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;

namespace Erp.Infrastructure.Services;

public sealed class CalendarService(ErpDbContext db, IEmailService emailService, IConfiguration configuration) : ICalendarService
{
    public async Task<PagedResult<CalendarEventDto>> SearchAsync(DateTimeOffset? from, DateTimeOffset? to, int page, int pageSize, CancellationToken cancellationToken)
    {
        page = Math.Max(1, page);
        pageSize = Math.Clamp(pageSize, 1, 500);
        var query = db.CalendarEvents.AsNoTracking().AsQueryable();
        if (from.HasValue)
        {
            query = query.Where(x => x.EndsAt >= from.Value);
        }

        if (to.HasValue)
        {
            query = query.Where(x => x.StartsAt <= to.Value);
        }

        var total = await query.CountAsync(cancellationToken);
        var events = await query.OrderBy(x => x.StartsAt).Skip((page - 1) * pageSize).Take(pageSize).ToListAsync(cancellationToken);
        return new PagedResult<CalendarEventDto>(await MapManyAsync(events, cancellationToken), total, page, pageSize);
    }

    public async Task<Result<CalendarEventDto>> GetAsync(Guid id, CancellationToken cancellationToken)
    {
        var calendarEvent = await db.CalendarEvents.AsNoTracking().FirstOrDefaultAsync(x => x.Id == id, cancellationToken);
        return calendarEvent is null
            ? Result<CalendarEventDto>.Failure("Evenement introuvable.")
            : Result<CalendarEventDto>.Success(await MapAsync(calendarEvent, cancellationToken));
    }

    public async Task<Result<CalendarEventDto>> CreateAsync(CreateCalendarEventRequest request, CancellationToken cancellationToken)
    {
        var validation = Validate(request.Title, request.StartsAt, request.EndsAt);
        if (!validation.Succeeded)
        {
            return Result<CalendarEventDto>.Failure(validation.Error!);
        }

        var calendarEvent = new CalendarEvent
        {
            Title = request.Title.Trim(),
            Description = NormalizeOptional(request.Description),
            Location = NormalizeOptional(request.Location),
            StartsAt = request.StartsAt,
            EndsAt = request.EndsAt,
            IsPrivate = request.IsPrivate
        };
        return await SaveCalendarMutationAsync(async () =>
        {
            db.CalendarEvents.Add(calendarEvent);
            AddChildren(calendarEvent.Id, request.Reminders, request.Links);
            var pendingInvitations = new List<PendingInvitation>();
            var participantResult = await AddParticipantsAsync(calendarEvent.Id, request.Participants, pendingInvitations, cancellationToken);
            if (!participantResult.Succeeded)
            {
                return Result<CalendarEventDto>.Failure(participantResult.Error!);
            }

            await db.SaveChangesAsync(cancellationToken);
            var inviteResult = await SendPendingInvitationsAsync(calendarEvent, pendingInvitations, cancellationToken);
            if (!inviteResult.Succeeded)
            {
                return Result<CalendarEventDto>.Failure(inviteResult.Error!);
            }

            await db.SaveChangesAsync(cancellationToken);
            return Result<CalendarEventDto>.Success(await MapAsync(calendarEvent, cancellationToken));
        }, cancellationToken);
    }

    public async Task<Result<CalendarEventDto>> UpdateAsync(Guid id, UpdateCalendarEventRequest request, CancellationToken cancellationToken)
    {
        var calendarEvent = await db.CalendarEvents.FirstOrDefaultAsync(x => x.Id == id, cancellationToken);
        if (calendarEvent is null)
        {
            return Result<CalendarEventDto>.Failure("Evenement introuvable.");
        }

        var validation = Validate(request.Title, request.StartsAt, request.EndsAt);
        if (!validation.Succeeded)
        {
            return Result<CalendarEventDto>.Failure(validation.Error!);
        }

        return await SaveCalendarMutationAsync(async () =>
        {
            calendarEvent.Title = request.Title.Trim();
            calendarEvent.Description = NormalizeOptional(request.Description);
            calendarEvent.Location = NormalizeOptional(request.Location);
            calendarEvent.StartsAt = request.StartsAt;
            calendarEvent.EndsAt = request.EndsAt;
            calendarEvent.IsPrivate = request.IsPrivate;

            db.CalendarReminders.RemoveRange(await db.CalendarReminders.Where(x => x.CalendarEventId == id).ToListAsync(cancellationToken));
            db.CalendarEventLinks.RemoveRange(await db.CalendarEventLinks.Where(x => x.CalendarEventId == id).ToListAsync(cancellationToken));
            db.CalendarParticipants.RemoveRange(await db.CalendarParticipants.Where(x => x.CalendarEventId == id).ToListAsync(cancellationToken));
            AddChildren(calendarEvent.Id, request.Reminders, request.Links);

            var pendingInvitations = new List<PendingInvitation>();
            var participantResult = await AddParticipantsAsync(calendarEvent.Id, request.Participants, pendingInvitations, cancellationToken);
            if (!participantResult.Succeeded)
            {
                return Result<CalendarEventDto>.Failure(participantResult.Error!);
            }

            await db.SaveChangesAsync(cancellationToken);
            var inviteResult = await SendPendingInvitationsAsync(calendarEvent, pendingInvitations, cancellationToken);
            if (!inviteResult.Succeeded)
            {
                return Result<CalendarEventDto>.Failure(inviteResult.Error!);
            }

            await db.SaveChangesAsync(cancellationToken);
            return Result<CalendarEventDto>.Success(await MapAsync(calendarEvent, cancellationToken));
        }, cancellationToken);
    }

    public async Task<Result> DeleteAsync(Guid id, CancellationToken cancellationToken)
    {
        var calendarEvent = await db.CalendarEvents.FirstOrDefaultAsync(x => x.Id == id, cancellationToken);
        if (calendarEvent is null)
        {
            return Result.Failure("Evenement introuvable.");
        }

        db.CalendarReminders.RemoveRange(await db.CalendarReminders.Where(x => x.CalendarEventId == id).ToListAsync(cancellationToken));
        db.CalendarEventLinks.RemoveRange(await db.CalendarEventLinks.Where(x => x.CalendarEventId == id).ToListAsync(cancellationToken));
        db.CalendarParticipants.RemoveRange(await db.CalendarParticipants.Where(x => x.CalendarEventId == id).ToListAsync(cancellationToken));
        db.CalendarEvents.Remove(calendarEvent);
        await db.SaveChangesAsync(cancellationToken);
        return Result.Success();
    }

    public async Task<Result<PublicCalendarInvitationDto>> GetPublicInvitationAsync(string token, CancellationToken cancellationToken)
    {
        var participant = await FindParticipantByTokenAsync(token, cancellationToken);
        if (participant is null)
        {
            return Result<PublicCalendarInvitationDto>.Failure("Invitation agenda introuvable.");
        }

        var calendarEvent = await db.CalendarEvents.AsNoTracking().FirstOrDefaultAsync(x => x.Id == participant.CalendarEventId, cancellationToken);
        return calendarEvent is null
            ? Result<PublicCalendarInvitationDto>.Failure("Evenement introuvable.")
            : Result<PublicCalendarInvitationDto>.Success(ToPublicDto(calendarEvent, participant));
    }

    public async Task<Result<PublicCalendarInvitationDto>> UpdatePublicInvitationStatusAsync(string token, UpdateCalendarInvitationStatusRequest request, CancellationToken cancellationToken)
    {
        var participant = await FindParticipantByTokenAsync(token, cancellationToken);
        if (participant is null)
        {
            return Result<PublicCalendarInvitationDto>.Failure("Invitation agenda introuvable.");
        }

        var status = NormalizeInvitationStatus(request.Status);
        if (status is null)
        {
            return Result<PublicCalendarInvitationDto>.Failure("Statut d'invitation invalide.");
        }

        participant.Status = status;
        participant.RespondedAt = DateTimeOffset.UtcNow;
        await db.SaveChangesAsync(cancellationToken);

        var calendarEvent = await db.CalendarEvents.AsNoTracking().FirstAsync(x => x.Id == participant.CalendarEventId, cancellationToken);
        return Result<PublicCalendarInvitationDto>.Success(ToPublicDto(calendarEvent, participant));
    }

    private void AddChildren(Guid eventId, IReadOnlyList<CreateCalendarReminderRequest>? reminders, IReadOnlyList<CreateCalendarEventLinkRequest>? links)
    {
        foreach (var reminder in reminders ?? [])
        {
            db.CalendarReminders.Add(new CalendarReminder { CalendarEventId = eventId, RemindAt = reminder.RemindAt });
        }

        foreach (var link in links ?? [])
        {
            if (!string.IsNullOrWhiteSpace(link.Module))
            {
                db.CalendarEventLinks.Add(new CalendarEventLink { CalendarEventId = eventId, Module = link.Module.Trim().ToLowerInvariant(), EntityId = link.EntityId });
            }
        }
    }

    private async Task<Result> AddParticipantsAsync(Guid eventId, IReadOnlyList<CreateCalendarParticipantRequest>? participants, List<PendingInvitation> pendingInvitations, CancellationToken cancellationToken)
    {
        var seenUsers = new HashSet<Guid>();
        var seenEmails = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        foreach (var request in participants ?? [])
        {
            if (request.UserId.HasValue)
            {
                if (!seenUsers.Add(request.UserId.Value))
                {
                    continue;
                }

                var user = await db.Users.AsNoTracking().FirstOrDefaultAsync(x => x.Id == request.UserId.Value && x.IsActive, cancellationToken);
                if (user is null)
                {
                    return Result.Failure("Participant interne introuvable ou inactif.");
                }

                db.CalendarParticipants.Add(new CalendarParticipant
                {
                    CalendarEventId = eventId,
                    UserId = user.Id,
                    Type = "Internal",
                    Status = "Invited"
                });
                continue;
            }

            var email = NormalizeOptional(request.ExternalEmail);
            if (email is null)
            {
                continue;
            }

            if (!email.Contains('@', StringComparison.Ordinal) || !seenEmails.Add(email))
            {
                return Result.Failure($"Email invite invalide ou en doublon: {email}.");
            }

            var token = GenerateToken();
            var participant = new CalendarParticipant
            {
                CalendarEventId = eventId,
                ExternalName = NormalizeOptional(request.ExternalName) ?? email,
                ExternalEmail = email,
                Type = "External",
                Status = "Invited",
                InviteTokenHash = HashToken(token)
            };
            db.CalendarParticipants.Add(participant);
            pendingInvitations.Add(new PendingInvitation(participant, token));
        }

        return Result.Success();
    }

    private async Task<Result<CalendarEventDto>> SaveCalendarMutationAsync(Func<Task<Result<CalendarEventDto>>> mutation, CancellationToken cancellationToken)
    {
        if (db.Database.ProviderName == "Microsoft.EntityFrameworkCore.InMemory")
        {
            return await mutation();
        }

        await using var transaction = await db.Database.BeginTransactionAsync(cancellationToken);
        var result = await mutation();
        if (!result.Succeeded)
        {
            await transaction.RollbackAsync(cancellationToken);
            return result;
        }

        await transaction.CommitAsync(cancellationToken);
        return result;
    }

    private async Task<Result> SendPendingInvitationsAsync(CalendarEvent calendarEvent, IReadOnlyList<PendingInvitation> pendingInvitations, CancellationToken cancellationToken)
    {
        if (pendingInvitations.Count == 0)
        {
            return Result.Success();
        }

        var mailAccountId = await ResolveSystemMailAccountIdAsync(cancellationToken);
        if (!mailAccountId.HasValue)
        {
            return Result.Failure("Aucune boite mail systeme active n'est configuree pour envoyer les invitations agenda.");
        }

        foreach (var invitation in pendingInvitations)
        {
            var email = invitation.Participant.ExternalEmail;
            if (string.IsNullOrWhiteSpace(email))
            {
                continue;
            }

            var link = BuildPublicInvitationUrl(invitation.Token);
            var body = BuildInvitationEmail(calendarEvent, invitation.Participant, link);
            var result = await emailService.SendAsync(new SendEmailRequest(mailAccountId.Value, email, $"Invitation agenda - {calendarEvent.Title}", body), cancellationToken);
            if (!result.Succeeded)
            {
                return Result.Failure($"Envoi invitation agenda impossible vers {email}: {result.Error}");
            }

            invitation.Participant.InviteSentAt = DateTimeOffset.UtcNow;
        }

        return Result.Success();
    }

    private async Task<Guid?> ResolveSystemMailAccountIdAsync(CancellationToken cancellationToken)
    {
        var configuredDefault = await db.MailServerSettings
            .AsNoTracking()
            .OrderByDescending(x => x.UpdatedAt ?? x.CreatedAt)
            .Select(x => x.DefaultSystemMailAccountId)
            .FirstOrDefaultAsync(cancellationToken);

        if (configuredDefault.HasValue && await db.MailAccounts.AsNoTracking().AnyAsync(x => x.Id == configuredDefault.Value && x.IsActive, cancellationToken))
        {
            return configuredDefault.Value;
        }

        return await db.MailAccounts
            .AsNoTracking()
            .Where(x => x.IsActive)
            .OrderBy(x => x.Email)
            .Select(x => (Guid?)x.Id)
            .FirstOrDefaultAsync(cancellationToken);
    }

    private async Task<CalendarParticipant?> FindParticipantByTokenAsync(string token, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(token))
        {
            return null;
        }

        var hash = HashToken(token.Trim());
        return await db.CalendarParticipants.FirstOrDefaultAsync(x => x.InviteTokenHash == hash && x.Type == "External", cancellationToken);
    }

    private async Task<IReadOnlyList<CalendarEventDto>> MapManyAsync(IReadOnlyList<CalendarEvent> events, CancellationToken cancellationToken)
    {
        var mapped = new List<CalendarEventDto>();
        foreach (var calendarEvent in events)
        {
            mapped.Add(await MapAsync(calendarEvent, cancellationToken));
        }

        return mapped;
    }

    private async Task<CalendarEventDto> MapAsync(CalendarEvent calendarEvent, CancellationToken cancellationToken)
    {
        var reminders = await db.CalendarReminders
            .AsNoTracking()
            .Where(x => x.CalendarEventId == calendarEvent.Id)
            .OrderBy(x => x.RemindAt)
            .Select(x => new CalendarReminderDto(x.Id, x.RemindAt, x.IsSent))
            .ToListAsync(cancellationToken);
        var links = await db.CalendarEventLinks
            .AsNoTracking()
            .Where(x => x.CalendarEventId == calendarEvent.Id)
            .Select(x => new CalendarEventLinkDto(x.Id, x.Module, x.EntityId))
            .ToListAsync(cancellationToken);
        var participants = await MapParticipantsAsync(calendarEvent.Id, cancellationToken);
        return new CalendarEventDto(calendarEvent.Id, calendarEvent.Title, calendarEvent.Description, calendarEvent.Location, calendarEvent.StartsAt, calendarEvent.EndsAt, calendarEvent.IsPrivate, calendarEvent.CreatedAt, reminders, links, participants);
    }

    private async Task<IReadOnlyList<CalendarParticipantDto>> MapParticipantsAsync(Guid eventId, CancellationToken cancellationToken)
    {
        var participants = await db.CalendarParticipants
            .AsNoTracking()
            .Where(x => x.CalendarEventId == eventId)
            .OrderBy(x => x.Type)
            .ThenBy(x => x.ExternalName ?? x.ExternalEmail)
            .ToListAsync(cancellationToken);
        var userIds = participants.Where(x => x.UserId.HasValue).Select(x => x.UserId!.Value).Distinct().ToList();
        var users = userIds.Count == 0
            ? new Dictionary<Guid, User>()
            : await db.Users.AsNoTracking().Where(x => userIds.Contains(x.Id)).ToDictionaryAsync(x => x.Id, cancellationToken);

        return participants
            .Select(participant =>
            {
                users.TryGetValue(participant.UserId ?? Guid.Empty, out var user);
                var name = user?.DisplayName ?? participant.ExternalName;
                var email = user?.Email ?? participant.ExternalEmail ?? string.Empty;
                return new CalendarParticipantDto(participant.Id, participant.UserId, name, email, participant.Type, participant.Status, participant.InviteSentAt);
            })
            .ToList();
    }

    private static Result Validate(string title, DateTimeOffset startsAt, DateTimeOffset endsAt)
    {
        if (string.IsNullOrWhiteSpace(title))
        {
            return Result.Failure("Titre obligatoire.");
        }

        if (endsAt <= startsAt)
        {
            return Result.Failure("La fin doit etre apres le debut.");
        }

        return Result.Success();
    }

    private static PublicCalendarInvitationDto ToPublicDto(CalendarEvent calendarEvent, CalendarParticipant participant)
        => new(
            calendarEvent.Id,
            calendarEvent.Title,
            calendarEvent.Description,
            calendarEvent.Location,
            calendarEvent.StartsAt,
            calendarEvent.EndsAt,
            participant.ExternalName ?? participant.ExternalEmail ?? "Invite",
            participant.ExternalEmail ?? string.Empty,
            participant.Status);

    private static string? NormalizeInvitationStatus(string status)
        => status.Trim().ToLowerInvariant() switch
        {
            "accepted" or "accept" or "accepte" or "oui" => "Accepted",
            "declined" or "decline" or "refuse" or "non" => "Declined",
            "tentative" or "maybe" or "peut-etre" => "Tentative",
            _ => null
        };

    private static string BuildInvitationEmail(CalendarEvent calendarEvent, CalendarParticipant participant, string link)
    {
        var name = WebUtility.HtmlEncode(participant.ExternalName ?? participant.ExternalEmail ?? "invite");
        var title = WebUtility.HtmlEncode(calendarEvent.Title);
        var location = string.IsNullOrWhiteSpace(calendarEvent.Location) ? "-" : WebUtility.HtmlEncode(calendarEvent.Location);
        var description = string.IsNullOrWhiteSpace(calendarEvent.Description) ? string.Empty : $"<p>{WebUtility.HtmlEncode(calendarEvent.Description).Replace("\n", "<br>", StringComparison.Ordinal)}</p>";
        return $"""
            <p>Bonjour {name},</p>
            <p>Vous etes invite a l'evenement <strong>{title}</strong>.</p>
            <p><strong>Debut:</strong> {calendarEvent.StartsAt:dd/MM/yyyy HH:mm}<br>
            <strong>Fin:</strong> {calendarEvent.EndsAt:dd/MM/yyyy HH:mm}<br>
            <strong>Lieu:</strong> {location}</p>
            {description}
            <p><a href="{WebUtility.HtmlEncode(link)}">Ouvrir l'invitation et repondre</a></p>
            """;
    }

    private string BuildPublicInvitationUrl(string token)
    {
        var publicUri = configuration["PUBLIC_URI"]
            ?? configuration["PublicUri"]
            ?? configuration["App:PublicUri"]
            ?? "http://localhost:8080";
        return $"{publicUri.TrimEnd('/')}/calendar/invitations/{Uri.EscapeDataString(token)}";
    }

    private static string GenerateToken()
        => Convert.ToHexString(RandomNumberGenerator.GetBytes(32)).ToLowerInvariant();

    private static string HashToken(string token)
        => Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(token))).ToLowerInvariant();

    private static string? NormalizeOptional(string? value)
        => string.IsNullOrWhiteSpace(value) ? null : value.Trim();

    private sealed record PendingInvitation(CalendarParticipant Participant, string Token);
}
