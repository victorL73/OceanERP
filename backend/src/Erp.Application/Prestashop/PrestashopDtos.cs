namespace Erp.Application.Prestashop;

public sealed record PrestashopConnectionDto(Guid Id, string ShopUrl, string ApiKeySecretName, bool HasApiKey, bool IsActive, Guid? WarehouseId);
public sealed record PrestashopSyncLogDto(Guid Id, Guid PrestashopConnectionId, string Status, string Message, DateTimeOffset CreatedAt, DateTimeOffset? StartedAt, DateTimeOffset? CompletedAt);
public sealed record CreatePrestashopConnectionRequest(string ShopUrl, string? ApiKey, Guid? WarehouseId);
public sealed record UpdatePrestashopConnectionRequest(string ShopUrl, string? ApiKey, bool IsActive, bool ClearApiKey, Guid? WarehouseId);
public sealed record PrestashopImportedOrderNotification(Guid SalesOrderId, string Number);
public sealed record PrestashopImportedServiceTicketNotification(Guid ServiceTicketId, string Number, string Subject, int NewMessages);
public sealed record PrestashopSyncResourceChange(string Resource, int Created, int Updated);
public sealed record PrestashopSyncCompletedEvent(Guid ConnectionId, string ShopUrl, string Status, string Message, IReadOnlyList<PrestashopSyncResourceChange> Resources);

public interface IPrestashopSyncNotifier
{
    Task NotifyNewOrdersAsync(Guid connectionId, string shopUrl, IReadOnlyList<PrestashopImportedOrderNotification> orders, CancellationToken cancellationToken);
    Task NotifyNewServiceMessagesAsync(Guid connectionId, string shopUrl, IReadOnlyList<PrestashopImportedServiceTicketNotification> tickets, CancellationToken cancellationToken);
    Task NotifySyncCompletedAsync(PrestashopSyncCompletedEvent syncEvent, CancellationToken cancellationToken);
}
