using Erp.Application.Common;
using Erp.Application.Prestashop;
using Erp.Application.ServiceTickets;
using Erp.Domain.FutureModules;
using Erp.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Erp.Infrastructure.Services;

public sealed class ServiceTicketService(ErpDbContext db, ICurrentUserService currentUser, IPrestashopService prestashopService) : IServiceTicketService
{
    private const string PrestashopProvider = "PrestaShop";
    private const string PrestashopCustomerMessageModule = "customer_messages";
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
        var validation = await ValidateAsync(request.CustomerId, request.ProductId, request.SalesOrderId, request.AssignedUserId, request.Subject, request.Priority, "Open", cancellationToken);
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
            AssignedUserId = request.AssignedUserId,
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
        var validation = await ValidateAsync(ticket.CustomerId, request.ProductId, request.SalesOrderId, request.AssignedUserId, request.Subject, request.Priority, nextStatus, cancellationToken);
        if (!validation.Succeeded)
        {
            return Result<ServiceTicketDto>.Failure(validation.Error!);
        }

        var statusChanged = ticket.Status != nextStatus;
        var assignmentChanged = ticket.AssignedUserId != request.AssignedUserId;
        ticket.ProductId = request.ProductId;
        ticket.SalesOrderId = request.SalesOrderId;
        ticket.AssignedUserId = request.AssignedUserId;
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

        if (assignmentChanged)
        {
            db.ServiceTicketStatusHistories.Add(new ServiceTicketStatusHistory
            {
                ServiceTicketId = ticket.Id,
                Status = ticket.Status,
                Comment = await BuildAssignmentCommentAsync(ticket.AssignedUserId, cancellationToken),
                ChangedByUserId = currentUser.UserId
            });
        }

        if (statusChanged && string.Equals(ticket.Status, "Closed", StringComparison.OrdinalIgnoreCase))
        {
            var closeResult = await prestashopService.CloseServiceTicketThreadAsync(ticket.Id, cancellationToken);
            if (!closeResult.Succeeded)
            {
                return Result<ServiceTicketDto>.Failure(closeResult.Error!);
            }
        }

