using Erp.Domain.Common;

namespace Erp.Domain.Quotes;

public sealed class QuoteStatusHistory : Entity
{
    public Guid QuoteId { get; set; }
    public Quote? Quote { get; set; }
    public QuoteStatus Status { get; set; }
    public Guid? ChangedByUserId { get; set; }
    public string? Comment { get; set; }
    public DateTimeOffset ChangedAt { get; set; } = DateTimeOffset.UtcNow;
}

