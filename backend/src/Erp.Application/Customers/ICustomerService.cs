using Erp.Application.Common;

namespace Erp.Application.Customers;

public interface ICustomerService
{
    Task<PagedResult<CustomerDto>> SearchAsync(string? search, int page, int pageSize, CancellationToken cancellationToken);
    Task<Result<CustomerDto>> GetAsync(Guid id, CancellationToken cancellationToken);
    Task<Result<CustomerDto>> CreateAsync(CreateCustomerRequest request, CancellationToken cancellationToken);
    Task<Result<CustomerDto>> UpdateAsync(Guid id, UpdateCustomerRequest request, CancellationToken cancellationToken);
}