        await db.SaveChangesAsync(cancellationToken);
        return Result<ServiceTicketDto>.Success(await MapAsync(ticket, cancellationToken));
    }

    public async Task<Result<ServiceTicketDto>> AssignAsync(Guid id, AssignServiceTicketRequest request, CancellationToken cancellationToken)
    {
        var ticket = await db.ServiceTickets.FirstOrDefaultAsync(x => x.Id == id, cancellationToken);
        if (ticket is null)
        {
            return Result<ServiceTicketDto>.Failure("Ticket SAV introuvable.");
        }

        var validation = await ValidateAssignedUserAsync(request.AssignedUserId, cancellationToken);
        if (!validation.Succeeded)
        {
            return Result<ServiceTicketDto>.Failure(validation.Error!);
        }

        if (ticket.AssignedUserId == request.AssignedUserId)
        {
            return Result<ServiceTicketDto>.Success(await MapAsync(ticket, cancellationToken));
        }

        ticket.AssignedUserId = request.AssignedUserId;
        ticket.UpdatedAt = DateTimeOffset.UtcNow;
        db.ServiceTicketStatusHistories.Add(new ServiceTicketStatusHistory
        {
            ServiceTicketId = ticket.Id,
            Status = ticket.Status,
            Comment = await BuildAssignmentCommentAsync(ticket.AssignedUserId, cancellationToken),
            ChangedByUserId = currentUser.UserId
        });

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

        var statusChanged = !string.Equals(ticket.Status, nextStatus, StringComparison.OrdinalIgnoreCase);
        ticket.Status = nextStatus;

        if (string.Equals(ticket.Status, "Closed", StringComparison.OrdinalIgnoreCase))
        {
            var closeResult = await prestashopService.CloseServiceTicketThreadAsync(ticket.Id, cancellationToken);
            if (!closeResult.Succeeded)
            {
                return Result<ServiceTicketDto>.Failure(closeResult.Error!);
            }
        }

        if (statusChanged)
        {
            db.ServiceTicketStatusHistories.Add(new ServiceTicketStatusHistory
            {
                ServiceTicketId = ticket.Id,
                Status = ticket.Status,
                Comment = NormalizeOptional(request.Comment),
                ChangedByUserId = currentUser.UserId
            });
        }

        await db.SaveChangesAsync(cancellationToken);
        return Result<ServiceTicketDto>.Success(await MapAsync(ticket, cancellationToken));
    }

    public async Task<Result<ServiceTicketMessageDto>> AddMessageAsync(Guid id, CreateServiceTicketMessageRequest request, CancellationToken cancellationToken)
    {
        var body = NormalizeOptional(request.Body);
        if (string.IsNullOrWhiteSpace(body))
        {
            return Result<ServiceTicketMessageDto>.Failure("Message obligatoire.");
        }

        var ticket = await db.ServiceTickets.FirstOrDefaultAsync(x => x.Id == id, cancellationToken);
        if (ticket is null)
        {
            return Result<ServiceTicketMessageDto>.Failure("Ticket SAV introuvable.");
        }

        if (request.AttachmentDriveItemId.HasValue && !await db.DriveItems.AnyAsync(x => x.Id == request.AttachmentDriveItemId.Value && !x.IsTrashed, cancellationToken))
        {
            return Result<ServiceTicketMessageDto>.Failure("Piece jointe Drive introuvable.");
        }

        string? prestashopMessageId = null;
        if (!request.IsInternal)
        {
            var publishResult = await prestashopService.PublishServiceTicketMessageAsync(ticket.Id, body, cancellationToken);
            if (!publishResult.Succeeded)
            {
                return Result<ServiceTicketMessageDto>.Failure(publishResult.Error!);
            }

            prestashopMessageId = publishResult.Value;
        }

        var message = new ServiceTicketMessage
        {
            ServiceTicketId = id,
            AuthorUserId = currentUser.UserId,
            Body = body,
            IsInternal = request.IsInternal,
            AttachmentDriveItemId = request.AttachmentDriveItemId
        };

        db.ServiceTicketMessages.Add(message);
        ticket.UpdatedAt = DateTimeOffset.UtcNow;

        if (!string.IsNullOrWhiteSpace(prestashopMessageId))
        {
            db.ExternalReferences.Add(new ExternalReference
            {
                Provider = PrestashopProvider,
                ExternalId = ExternalKey(PrestashopCustomerMessageModule, prestashopMessageId),
                Module = PrestashopCustomerMessageModule,
                EntityId = message.Id
            });
        }

        await db.SaveChangesAsync(cancellationToken);
        return Result<ServiceTicketMessageDto>.Success(await MapMessageAsync(message, cancellationToken));
    }

    public async Task<ServiceTicketAssignmentSettingsDto> GetAssignmentSettingsAsync(CancellationToken cancellationToken)
    {
        var userIds = await db.ServiceTicketInitialResponders
            .OrderBy(x => x.UserId)
            .Select(x => x.UserId)
            .ToListAsync(cancellationToken);

        return new ServiceTicketAssignmentSettingsDto(userIds);
    }

    public async Task<Result<ServiceTicketAssignmentSettingsDto>> UpdateAssignmentSettingsAsync(UpdateServiceTicketAssignmentSettingsRequest request, CancellationToken cancellationToken)
    {
        var requestedUserIds = (request.InitialResponderUserIds ?? [])
            .Where(x => x != Guid.Empty)
            .Distinct()
            .ToList();

        var validation = await ValidateResponderUsersAsync(requestedUserIds, cancellationToken);
        if (!validation.Succeeded)
        {
            return Result<ServiceTicketAssignmentSettingsDto>.Failure(validation.Error!);
        }

        var existing = await db.ServiceTicketInitialResponders.ToListAsync(cancellationToken);
        db.ServiceTicketInitialResponders.RemoveRange(existing.Where(x => !requestedUserIds.Contains(x.UserId)));

        var existingUserIds = existing.Select(x => x.UserId).ToHashSet();
        foreach (var userId in requestedUserIds.Where(x => !existingUserIds.Contains(x)))
        {
            db.ServiceTicketInitialResponders.Add(new ServiceTicketInitialResponder { UserId = userId });
        }

        await db.SaveChangesAsync(cancellationToken);
        return Result<ServiceTicketAssignmentSettingsDto>.Success(await GetAssignmentSettingsAsync(cancellationToken));
    }

    private async Task<Result> ValidateAsync(Guid requestCustomerId, Guid? productId, Guid? salesOrderId, Guid? assignedUserId, string subject, string priority, string status, CancellationToken cancellationToken)
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

        return await ValidateAssignedUserAsync(assignedUserId, cancellationToken);
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
        var assignedUserName = ticket.AssignedUserId.HasValue
            ? await db.Users.Where(x => x.Id == ticket.AssignedUserId.Value).Select(x => x.DisplayName).FirstOrDefaultAsync(cancellationToken)
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
            ticket.AssignedUserId,
            assignedUserName,
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

    private async Task<Result> ValidateAssignedUserAsync(Guid? assignedUserId, CancellationToken cancellationToken)
    {
        if (!assignedUserId.HasValue)
        {
            return Result.Success();
        }

        return await db.Users.AnyAsync(x => x.Id == assignedUserId.Value && x.IsActive, cancellationToken)
            ? Result.Success()
            : Result.Failure("Responsable SAV introuvable ou inactif.");
    }

    private async Task<Result> ValidateResponderUsersAsync(IReadOnlyList<Guid> userIds, CancellationToken cancellationToken)
    {
        if (userIds.Count == 0)
        {
            return Result.Success();
        }

        var existingCount = await db.Users.CountAsync(x => userIds.Contains(x.Id) && x.IsActive, cancellationToken);
        return existingCount == userIds.Count
            ? Result.Success()
            : Result.Failure("Un ou plusieurs destinataires SAV sont introuvables ou inactifs.");
    }

    private async Task<string> BuildAssignmentCommentAsync(Guid? assignedUserId, CancellationToken cancellationToken)
    {
        if (!assignedUserId.HasValue)
        {
            return "Attribution retiree";
        }

        var displayName = await db.Users
            .Where(x => x.Id == assignedUserId.Value)
            .Select(x => x.DisplayName)
            .FirstOrDefaultAsync(cancellationToken);

        return $"Attribue a {displayName ?? assignedUserId.Value.ToString()}";
    }

    private static string ExternalKey(string module, string externalId)
        => $"{module}:{externalId}";
}
