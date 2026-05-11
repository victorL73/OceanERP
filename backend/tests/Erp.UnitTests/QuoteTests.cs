using Erp.Domain.Quotes;

namespace Erp.UnitTests;

public sealed class QuoteTests
{
    [Fact]
    public void RecalculateTotals_AppliesDiscountAndVat()
    {
        var quote = new Quote { Number = "DEV-TEST", CustomerId = Guid.NewGuid() };
        quote.Lines.Add(new QuoteLine
        {
            Description = "Produit test",
            Quantity = 2,
            UnitPrice = 100,
            DiscountRate = 10,
            VatRate = 20
        });

        quote.RecalculateTotals();

        Assert.Equal(180m, quote.Subtotal);
        Assert.Equal(36m, quote.VatTotal);
        Assert.Equal(216m, quote.Total);
    }

    [Fact]
    public void ChangeStatus_AddsHistoryEntry()
    {
        var quote = new Quote { Number = "DEV-TEST", CustomerId = Guid.NewGuid() };

        quote.ChangeStatus(QuoteStatus.Sent, Guid.NewGuid(), "Sent to customer");

        Assert.Equal(QuoteStatus.Sent, quote.Status);
        Assert.Single(quote.StatusHistory);
    }
}

