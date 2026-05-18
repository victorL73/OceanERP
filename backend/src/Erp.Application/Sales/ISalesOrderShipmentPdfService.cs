namespace Erp.Application.Sales;

public interface ISalesOrderShipmentPdfService
{
    byte[] Generate(SalesOrderShipmentSlipPdfModel model);
}
