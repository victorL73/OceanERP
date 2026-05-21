namespace Erp.Application.Treasury;

public interface ITreasuryService
{
    Task<TreasurySummaryDto> GetSummaryAsync(CancellationToken cancellationToken);

    Task<IReadOnlyList<TreasuryMovementDto>> GetMovementsAsync(CancellationToken cancellationToken);
}
