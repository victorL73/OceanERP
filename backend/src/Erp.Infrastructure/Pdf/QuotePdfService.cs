using Erp.Application.Quotes;
using Erp.Domain.Customers;
using Erp.Domain.Quotes;
using QuestPDF.Fluent;
using QuestPDF.Helpers;
using QuestPDF.Infrastructure;

namespace Erp.Infrastructure.Pdf;

public sealed class QuotePdfService : IQuotePdfService
{
    public byte[] Generate(Quote quote, QuotePdfSettings settings, byte[]? logoBytes)
    {
        QuestPDF.Settings.License = LicenseType.Community;

        return Document.Create(container =>
        {
            container.Page(page =>
            {
                page.Margin(40);
                page.Size(PageSizes.A4);
                page.DefaultTextStyle(x => x.FontSize(10));

                page.Header().Row(row =>
                {
                    row.RelativeItem().Column(column =>
                    {
                        if (logoBytes is { Length: > 0 })
                        {
                            column.Item().Height(55).Width(140).Image(logoBytes).FitArea();
                        }

                        column.Item().PaddingTop(8).Text(settings.CompanyName).FontSize(20).Bold();
                        foreach (var line in CompanyLines(settings))
                        {
                            column.Item().Text(line).FontSize(9).FontColor(Colors.Grey.Darken2);
                        }
                    });

                    row.ConstantItem(190).AlignRight().Column(column =>
                    {
                        column.Item().Text($"Devis {quote.Number}").FontSize(18).Bold();
                        column.Item().Text($"Emission: {quote.IssueDate:dd/MM/yyyy}");
                        column.Item().Text($"Valide jusqu'au: {quote.ValidUntil:dd/MM/yyyy}");
                    });
                });

                page.Content().PaddingVertical(25).Column(content =>
                {
                    content.Item().PaddingBottom(18).Border(1).BorderColor(Colors.Grey.Lighten2).Padding(12).Column(column =>
                    {
                        column.Item().Text("Client").FontSize(9).FontColor(Colors.Grey.Darken2).Bold();
                        column.Item().Text(ClientName(quote.Customer, quote.CustomerId)).FontSize(13).Bold();
                        foreach (var line in CustomerLines(quote.Customer))
                        {
                            column.Item().Text(line).FontSize(9).FontColor(Colors.Grey.Darken2);
                        }
                    });

                    content.Item().Table(table =>
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
                            header.Cell().Element(HeaderCell).AlignRight().Text("Qte");
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

                        static IContainer HeaderCell(IContainer cell) => cell.Background(Colors.Grey.Lighten3).BorderBottom(1).BorderColor(Colors.Grey.Medium).PaddingVertical(7).PaddingHorizontal(4);
                        static IContainer BodyCell(IContainer cell) => cell.BorderBottom(0.5f).BorderColor(Colors.Grey.Lighten2).PaddingVertical(6).PaddingHorizontal(4);
                    });

                    content.Item().PaddingTop(18).AlignRight().Width(220).Column(column =>
                    {
                        TotalLine(column, "Total HT", quote.Subtotal, quote.Currency, false);
                        TotalLine(column, "TVA", quote.VatTotal, quote.Currency, false);
                        TotalLine(column, "Total TTC", quote.Total, quote.Currency, true);
                    });

                    if (!string.IsNullOrWhiteSpace(settings.LegalText))
                    {
                        content.Item().PaddingTop(24).Text(settings.LegalText).FontSize(8).FontColor(Colors.Grey.Darken2);
                    }
                });

                page.Footer().Column(column =>
                {
                    column.Item().Text(settings.FooterText ?? "Merci pour votre confiance.").FontSize(8).FontColor(Colors.Grey.Darken2);
                    column.Item().AlignCenter().Text(text =>
                    {
                        text.Span("Page ");
                        text.CurrentPageNumber();
                        text.Span(" / ");
                        text.TotalPages();
                    });
                });
            });
        }).GeneratePdf();
    }

    private static IReadOnlyList<string> CompanyLines(QuotePdfSettings settings)
    {
        var lines = new List<string>();
        Add(settings.AddressLine1);
        Add(settings.AddressLine2);
        var cityLine = string.Join(" ", new[] { settings.PostalCode, settings.City }.Where(x => !string.IsNullOrWhiteSpace(x)));
        Add(cityLine);
        Add(settings.Country);
        Add(ContactLine(settings));
        Add(settings.VatNumber is null ? null : $"TVA: {settings.VatNumber}");
        Add(settings.Siret is null ? null : $"SIRET: {settings.Siret}");
        return lines;

        void Add(string? value)
        {
            if (!string.IsNullOrWhiteSpace(value))
            {
                lines.Add(value.Trim());
            }
        }
    }

    private static string? ContactLine(QuotePdfSettings settings)
    {
        var values = new[] { settings.Phone, settings.Email, settings.Website }
            .Where(x => !string.IsNullOrWhiteSpace(x))
            .Select(x => x!.Trim())
            .ToList();
        return values.Count == 0 ? null : string.Join(" | ", values);
    }

    private static string ClientName(Customer? customer, Guid customerId)
        => customer?.CompanyName ?? customerId.ToString();

    private static IReadOnlyList<string> CustomerLines(Customer? customer)
    {
        var lines = new List<string>();
        if (customer is null)
        {
            return lines;
        }

        Add(DistinctValue(customer.LegalName, customer.CompanyName) is { } legalName ? $"Raison sociale: {legalName}" : null);
        Add(DistinctValue(customer.TradeName, customer.CompanyName) is { } tradeName ? $"Nom commercial: {tradeName}" : null);

        var address = SelectCustomerAddress(customer);
        Add(address?.Line1);
        Add(address?.Line2);
        var cityLine = string.Join(" ", new[] { address?.PostalCode, address?.City }.Where(x => !string.IsNullOrWhiteSpace(x)));
        Add(cityLine);
        Add(address?.Country);

        var contact = SelectCustomerContact(customer);
        var contactName = string.Join(" ", new[] { contact?.FirstName, contact?.LastName }.Where(x => !string.IsNullOrWhiteSpace(x)));
        Add(string.IsNullOrWhiteSpace(contactName) ? null : $"Contact: {contactName}");
        Add(CustomerContactLine(customer, contact));
        Add(customer.SirenNumber is null ? null : $"SIREN: {customer.SirenNumber}");
        Add(customer.SiretNumber is null ? null : $"SIRET: {customer.SiretNumber}");
        Add(customer.VatNumber is null ? null : $"TVA intracommunautaire: {customer.VatNumber}");
        return lines;

        void Add(string? value)
        {
            if (!string.IsNullOrWhiteSpace(value))
            {
                lines.Add(value.Trim());
            }
        }
    }

    private static CustomerContact? SelectCustomerContact(Customer customer)
        => customer.Contacts
            .OrderByDescending(x => x.IsPrimary)
            .ThenBy(x => x.LastName)
            .ThenBy(x => x.FirstName)
            .FirstOrDefault();

    private static CustomerAddress? SelectCustomerAddress(Customer customer)
        => customer.Addresses
            .OrderByDescending(x => x.IsBilling)
            .ThenByDescending(x => x.IsShipping)
            .ThenBy(x => x.Label)
            .FirstOrDefault();

    private static string? CustomerContactLine(Customer customer, CustomerContact? contact)
    {
        var values = new[] { customer.Email, customer.Phone, customer.MobilePhone, contact?.Email, contact?.Phone, customer.Website }
            .Where(x => !string.IsNullOrWhiteSpace(x))
            .Select(x => x!.Trim())
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToList();
        return values.Count == 0 ? null : string.Join(" | ", values);
    }

    private static string? DistinctValue(string? value, string reference)
        => string.IsNullOrWhiteSpace(value) || string.Equals(value.Trim(), reference.Trim(), StringComparison.OrdinalIgnoreCase)
            ? null
            : value.Trim();

    private static void TotalLine(ColumnDescriptor column, string label, decimal amount, string currency, bool important)
    {
        column.Item().Row(row =>
        {
            row.RelativeItem().Text(label).Bold();
            var text = row.RelativeItem().AlignRight().Text($"{amount:0.00} {currency}");
            if (important)
            {
                text.Bold().FontSize(13);
            }
        });
    }
}
