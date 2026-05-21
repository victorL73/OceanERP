namespace Erp.Application.Ai;

public sealed record AiSettingsDto(
    Guid? Id,
    bool IsEnabled,
    string Provider,
    string EndpointUrl,
    string Model,
    string? ApiKeySecretName,
    bool HasApiKey,
    decimal Temperature,
    int MaxTokens,
    string? SystemPrompt,
    DateTimeOffset? UpdatedAt);

public sealed record UpdateAiSettingsRequest(
    bool IsEnabled,
    string Provider,
    string EndpointUrl,
    string Model,
    string? ApiKey = null,
    bool ClearApiKey = false,
    string? ApiKeySecretName = null,
    decimal Temperature = 0.2m,
    int MaxTokens = 4096,
    string? SystemPrompt = null);
