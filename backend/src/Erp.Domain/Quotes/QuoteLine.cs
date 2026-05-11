using Erp.Domain.Common;

namespace Erp.Domain.Quotes;

public sealed class QuoteLine : Entity
{
    public Guid QuoteId { get; set; }
    public Quote? Quote { get; set; }
    public Guid? ProductId { get; set; }
    public string Description { get; set; } = string.Empty;
    public decimal Quantity { get; set; } = 1m;
    public decimal UnitPrice { get; set; }
    public decimal DiscountRate { get; set; }
    public decimal VatRate { get; set; } = 20m;
    public decimal LineNetTotal { get; private set; }
    public decimal LineVatTotal { get; private set; }
    public decimal LineTotal { get; private set; }

    public void Recalculate()
    {
        var discountMultiplier = 1 - Math.Clamp(DiscountRate, 0, 100) / 100m;
        LineNetTotal = decimal.Round(Quantity * UnitPrice * discountMultiplier, 2);
        LineVatTotal = decimal.Round(LineNetTotal * VatRate / 100m, 2);
        LineTotal = LineNetTotal + LineVatTotal;
    }
}

