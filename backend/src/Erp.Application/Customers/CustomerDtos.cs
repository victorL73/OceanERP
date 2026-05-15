namespace Erp.Application.Customers;

public sealed record CustomerDto(
    Guid Id,
    string Code,
    string CompanyName,
    string? LegalName,
    string? TradeName,
    string? SirenNumber,
    string? SiretNumber,
    string? VatNumber,
    string? Email,
    string? Phone,
    string? MobilePhone,
    string? Website,
    string? Industry,
    string? CustomerType,
    string? Source,
    string? AccountingCode,
    string? PaymentTerms,
    decimal DefaultDiscountRate,
    string? Notes,
    bool IsActive,
    IReadOnlyList<CustomerContactDto> Contacts,
    IReadOnlyList<CustomerAddressDto> Addresses);

public sealed record CustomerContactDto(Guid Id, string FirstName, string LastName, string? Email, string? Phone, string? JobTitle, bool IsPrimary);
public sealed record CustomerAddressDto(Guid Id, string Label, string Line1, string? Line2, string PostalCode, string City, string Country, bool IsBilling, bool IsShipping);

public sealed record CreateCustomerRequest(
    string Code,
    string CompanyName,
    string? LegalName,
    string? TradeName,
    string? SirenNumber,
    string? SiretNumber,
    string? VatNumber,
    string? Email,
    string? Phone,
    string? MobilePhone,
    string? Website,
    string? Industry,
    string? CustomerType,
    string? Source,
    string? AccountingCode,
    string? PaymentTerms,
    decimal? DefaultDiscountRate,
    string? Notes,
    IReadOnlyList<UpsertCustomerContactRequest>? Contacts,
    IReadOnlyList<UpsertCustomerAddressRequest>? Addresses);

public sealed record UpdateCustomerRequest(
    string CompanyName,
    string? LegalName,
    string? TradeName,
    string? SirenNumber,
    string? SiretNumber,
    string? VatNumber,
    string? Email,
    string? Phone,
    string? MobilePhone,
    string? Website,
    string? Industry,
    string? CustomerType,
    string? Source,
    string? AccountingCode,
    string? PaymentTerms,
    decimal? DefaultDiscountRate,
    string? Notes,
    bool IsActive,
    IReadOnlyList<UpsertCustomerContactRequest>? Contacts,
    IReadOnlyList<UpsertCustomerAddressRequest>? Addresses);

public sealed record UpsertCustomerContactRequest(string FirstName, string LastName, string? Email, string? Phone, string? JobTitle, bool IsPrimary);
public sealed record UpsertCustomerAddressRequest(string Label, string Line1, string? Line2, string PostalCode, string City, string Country, bool IsBilling, bool IsShipping);
