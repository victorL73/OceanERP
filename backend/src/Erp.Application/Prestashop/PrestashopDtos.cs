namespace Erp.Application.Prestashop;

public sealed record PrestashopConnectionDto(Guid Id, string ShopUrl, string ApiKeySecretName, bool HasApiKey, bool IsActive);
public sealed record PrestashopSyncLogDto(Guid Id, Guid PrestashopConnectionId, string Status, string Message, DateTimeOffset CreatedAt, DateTimeOffset? StartedAt, DateTimeOffset? CompletedAt);
public sealed record CreatePrestashopConnectionRequest(string ShopUrl, string? ApiKey);
public sealed record UpdatePrestashopConnectionRequest(string ShopUrl, string? ApiKey, bool IsActive, bool ClearApiKey);
