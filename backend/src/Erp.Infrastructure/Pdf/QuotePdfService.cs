using Erp.Application.Quotes;
using Erp.Domain.Quotes;
using QuestPDF.Fluent;
using QuestPDF.Helpers;
using QuestPDF.Infrastructure;

namespace Erp.Infrastructure.Pdf;

public sealed class QuotePdfService : IQuotePdfService
{
    public byte[] Generate(Quote quote)
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
                    column.Item().Text($"Devis {quote.Number}").FontSize(16);
                    column.Item().Text($"Client: {quote.Customer?.CompanyName ?? quote.CustomerId.ToString()}");
                    column.Item().Text($"Emission: {quote.IssueDate:dd/MM/yyyy} - Valide jusqu'au: {quote.ValidUntil:dd/MM/yyyy}");
                });

                page.Content().PaddingVertical(25).Table(table =>
                {
                    table.ColumnsDefinition(columns =>
                    {
                        columns.RelativeColumn(4);
                        columns.RelativeColumn();
                        columns.RelativeColumn();
                        columns.RelativeColumn();
                        columns.RelativeColumn();
                    });

                    table.Header(header =>
                    {
                        header.Cell().Element(HeaderCell).Text("Designation");
                        header.Cell().Element(HeaderCell).AlignRight().Text("Qté");
                        header.Cell().Element(HeaderCell).AlignRight().Text("PU HT");
                        header.Cell().Element(HeaderCell).AlignRight().Text("TVA");
                        header.Cell().Element(HeaderCell).AlignRight().Text("Total TTC");
                    });

                    foreach (var line in quote.Lines)
                    {
                        table.Cell().Element(BodyCell).Text(line.Description);
                        table.Cell().Element(BodyCell).AlignRight().Text(line.Quantity.ToString("0.###"));
                        table.Cell().Element(BodyCell).AlignRight().Text($"{line.UnitPrice:0.00} {quote.Currency}");
                        table.Cell().Element(BodyCell).AlignRight().Text($"{line.VatRate:0.##}%");
                        table.Cell().Element(BodyCell).AlignRight().Text($"{line.LineTotal:0.00} {quote.Currency}");
                    }

                    static IContainer HeaderCell(IContainer container) => container.BorderBottom(1).BorderColor(Colors.Grey.Medium).PaddingVertical(6);
                    static IContainer BodyCell(IContainer container) => container.BorderBottom(0.5f).BorderColor(Colors.Grey.Lighten2).PaddingVertical(6);
                });

                page.Footer().AlignRight().Column(column =>
                {
                    column.Item().Text($"Total HT: {quote.Subtotal:0.00} {quote.Currency}");
                    column.Item().Text($"TVA: {quote.VatTotal:0.00} {quote.Currency}");
                    column.Item().Text($"Total TTC: {quote.Total:0.00} {quote.Currency}").Bold().FontSize(13);
                });
            });
        }).GeneratePdf();
    }
}

