namespace Erp.Application.Stock;

public interface ILowStockAlertService
{
    Task CheckAndNotifyAsync(CancellationToken cancellationToken);
}
