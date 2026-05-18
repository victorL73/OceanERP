using Erp.Application.Common;
using Erp.Application.ServiceTickets;
using Erp.Domain.FutureModules;
using Erp.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Erp.Infrastructure.Services;

public sealed class ServiceTicketService(ErpDbContext db, ICurrentUserService currentUser) : IServiceTicketService
{
    private static readonly string[] AllowedStatuses = ["Open", "InProgress", "WaitingCustomer", "Resolved", "Closed"];
    private static readonly string[] AllowedPriorities = ["Low", "Normal", "High", "Urgent"];

    public async Task<PagedResult<ServiceTicketDto>> SearchAsync(string? search, string? status, int page, int pageSize, CancellationToken cancellationToken)
    {
        page = Math.Max(1, page);
        pageSize = Math.Clamp(pageSize, 1, 100);

        var query = db.ServiceTickets.AsQueryable();
        if (!string.IsNullOrWhiteSpace(search))
        {
            var term = search.Trim().ToLower();
            query = query.Where(x => x.Number.ToLower().Contains(term) || x.Subject.ToLower().Contains(term));
        }

        if (!string.IsNullOrWhiteSpace(status))
        {
            query = query.Where(x => x.Status == status);
        }

        var total = await query.CountAsync(cancellationToken);
        var tickets = await query.OrderByDescending(x => x.CreatedAt).Skip((page - 1) * pageSize).Take(pageSize).ToListAsync(cancellationToken);
        return new PagedResult<ServiceTicketDto>(await MapManyAsync(tickets, cancellationToken), total, page, pageSize);
    }

    public async Task<Result<ServiceTicketDto>> GetAsync(Guid id, CancellationToken cancellationToken)
    {
        var ticket = await db.ServiceTickets.AsNoTracking().FirstOrDefaultAsync(x => x.Id == id, cancellationToken);
        return ticket is null
            ? Result<ServiceTicketDto>.Failure("Ticket SAV introuvable.")
            : Result<ServiceTicketDto>.Success(await MapAsync(ticket, cancellationToken));
    }

    public async Task<Result<ServiceTicketDto>> CreateAsync(CreateServiceTicketRequest request, CancellationToken cancellationToken)
    {
        var validation = await ValidateAsync(request.CustomerId, request.ProductId, request.SalesOrderId, request.Subject, request.Priority, "Open", cancellationToken);
        if (!validation.Succeeded)
        {
            return Result<ServiceTicketDto>.Failure(validation.Error!);
        }

        var ticket = new ServiceTicket
        {
            Number = await NextNumberAsync(cancellationToken),
            CustomerId = request.CustomerId,
            ProductId = request.ProductId,
            SalesOrderId = request.SalesOrderId,
            Subject = request.Subject.Trim(),
            Description = NormalizeOptional(request.Description),
            Priority = NormalizePriority(request.Priority),
            Status = "Open"
        };

        db.ServiceTickets.Add(ticket);
        db.ServiceTicketStatusHistories.Add(new ServiceTicketStatusHistory
        {
            ServiceTicketId = ticket.Id,
            Status = ticket.Status,
            Comment = "Ticket cree",
            ChangedByUserId = currentUser.UserId
        });

        if (!string.IsNullOrWhiteSpace(ticket.Description))
        {
            db.ServiceTicketMessages.Add(new ServiceTicketMessage
            {
                ServiceTicketId = ticket.Id,
                AuthorUserId = currentUser.UserId,
                Body = ticket.Description,
                IsInternal = false
            });
        }

        await db.SaveChangesAsync(cancellationToken);
        return Result<ServiceTicketDto>.Success(await MapAsync(ticket, cancellationToken));
    }

    public async Task<Result<ServiceTicketDto>> UpdateAsync(Guid id, UpdateServiceTicketRequest request, CancellationToken cancellationToken)
    {
        var ticket = await db.ServiceTickets.FirstOrDefaultAsync(x => x.Id == id, cancellationToken);
        if (ticket is null)
        {
            return Result<ServiceTicketDto>.Failure("Ticket SAV introuvable.");
        }

        var nextStatus = NormalizeStatus(request.Status);
        var validation = await ValidateAsync(ticket.CustomerId, request.ProductId, request.SalesOrderId, request.Subject, request.Priority, nextStatus, cancellationToken);
        if (!validation.Succeeded)
        {
            return Result<ServiceTicketDto>.Failure(validation.Error!);
        }

        var statusChanged = ticket.Status != nextStatus;
        ticket.ProductId = request.ProductId;
        ticket.SalesOrderId = request.SalesOrderId;
        ticket.Subject = request.Subject.Trim();
        ticket.Description = NormalizeOptional(request.Description);
        ticket.Priority = NormalizePriority(request.Priority);
        ticket.Status = nextStatus;

        if (statusChanged)
        {
            db.ServiceTicketStatusHistories.Add(new ServiceTicketStatusHistory
            {
                ServiceTicketId = ticket.Id,
                Status = ticket.Status,
                Comment = "Statut modifie",
                ChangedByUserId = currentUser.UserId
            });
        }

        await db.SaveChangesAsync(cancellationToken);
        return Result<ServiceTicketDto>.Success(await MapAsync(ticket, cancellationToken));
    }

