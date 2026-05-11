namespace Erp.Application.Prestashop;

public sealed record PrestashopConnectionDto(Guid Id, string ShopUrl, string ApiKeySecretName, bool IsActive);
public sealed record PrestashopSyncLogDto(Guid Id, Guid PrestashopConnectionId, string Status, DateTimeOffset CreatedAt);
public sealed record CreatePrestashopConnectionRequest(string ShopUrl, string ApiKeySecretName);

