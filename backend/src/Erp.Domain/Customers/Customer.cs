using Erp.Domain.Common;

namespace Erp.Domain.Customers;

public sealed class Customer : AuditableEntity
{
    public string Code { get; set; } = string.Empty;
    public string CompanyName { get; set; } = string.Empty;
    public string? LegalName { get; set; }
    public string? TradeName { get; set; }
    public string? SirenNumber { get; set; }
    public string? SiretNumber { get; set; }
    public string? VatNumber { get; set; }
    public string? Email { get; set; }
    public string? Phone { get; set; }
    public string? MobilePhone { get; set; }
    public string? Website { get; set; }
    public string? Industry { get; set; }
    public string? CustomerType { get; set; }
    public string? Source { get; set; }
    public string? AccountingCode { get; set; }
    public string? PaymentTerms { get; set; }
    public decimal DefaultDiscountRate { get; set; }
    public string? Notes { get; set; }
    public bool IsActive { get; set; } = true;
    public ICollection<CustomerContact> Contacts { get; set; } = new List<CustomerContact>();
    public ICollection<CustomerAddress> Addresses { get; set; } = new List<CustomerAddress>();
}