    public async Task<Result<ServiceTicketDto>> ChangeStatusAsync(Guid id, UpdateServiceTicketStatusRequest request, CancellationToken cancellationToken)
    {
        var nextStatus = NormalizeStatus(request.Status);
        if (!AllowedStatuses.Contains(nextStatus))
        {
            return Result<ServiceTicketDto>.Failure("Statut SAV inconnu.");
        }

        var ticket = await db.ServiceTickets.FirstOrDefaultAsync(x => x.Id == id, cancellationToken);
        if (ticket is null)
        {
            return Result<ServiceTicketDto>.Failure("Ticket SAV introuvable.");
        }

        ticket.Status = nextStatus;
        db.ServiceTicketStatusHistories.Add(new ServiceTicketStatusHistory
        {
            ServiceTicketId = ticket.Id,
            Status = ticket.Status,
            Comment = NormalizeOptional(request.Comment),
            ChangedByUserId = currentUser.UserId
        });

        await db.SaveChangesAsync(cancellationToken);
        return Result<ServiceTicketDto>.Success(await MapAsync(ticket, cancellationToken));
    }

    public async Task<Result<ServiceTicketMessageDto>> AddMessageAsync(Guid id, CreateServiceTicketMessageRequest request, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.Body))
        {
            return Result<ServiceTicketMessageDto>.Failure("Message obligatoire.");
        }

        if (!await db.ServiceTickets.AnyAsync(x => x.Id == id, cancellationToken))
        {
            return Result<ServiceTicketMessageDto>.Failure("Ticket SAV introuvable.");
        }

        if (request.AttachmentDriveItemId.HasValue && !await db.DriveItems.AnyAsync(x => x.Id == request.AttachmentDriveItemId.Value && !x.IsTrashed, cancellationToken))
        {
            return Result<ServiceTicketMessageDto>.Failure("Piece jointe Drive introuvable.");
        }

        var message = new ServiceTicketMessage
        {
            ServiceTicketId = id,
            AuthorUserId = currentUser.UserId,
            Body = request.Body.Trim(),
            IsInternal = request.IsInternal,
            AttachmentDriveItemId = request.AttachmentDriveItemId
        };

        db.ServiceTicketMessages.Add(message);
        await db.SaveChangesAsync(cancellationToken);
        return Result<ServiceTicketMessageDto>.Success(await MapMessageAsync(message, cancellationToken));
    }

    private async Task<Result> ValidateAsync(Guid requestCustomerId, Guid? productId, Guid? salesOrderId, string subject, string priority, string status, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(subject))
        {
            return Result.Failure("Sujet obligatoire.");
        }

        if (!AllowedPriorities.Contains(NormalizePriority(priority)))
        {
            return Result.Failure("Priorite SAV inconnue.");
        }

        if (!AllowedStatuses.Contains(status))
        {
            return Result.Failure("Statut SAV inconnu.");
        }

        if (!await db.Customers.AnyAsync(x => x.Id == requestCustomerId, cancellationToken))
        {
            return Result.Failure("Client introuvable.");
        }

        if (productId.HasValue && !await db.Products.AnyAsync(x => x.Id == productId.Value, cancellationToken))
        {
            return Result.Failure("Produit introuvable.");
        }

        if (salesOrderId.HasValue && !await db.SalesOrders.AnyAsync(x => x.Id == salesOrderId.Value, cancellationToken))
        {
            return Result.Failure("Commande introuvable.");
        }

        return Result.Success();
    }

    private async Task<IReadOnlyList<ServiceTicketDto>> MapManyAsync(IReadOnlyList<ServiceTicket> tickets, CancellationToken cancellationToken)
    {
        var mapped = new List<ServiceTicketDto>();
        foreach (var ticket in tickets)
        {
            mapped.Add(await MapAsync(ticket, cancellationToken));
        }

        return mapped;
    }

    private async Task<ServiceTicketDto> MapAsync(ServiceTicket ticket, CancellationToken cancellationToken)
    {
        var customerName = await db.Customers.Where(x => x.Id == ticket.CustomerId).Select(x => x.CompanyName).FirstOrDefaultAsync(cancellationToken) ?? ticket.CustomerId.ToString();
        var product = ticket.ProductId.HasValue
            ? await db.Products.Where(x => x.Id == ticket.ProductId.Value).Select(x => new { x.Reference, x.Name }).FirstOrDefaultAsync(cancellationToken)
            : null;
        var salesOrderNumber = ticket.SalesOrderId.HasValue
            ? await db.SalesOrders.Where(x => x.Id == ticket.SalesOrderId.Value).Select(x => x.Number).FirstOrDefaultAsync(cancellationToken)
            : null;
        var messages = await db.ServiceTicketMessages.Where(x => x.ServiceTicketId == ticket.Id).OrderByDescending(x => x.CreatedAt).ToListAsync(cancellationToken);
        var histories = await db.ServiceTicketStatusHistories.Where(x => x.ServiceTicketId == ticket.Id).OrderByDescending(x => x.ChangedAt).ToListAsync(cancellationToken);

        return new ServiceTicketDto(
            ticket.Id,
            ticket.Number,
            ticket.CustomerId,
            customerName,
            ticket.ProductId,
            product?.Reference,
            product?.Name,
            ticket.SalesOrderId,
            salesOrderNumber,
            ticket.Subject,
            ticket.Description,
            ticket.Priority,
            ticket.Status,
            ticket.CreatedAt,
            ticket.UpdatedAt,
            await MapMessagesAsync(messages, cancellationToken),
            await MapHistoryAsync(histories, cancellationToken));
    }

    private async Task<IReadOnlyList<ServiceTicketMessageDto>> MapMessagesAsync(IReadOnlyList<ServiceTicketMessage> messages, CancellationToken cancellationToken)
    {
        var mapped = new List<ServiceTicketMessageDto>();
        foreach (var message in messages)
        {
            mapped.Add(await MapMessageAsync(message, cancellationToken));
        }

        return mapped;
    }

    private async Task<ServiceTicketMessageDto> MapMessageAsync(ServiceTicketMessage message, CancellationToken cancellationToken)
    {
        var authorName = message.AuthorUserId.HasValue
            ? await db.Users.Where(x => x.Id == message.AuthorUserId.Value).Select(x => x.DisplayName).FirstOrDefaultAsync(cancellationToken)
            : null;
        return new ServiceTicketMessageDto(message.Id, message.AuthorUserId, authorName, message.Body, message.IsInternal, message.AttachmentDriveItemId, message.CreatedAt);
    }

    private async Task<IReadOnlyList<ServiceTicketStatusHistoryDto>> MapHistoryAsync(IReadOnlyList<ServiceTicketStatusHistory> histories, CancellationToken cancellationToken)
    {
        var mapped = new List<ServiceTicketStatusHistoryDto>();
        foreach (var history in histories)
        {
            var changedBy = history.ChangedByUserId.HasValue
                ? await db.Users.Where(x => x.Id == history.ChangedByUserId.Value).Select(x => x.DisplayName).FirstOrDefaultAsync(cancellationToken)
                : null;
            mapped.Add(new ServiceTicketStatusHistoryDto(history.Id, history.Status, history.Comment, history.ChangedByUserId, changedBy, history.ChangedAt));
        }

        return mapped;
    }

    private async Task<string> NextNumberAsync(CancellationToken cancellationToken)
    {
        var prefix = $"SAV-{DateTime.UtcNow:yyyy}-";
        var count = await db.ServiceTickets.CountAsync(x => x.Number.StartsWith(prefix), cancellationToken);
        return $"{prefix}{count + 1:0000}";
    }

    private static string NormalizePriority(string priority)
        => AllowedPriorities.FirstOrDefault(x => string.Equals(x, priority, StringComparison.OrdinalIgnoreCase)) ?? "Normal";

    private static string NormalizeStatus(string status)
        => AllowedStatuses.FirstOrDefault(x => string.Equals(x, status, StringComparison.OrdinalIgnoreCase)) ?? status;

    private static string? NormalizeOptional(string? value)
        => string.IsNullOrWhiteSpace(value) ? null : value.Trim();
}
