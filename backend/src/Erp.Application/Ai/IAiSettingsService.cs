using Erp.Application.Common;

namespace Erp.Application.Ai;

public interface IAiSettingsService
{
    Task<AiSettingsDto> GetAsync(CancellationToken cancellationToken);
    Task<Result<AiRuntimeSettings>> GetRuntimeAsync(CancellationToken cancellationToken);
    Task<Result<AiSettingsDto>> UpdateAsync(UpdateAiSettingsRequest request, CancellationToken cancellationToken);
}

public sealed record AiRuntimeSettings(
    bool IsEnabled,
    string Provider,
    string EndpointUrl,
    string Model,
    string ApiKey,
    decimal Temperature,
    int MaxTokens,
    string? SystemPrompt);
