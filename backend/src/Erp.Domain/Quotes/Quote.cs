using Erp.Domain.Common;
using Erp.Domain.Customers;

namespace Erp.Domain.Quotes;

public sealed class Quote : AuditableEntity
{
    public string Number { get; set; } = string.Empty;
    public Guid CustomerId { get; set; }
    public Customer? Customer { get; set; }
    public QuoteStatus Status { get; private set; } = QuoteStatus.Draft;
    public DateOnly IssueDate { get; set; } = DateOnly.FromDateTime(DateTime.UtcNow);
    public DateOnly ValidUntil { get; set; } = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(30));
    public decimal Subtotal { get; private set; }
    public decimal VatTotal { get; private set; }
    public decimal Total { get; private set; }
    public string Currency { get; set; } = "EUR";
    public ICollection<QuoteLine> Lines { get; set; } = new List<QuoteLine>();
    public ICollection<QuoteDocument> Documents { get; set; } = new List<QuoteDocument>();
    public ICollection<QuoteStatusHistory> StatusHistory { get; set; } = new List<QuoteStatusHistory>();

    public void RecalculateTotals()
    {
        foreach (var line in Lines)
        {
            line.Recalculate();
        }

        Subtotal = Lines.Sum(line => line.LineNetTotal);
        VatTotal = Lines.Sum(line => line.LineVatTotal);
        Total = Subtotal + VatTotal;
    }

    public void ChangeStatus(QuoteStatus status, Guid? userId = null, string? comment = null)
    {
        if (Status == status)
        {
            return;
        }

        Status = status;
        StatusHistory.Add(new QuoteStatusHistory
        {
            QuoteId = Id,
            Status = status,
            ChangedByUserId = userId,
            Comment = comment
        });
    }
}

