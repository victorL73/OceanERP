using Erp.Application.Invoices;
using QuestPDF.Fluent;
using QuestPDF.Helpers;
using QuestPDF.Infrastructure;

namespace Erp.Infrastructure.Pdf;

public sealed class InvoicePdfService : IInvoicePdfService
{
    public byte[] Generate(InvoicePdfModel invoice)
    {
        QuestPDF.Settings.License = LicenseType.Community;

        return Document.Create(container =>
        {
            container.Page(page =>
            {
                page.Margin(40);
                page.Size(PageSizes.A4);
                page.DefaultTextStyle(x => x.FontSize(10));

                page.Header().Column(column =>
                {
                    column.Item().Text("OceanERP").FontSize(22).Bold();
                    column.Item().Text($"Facture {invoice.Number}").FontSize(16);
                    column.Item().Text($"Client: {invoice.CustomerName}");
                    column.Item().Text($"Emission: {invoice.IssueDate:dd/MM/yyyy} - Echeance: {invoice.DueDate:dd/MM/yyyy}");
                });

                page.Content().PaddingVertical(25).Table(table =>
                {
                    table.ColumnsDefinition(columns =>
                    {
                        columns.RelativeColumn(4);
                        columns.RelativeColumn();
                        columns.RelativeColumn();
                        columns.RelativeColumn();
                    });

                    table.Header(header =>
                    {
                        header.Cell().Element(HeaderCell).Text("Designation");
                        header.Cell().Element(HeaderCell).AlignRight().Text("Qte");
                        header.Cell().Element(HeaderCell).AlignRight().Text("PU HT");
                        header.Cell().Element(HeaderCell).AlignRight().Text("Total HT");
                    });

                    foreach (var line in invoice.Lines)
                    {
                        table.Cell().Element(BodyCell).Text(line.Description);
                        table.Cell().Element(BodyCell).AlignRight().Text(line.Quantity.ToString("0.###"));
                        table.Cell().Element(BodyCell).AlignRight().Text($"{line.UnitPrice:0.00} {invoice.Currency}");
                        table.Cell().Element(BodyCell).AlignRight().Text($"{line.LineTotal:0.00} {invoice.Currency}");
                    }

                    static IContainer HeaderCell(IContainer container) => container.BorderBottom(1).BorderColor(Colors.Grey.Medium).PaddingVertical(6);
                    static IContainer BodyCell(IContainer container) => container.BorderBottom(0.5f).BorderColor(Colors.Grey.Lighten2).PaddingVertical(6);
                });

                page.Footer().AlignRight().Column(column =>
                {
                    column.Item().Text($"Total: {invoice.Total:0.00} {invoice.Currency}");
                    column.Item().Text($"Regle: {invoice.PaidTotal:0.00} {invoice.Currency}");
                    column.Item().Text($"Solde: {invoice.BalanceDue:0.00} {invoice.Currency}").Bold().FontSize(13);
                });
            });
        }).GeneratePdf();
    }
}
