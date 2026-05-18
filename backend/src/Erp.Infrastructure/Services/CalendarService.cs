using Erp.Application.Calendar;
using Erp.Application.Common;
using Erp.Domain.FutureModules;
using Erp.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Erp.Infrastructure.Services;

public sealed class CalendarService(ErpDbContext db) : ICalendarService
{
    public async Task<PagedResult<CalendarEventDto>> SearchAsync(DateTimeOffset? from, DateTimeOffset? to, int page, int pageSize, CancellationToken cancellationToken)
    {
        page = Math.Max(1, page);
        pageSize = Math.Clamp(pageSize, 1, 100);
        var query = db.CalendarEvents.AsQueryable();
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
        db.CalendarEvents.Add(calendarEvent);
        AddChildren(calendarEvent.Id, request.Reminders, request.Links);
        await db.SaveChangesAsync(cancellationToken);
        return Result<CalendarEventDto>.Success(await MapAsync(calendarEvent, cancellationToken));
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

        calendarEvent.Title = request.Title.Trim();
        calendarEvent.Description = NormalizeOptional(request.Description);
        calendarEvent.Location = NormalizeOptional(request.Location);
        calendarEvent.StartsAt = request.StartsAt;
        calendarEvent.EndsAt = request.EndsAt;
        calendarEvent.IsPrivate = request.IsPrivate;

        var oldReminders = await db.CalendarReminders.Where(x => x.CalendarEventId == id).ToListAsync(cancellationToken);
        var oldLinks = await db.CalendarEventLinks.Where(x => x.CalendarEventId == id).ToListAsync(cancellationToken);
        db.CalendarReminders.RemoveRange(oldReminders);
        db.CalendarEventLinks.RemoveRange(oldLinks);
        AddChildren(calendarEvent.Id, request.Reminders, request.Links);

        await db.SaveChangesAsync(cancellationToken);
        return Result<CalendarEventDto>.Success(await MapAsync(calendarEvent, cancellationToken));
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
        db.CalendarEvents.Remove(calendarEvent);
        await db.SaveChangesAsync(cancellationToken);
        return Result.Success();
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
            .Where(x => x.CalendarEventId == calendarEvent.Id)
            .OrderBy(x => x.RemindAt)
            .Select(x => new CalendarReminderDto(x.Id, x.RemindAt, x.IsSent))
            .ToListAsync(cancellationToken);
        var links = await db.CalendarEventLinks
            .Where(x => x.CalendarEventId == calendarEvent.Id)
            .Select(x => new CalendarEventLinkDto(x.Id, x.Module, x.EntityId))
            .ToListAsync(cancellationToken);
        return new CalendarEventDto(calendarEvent.Id, calendarEvent.Title, calendarEvent.Description, calendarEvent.Location, calendarEvent.StartsAt, calendarEvent.EndsAt, calendarEvent.IsPrivate, calendarEvent.CreatedAt, reminders, links);
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

    private static string? NormalizeOptional(string? value)
        => string.IsNullOrWhiteSpace(value) ? null : value.Trim();
}
