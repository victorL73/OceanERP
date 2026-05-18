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
    IReadOnlyList<CalendarEventLinkDto> Links);

public sealed record CalendarReminderDto(Guid Id, DateTimeOffset RemindAt, bool IsSent);
public sealed record CalendarEventLinkDto(Guid Id, string Module, Guid EntityId);

public sealed record CreateCalendarEventRequest(
    string Title,
    DateTimeOffset StartsAt,
    DateTimeOffset EndsAt,
    string? Description = null,
    string? Location = null,
    bool IsPrivate = false,
    IReadOnlyList<CreateCalendarReminderRequest>? Reminders = null,
    IReadOnlyList<CreateCalendarEventLinkRequest>? Links = null);

public sealed record UpdateCalendarEventRequest(
    string Title,
    DateTimeOffset StartsAt,
    DateTimeOffset EndsAt,
    string? Description = null,
    string? Location = null,
    bool IsPrivate = false,
    IReadOnlyList<CreateCalendarReminderRequest>? Reminders = null,
    IReadOnlyList<CreateCalendarEventLinkRequest>? Links = null);

public sealed record CreateCalendarReminderRequest(DateTimeOffset RemindAt);
public sealed record CreateCalendarEventLinkRequest(string Module, Guid EntityId);

public interface ICalendarService
{
    Task<PagedResult<CalendarEventDto>> SearchAsync(DateTimeOffset? from, DateTimeOffset? to, int page, int pageSize, CancellationToken cancellationToken);
    Task<Result<CalendarEventDto>> GetAsync(Guid id, CancellationToken cancellationToken);
    Task<Result<CalendarEventDto>> CreateAsync(CreateCalendarEventRequest request, CancellationToken cancellationToken);
    Task<Result<CalendarEventDto>> UpdateAsync(Guid id, UpdateCalendarEventRequest request, CancellationToken cancellationToken);
    Task<Result> DeleteAsync(Guid id, CancellationToken cancellationToken);
}
