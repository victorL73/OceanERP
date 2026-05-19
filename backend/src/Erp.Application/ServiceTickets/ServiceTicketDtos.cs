using Erp.Application.Common;

namespace Erp.Application.ServiceTickets;

public sealed record ServiceTicketDto(
    Guid Id,
    string Number,
    Guid CustomerId,
    string CustomerName,
    Guid? ProductId,
    string? ProductReference,
    string? ProductName,
    Guid? SalesOrderId,
    string? SalesOrderNumber,
    Guid? AssignedUserId,
    string? AssignedUserName,
    string Subject,
    string? Description,
    string Priority,
    string Status,
    DateTimeOffset CreatedAt,
    DateTimeOffset? UpdatedAt,
    IReadOnlyList<ServiceTicketMessageDto> Messages,
    IReadOnlyList<ServiceTicketStatusHistoryDto> StatusHistory);

public sealed record ServiceTicketMessageDto(
    Guid Id,
    Guid? AuthorUserId,
    string? AuthorName,
    string Body,
    bool IsInternal,
    Guid? AttachmentDriveItemId,
    DateTimeOffset CreatedAt);

public sealed record ServiceTicketStatusHistoryDto(Guid Id, string Status, string? Comment, Guid? ChangedByUserId, string? ChangedByName, DateTimeOffset ChangedAt);

public sealed record CreateServiceTicketRequest(Guid CustomerId, string Subject, string? Description, Guid? ProductId = null, Guid? SalesOrderId = null, string Priority = "Normal", Guid? AssignedUserId = null);
public sealed record UpdateServiceTicketRequest(string Subject, string? Description, Guid? ProductId, Guid? SalesOrderId, string Priority, string Status, Guid? AssignedUserId = null);
public sealed record AssignServiceTicketRequest(Guid? AssignedUserId);
public sealed record UpdateServiceTicketStatusRequest(string Status, string? Comment = null);
public sealed record CreateServiceTicketMessageRequest(string Body, bool IsInternal = false, Guid? AttachmentDriveItemId = null);
public sealed record ServiceTicketAssignmentSettingsDto(IReadOnlyList<Guid> InitialResponderUserIds);
public sealed record UpdateServiceTicketAssignmentSettingsRequest(IReadOnlyList<Guid> InitialResponderUserIds);

public interface IServiceTicketService
{
    Task<PagedResult<ServiceTicketDto>> SearchAsync(string? search, string? status, int page, int pageSize, CancellationToken cancellationToken);
    Task<Result<ServiceTicketDto>> GetAsync(Guid id, CancellationToken cancellationToken);
    Task<Result<ServiceTicketDto>> CreateAsync(CreateServiceTicketRequest request, CancellationToken cancellationToken);
    Task<Result<ServiceTicketDto>> UpdateAsync(Guid id, UpdateServiceTicketRequest request, CancellationToken cancellationToken);
    Task<Result<ServiceTicketDto>> AssignAsync(Guid id, AssignServiceTicketRequest request, CancellationToken cancellationToken);
    Task<Result<ServiceTicketDto>> ChangeStatusAsync(Guid id, UpdateServiceTicketStatusRequest request, CancellationToken cancellationToken);
    Task<Result<ServiceTicketMessageDto>> AddMessageAsync(Guid id, CreateServiceTicketMessageRequest request, CancellationToken cancellationToken);
    Task<ServiceTicketAssignmentSettingsDto> GetAssignmentSettingsAsync(CancellationToken cancellationToken);
    Task<Result<ServiceTicketAssignmentSettingsDto>> UpdateAssignmentSettingsAsync(UpdateServiceTicketAssignmentSettingsRequest request, CancellationToken cancellationToken);
}
