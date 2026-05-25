using Erp.Application.Common;

namespace Erp.Application.Calendar;

public sealed record CalendarEventDto(
    Guid Id,
    string Title,
    string? Description,
    string? Location,
    DateTimeOffset StartsAt,
    DateTimeOffset EndsAt,
    bool IsPrivate,
    DateTimeOffset CreatedAt,
    IReadOnlyList<CalendarReminderDto> Reminders,
    IReadOnlyList<CalendarEventLinkDto> Links,
    IReadOnlyList<CalendarParticipantDto> Participants);

public sealed record CalendarReminderDto(Guid Id, DateTimeOffset RemindAt, bool IsSent);
public sealed record CalendarEventLinkDto(Guid Id, string Module, Guid EntityId);
public sealed record CalendarParticipantDto(Guid Id, Guid? UserId, string? Name, string Email, string Type, string Status, DateTimeOffset? InviteSentAt);
public sealed record PublicCalendarInvitationDto(Guid Id, string Title, string? Description, string? Location, DateTimeOffset StartsAt, DateTimeOffset EndsAt, string ParticipantName, string ParticipantEmail, string Status);

public sealed record CreateCalendarEventRequest(
    string Title,
    DateTimeOffset StartsAt,
    DateTimeOffset EndsAt,
    string? Description = null,
    string? Location = null,
    bool IsPrivate = false,
    IReadOnlyList<CreateCalendarReminderRequest>? Reminders = null,
    IReadOnlyList<CreateCalendarEventLinkRequest>? Links = null,
    IReadOnlyList<CreateCalendarParticipantRequest>? Participants = null);

public sealed record UpdateCalendarEventRequest(
    string Title,
    DateTimeOffset StartsAt,
    DateTimeOffset EndsAt,
    string? Description = null,
    string? Location = null,
    bool IsPrivate = false,
    IReadOnlyList<CreateCalendarReminderRequest>? Reminders = null,
    IReadOnlyList<CreateCalendarEventLinkRequest>? Links = null,
    IReadOnlyList<CreateCalendarParticipantRequest>? Participants = null);

public sealed record CreateCalendarReminderRequest(DateTimeOffset RemindAt);
public sealed record CreateCalendarEventLinkRequest(string Module, Guid EntityId);
public sealed record CreateCalendarParticipantRequest(Guid? UserId = null, string? ExternalName = null, string? ExternalEmail = null);
public sealed record UpdateCalendarInvitationStatusRequest(string Status);

public interface ICalendarService
{
    Task<PagedResult<CalendarEventDto>> SearchAsync(DateTimeOffset? from, DateTimeOffset? to, int page, int pageSize, CancellationToken cancellationToken);
    Task<Result<CalendarEventDto>> GetAsync(Guid id, CancellationToken cancellationToken);
    Task<Result<CalendarEventDto>> CreateAsync(CreateCalendarEventRequest request, CancellationToken cancellationToken);
    Task<Result<CalendarEventDto>> UpdateAsync(Guid id, UpdateCalendarEventRequest request, CancellationToken cancellationToken);
    Task<Result> DeleteAsync(Guid id, CancellationToken cancellationToken);
    Task<Result<PublicCalendarInvitationDto>> GetPublicInvitationAsync(string token, CancellationToken cancellationToken);
    Task<Result<PublicCalendarInvitationDto>> UpdatePublicInvitationStatusAsync(string token, UpdateCalendarInvitationStatusRequest request, CancellationToken cancellationToken);
}
