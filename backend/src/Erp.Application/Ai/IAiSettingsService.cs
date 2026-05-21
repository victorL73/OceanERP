using Erp.Application.Common;

namespace Erp.Application.Ai;

public interface IAiSettingsService
{
    Task<AiSettingsDto> GetAsync(CancellationToken cancellationToken);
    Task<Result<AiSettingsDto>> UpdateAsync(UpdateAiSettingsRequest request, CancellationToken cancellationToken);
}
