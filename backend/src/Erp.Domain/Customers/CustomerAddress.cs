using Erp.Domain.Common;

namespace Erp.Domain.Customers;

public sealed class CustomerAddress : AuditableEntity
{
    public Guid CustomerId { get; set; }
    public Customer? Customer { get; set; }
    public string Label { get; set; } = "Principal";
    public string Line1 { get; set; } = string.Empty;
    public string? Line2 { get; set; }
    public string PostalCode { get; set; } = string.Empty;
    public string City { get; set; } = string.Empty;
    public string Country { get; set; } = "France";
    public bool IsBilling { get; set; } = true;
    public bool IsShipping { get; set; } = true;
}

