using Erp.Application.Common;
using Erp.Application.Customers;
using Erp.Domain.Customers;
using Erp.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Erp.Infrastructure.Services;

public sealed class CustomerService(ErpDbContext db) : ICustomerService
{
    public async Task<PagedResult<CustomerDto>> SearchAsync(string? search, int page, int pageSize, CancellationToken cancellationToken)
    {
        page = Math.Max(1, page);
        pageSize = Math.Clamp(pageSize, 1, 100);

        var query = db.Customers.Include(x => x.Contacts).Include(x => x.Addresses).AsQueryable();
        if (!string.IsNullOrWhiteSpace(search))
        {
            query = query.Where(x => x.Code.Contains(search) || x.CompanyName.Contains(search));
        }

        var total = await query.CountAsync(cancellationToken);
        var customers = await query.OrderBy(x => x.CompanyName).Skip((page - 1) * pageSize).Take(pageSize).ToListAsync(cancellationToken);
        return new PagedResult<CustomerDto>(customers.Select(Map).ToList(), total, page, pageSize);
    }

    public async Task<Result<CustomerDto>> GetAsync(Guid id, CancellationToken cancellationToken)
    {
        var customer = await db.Customers.Include(x => x.Contacts).Include(x => x.Addresses).FirstOrDefaultAsync(x => x.Id == id, cancellationToken);
        return customer is null ? Result<CustomerDto>.Failure("Customer not found.") : Result<CustomerDto>.Success(Map(customer));
    }

    public async Task<Result<CustomerDto>> CreateAsync(CreateCustomerRequest request, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.Code) || string.IsNullOrWhiteSpace(request.CompanyName))
        {
            return Result<CustomerDto>.Failure("Customer code and company name are required.");
        }

        if (await db.Customers.AnyAsync(x => x.Code == request.Code, cancellationToken))
        {
            return Result<CustomerDto>.Failure("Customer code already exists.");
        }

        var customer = new Customer
        {
            Code = request.Code.Trim(),
            CompanyName = request.CompanyName.Trim(),
            VatNumber = request.VatNumber,
            Notes = request.Notes
        };

        ApplyChildren(customer, request.Contacts, request.Addresses);
        db.Customers.Add(customer);
        await db.SaveChangesAsync(cancellationToken);
        return Result<CustomerDto>.Success(Map(customer));
    }

    public async Task<Result<CustomerDto>> UpdateAsync(Guid id, UpdateCustomerRequest request, CancellationToken cancellationToken)
    {
        var customer = await db.Customers.Include(x => x.Contacts).Include(x => x.Addresses).FirstOrDefaultAsync(x => x.Id == id, cancellationToken);
        if (customer is null)
        {
            return Result<CustomerDto>.Failure("Customer not found.");
        }

        customer.CompanyName = request.CompanyName.Trim();
        customer.VatNumber = request.VatNumber;
        customer.Notes = request.Notes;
        customer.IsActive = request.IsActive;
        db.CustomerContacts.RemoveRange(customer.Contacts);
        db.CustomerAddresses.RemoveRange(customer.Addresses);
        customer.Contacts.Clear();
        customer.Addresses.Clear();
        ApplyChildren(customer, request.Contacts, request.Addresses);
        await db.SaveChangesAsync(cancellationToken);
        return Result<CustomerDto>.Success(Map(customer));
    }

    private static void ApplyChildren(Customer customer, IReadOnlyList<UpsertCustomerContactRequest>? contacts, IReadOnlyList<UpsertCustomerAddressRequest>? addresses)
    {
        foreach (var contact in contacts ?? [])
        {
            customer.Contacts.Add(new CustomerContact
            {
                FirstName = contact.FirstName,
                LastName = contact.LastName,
                Email = contact.Email,
                Phone = contact.Phone,
                JobTitle = contact.JobTitle,
                IsPrimary = contact.IsPrimary
            });
        }

        foreach (var address in addresses ?? [])
        {
            customer.Addresses.Add(new CustomerAddress
            {
                Label = address.Label,
                Line1 = address.Line1,
                Line2 = address.Line2,
                PostalCode = address.PostalCode,
                City = address.City,
                Country = address.Country,
                IsBilling = address.IsBilling,
                IsShipping = address.IsShipping
            });
        }
    }

    private static CustomerDto Map(Customer customer)
        => new(
            customer.Id,
            customer.Code,
            customer.CompanyName,
            customer.VatNumber,
            customer.Notes,
            customer.IsActive,
            customer.Contacts.Select(x => new CustomerContactDto(x.Id, x.FirstName, x.LastName, x.Email, x.Phone, x.JobTitle, x.IsPrimary)).ToList(),
            customer.Addresses.Select(x => new CustomerAddressDto(x.Id, x.Label, x.Line1, x.Line2, x.PostalCode, x.City, x.Country, x.IsBilling, x.IsShipping)).ToList());
}
