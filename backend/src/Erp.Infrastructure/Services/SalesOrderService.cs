using Erp.Application.Common;
using Erp.Application.Sales;
using Erp.Domain.FutureModules;
using Erp.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Erp.Infrastructure.Services;

public sealed class SalesOrderService(ErpDbContext db) : ISalesOrderService
{
    public async Task<PagedResult<SalesOrderDto>> SearchAsync(int page, int pageSize, CancellationToken cancellationToken)
    {
        page = Math.Max(1, page);
        pageSize = Math.Clamp(pageSize, 1, 100);
        var query = db.SalesOrders.OrderByDescending(x => x.CreatedAt);
        var total = await db.SalesOrders.CountAsync(cancellationToken);
        var orders = await query.Skip((page - 1) * pageSize).Take(pageSize).ToListAsync(cancellationToken);
        return new PagedResult<SalesOrderDto>(await MapManyAsync(orders, cancellationToken), total, page, pageSize);
    }

    public async Task<Result<SalesOrderDto>> GetAsync(Guid id, CancellationToken cancellationToken)
    {
        var order = await db.SalesOrders.FirstOrDefaultAsync(x => x.Id == id, cancellationToken);
        return order is null ? Result<SalesOrderDto>.Failure("Sales order not found.") : Result<SalesOrderDto>.Success(await MapAsync(order, cancellationToken));
    }

    public async Task<Result<SalesOrderDto>> CreateAsync(CreateSalesOrderRequest request, CancellationToken cancellationToken)
    {
        if (!await db.Customers.AnyAsync(x => x.Id == request.CustomerId, cancellationToken))
        {
            return Result<SalesOrderDto>.Failure("Customer not found.");
        }

        if (request.Lines.Count == 0)
        {
            return Result<SalesOrderDto>.Failure("A sales order requires at least one line.");
        }

        var order = new SalesOrder
        {
            Number = await NextNumberAsync(cancellationToken),
            CustomerId = request.CustomerId,
            Status = "Draft"
        };
        db.SalesOrders.Add(order);
        foreach (var line in request.Lines)
        {
            db.SalesOrderLines.Add(new SalesOrderLine { SalesOrderId = order.Id, Description = line.Description, Quantity = line.Quantity, UnitPrice = line.UnitPrice });
        }
        db.SalesOrderStatusHistories.Add(new SalesOrderStatusHistory { SalesOrderId = order.Id, Status = order.Status });
        await db.SaveChangesAsync(cancellationToken);
        return Result<SalesOrderDto>.Success(await MapAsync(order, cancellationToken));
    }

    public async Task<Result<SalesOrderDto>> CreateFromQuoteAsync(CreateSalesOrderFromQuoteRequest request, CancellationToken cancellationToken)
    {
        var quote = await db.Quotes.Include(x => x.Lines).FirstOrDefaultAsync(x => x.Id == request.QuoteId, cancellationToken);
        if (quote is null)
        {
            return Result<SalesOrderDto>.Failure("Quote not found.");
        }

        return await CreateAsync(new CreateSalesOrderRequest(
            quote.CustomerId,
            quote.Lines.Select(x => new CreateSalesOrderLineRequest(x.Description, x.Quantity, x.UnitPrice)).ToList()), cancellationToken);
    }

    public async Task<Result<SalesOrderDto>> ChangeStatusAsync(Guid id, UpdateSalesOrderStatusRequest request, CancellationToken cancellationToken)
    {
        var order = await db.SalesOrders.FirstOrDefaultAsync(x => x.Id == id, cancellationToken);
        if (order is null)
        {
            return Result<SalesOrderDto>.Failure("Sales order not found.");
        }

        order.Status = request.Status;
        db.SalesOrderStatusHistories.Add(new SalesOrderStatusHistory { SalesOrderId = order.Id, Status = request.Status });
        await db.SaveChangesAsync(cancellationToken);
        return Result<SalesOrderDto>.Success(await MapAsync(order, cancellationToken));
    }

    private async Task<string> NextNumberAsync(CancellationToken cancellationToken)
    {
        var prefix = $"CMD-{DateTime.UtcNow:yyyy}-";
        var count = await db.SalesOrders.CountAsync(x => x.Number.StartsWith(prefix), cancellationToken);
        return $"{prefix}{count + 1:0000}";
    }

    private async Task<IReadOnlyList<SalesOrderDto>> MapManyAsync(IReadOnlyList<SalesOrder> orders, CancellationToken cancellationToken)
    {
        var result = new List<SalesOrderDto>();
        foreach (var order in orders)
        {
            result.Add(await MapAsync(order, cancellationToken));
        }
        return result;
    }

    private async Task<SalesOrderDto> MapAsync(SalesOrder order, CancellationToken cancellationToken)
    {
        var lines = await db.SalesOrderLines.Where(x => x.SalesOrderId == order.Id).OrderBy(x => x.Id).ToListAsync(cancellationToken);
        return new SalesOrderDto(order.Id, order.Number, order.CustomerId, order.Status, lines.Select(x => new SalesOrderLineDto(x.Id, x.Description, x.Quantity, x.UnitPrice)).ToList());
    }
}

