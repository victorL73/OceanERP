namespace Erp.Application.Invoices;

public interface IInvoicePdfService
{
    byte[] Generate(InvoicePdfModel invoice);
}

public sealed record InvoicePdfModel(
    string Number,
    string CustomerName,
    DateOnly IssueDate,
    DateOnly DueDate,
    decimal Total,
    decimal PaidTotal,
    decimal BalanceDue,
    string Currency,
    IReadOnlyList<InvoicePdfLine> Lines);

public sealed record InvoicePdfLine(string Description, decimal Quantity, decimal UnitPrice, decimal LineTotal);
