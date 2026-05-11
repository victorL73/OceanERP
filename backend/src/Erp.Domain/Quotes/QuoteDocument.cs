using Erp.Domain.Common;

namespace Erp.Domain.Quotes;

public sealed class QuoteDocument : Entity
{
    public Guid QuoteId { get; set; }
    public Quote? Quote { get; set; }
    public Guid? DriveItemId { get; set; }
    public string FileName { get; set; } = string.Empty;
    public string MimeType { get; set; } = "application/pdf";
    public string StoragePath { get; set; } = string.Empty;
    public long Size { get; set; }
    public int Version { get; set; } = 1;
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
}

