using Erp.Domain.Common;

namespace Erp.Domain.Customers;

public sealed class Customer : AuditableEntity
{
    public string Code { get; set; } = string.Empty;
    public string CompanyName { get; set; } = string.Empty;
    public string? VatNumber { get; set; }
    public string? Notes { get; set; }
    public bool IsActive { get; set; } = true;
    public ICollection<CustomerContact> Contacts { get; set; } = new List<CustomerContact>();
    public ICollection<CustomerAddress> Addresses { get; set; } = new List<CustomerAddress>();
}

