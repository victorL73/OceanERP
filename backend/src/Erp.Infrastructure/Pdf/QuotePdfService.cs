using Erp.Application.Quotes;
using Erp.Domain.Customers;
using Erp.Domain.Quotes;
using QuestPDF.Fluent;
using QuestPDF.Helpers;
using QuestPDF.Infrastructure;

namespace Erp.Infrastructure.Pdf;

public sealed class QuotePdfService : IQuotePdfService
{
    private const string PrimaryColor = "#0B3D4A";
    private const string AccentColor = "#F05A24";
    private const string SoftBackground = "#F3FAFC";

    public byte[] Generate(Quote quote, QuotePdfSettings settings, byte[]? logoBytes)
    {
        QuestPDF.Settings.License = LicenseType.Community;

        return Document.Create(container =>
        {
            container.Page(page =>
            {
                page.Size(PageSizes.A4);
                page.Margin(42);
                page.DefaultTextStyle(x => x.FontSize(10).FontColor("#14212B"));

                page.Header().Column(header =>
                {
                    header.Item().Row(row =>
                    {
                        row.RelativeItem().Height(82).AlignMiddle().Column(column =>
                        {
                            if (logoBytes is { Length: > 0 })
                            {
                                column.Item().Height(72).Width(210).Image(logoBytes).FitArea();
                            }
                            else
                            {
                                column.Item().Text(settings.CompanyName).FontSize(24).Bold().FontColor(PrimaryColor);
                            }
                        });

                        row.ConstantItem(260).AlignRight().Column(column =>
                        {
                            column.Item().Text("DEVIS").FontSize(26).Bold().FontColor(PrimaryColor);
                            column.Item().PaddingTop(4).Text("PROPOSITION COMMERCIALE").FontSize(12).Bold().FontColor(AccentColor);
                            column.Item().PaddingTop(10).Text($"Document genere par {settings.CompanyName}").FontSize(9).FontColor(Colors.Grey.Darken1);
                        });
                    });

                    header.Item().PaddingTop(14).BorderBottom(1.2f).BorderColor(PrimaryColor);
                });

                page.Content().PaddingTop(20).Column(content =>
                {
                    content.Spacing(22);

                    content.Item().AlignRight().Width(265).Background(SoftBackground).Border(1).BorderColor(Colors.Grey.Lighten2).Padding(16).Column(column =>
                    {
                        column.Spacing(9);
                        InfoRow(column, "Numero", quote.Number, true);
                        InfoRow(column, "Date", quote.IssueDate.ToString("dd/MM/yyyy"));
                        InfoRow(column, "Valable", quote.ValidUntil.ToString("dd/MM/yyyy"));
                        InfoRow(column, "Statut", StatusLabel(quote.Status));
                    });

                    content.Item().Row(row =>
                    {
                        row.RelativeItem().Element(InfoCard).Column(column =>
                        {
                            column.Spacing(6);
                            column.Item().Text("VENDEUR").FontSize(10).Bold().FontColor(PrimaryColor);
                            column.Item().PaddingTop(8).Text(settings.CompanyName).Bold();
                            foreach (var line in CompanyLines(settings))
                            {
                                column.Item().Text(line).FontSize(9);
                            }
                        });

                        row.ConstantItem(34);

                        row.RelativeItem().Element(InfoCard).Column(column =>
                        {
                            column.Spacing(6);
                            column.Item().Text("CLIENT").FontSize(10).Bold().FontColor(PrimaryColor);
                            column.Item().PaddingTop(8).Text(ClientName(quote.Customer, quote.CustomerId)).Bold();
                            foreach (var line in CustomerLines(quote.Customer))
                            {
                                column.Item().Text(line).FontSize(9);
                            }
                        });
                    });

                    content.Item().Table(table =>
                    {
                        table.ColumnsDefinition(columns =>
                        {
                            columns.RelativeColumn(5);
                            columns.RelativeColumn(0.9f);
                            columns.RelativeColumn(1.35f);
                            columns.RelativeColumn(1.5f);
                            columns.RelativeColumn(1.55f);
                        });

                        table.Header(header =>
                        {
                            header.Cell().Element(HeaderCell).Text("Designation");
                            header.Cell().Element(HeaderCell).AlignRight().Text("Qte");
                            header.Cell().Element(HeaderCell).AlignRight().Text("PU HT");
                            header.Cell().Element(HeaderCell).AlignRight().Text("Total HT");
                            header.Cell().Element(HeaderCell).AlignRight().Text("Total TTC");
                        });

                        var index = 0;
                        foreach (var line in quote.Lines)
                        {
                            table.Cell().Element(cell => BodyCell(cell, index)).Text(line.Description);
                            table.Cell().Element(cell => BodyCell(cell, index)).AlignRight().Text(line.Quantity.ToString("0.###"));
                            table.Cell().Element(cell => BodyCell(cell, index)).AlignRight().Text(FormatMoney(line.UnitPrice, quote.Currency));
                            table.Cell().Element(cell => BodyCell(cell, index)).AlignRight().Text(FormatMoney(line.LineNetTotal, quote.Currency));
                            table.Cell().Element(cell => BodyCell(cell, index)).AlignRight().Text(FormatMoney(line.LineTotal, quote.Currency)).Bold();
                            index++;
                        }

                        static IContainer HeaderCell(IContainer cell) => cell
                            .Background(PrimaryColor)
                            .PaddingVertical(8)
                            .PaddingHorizontal(7)
                            .DefaultTextStyle(x => x.FontColor(Colors.White).Bold());

                        static IContainer BodyCell(IContainer cell, int rowIndex) => cell
                            .Background(rowIndex % 2 == 0 ? Colors.Grey.Lighten5 : Colors.White)
                            .BorderBottom(0.5f)
                            .BorderColor(Colors.Grey.Lighten2)
                            .PaddingVertical(8)
                            .PaddingHorizontal(7);
                    });

                    content.Item().Row(row =>
                    {
                        row.RelativeItem().Column(column =>
                        {
                            column.Spacing(12);
                            column.Item().Text("Conditions de reglement").FontSize(10).Bold().FontColor(Colors.Grey.Darken1);
                            column.Item().Text(string.IsNullOrWhiteSpace(settings.LegalText) ? "A definir" : settings.LegalText).FontSize(9).FontColor(Colors.Grey.Darken2);

                            if (ShouldShowSignatureBox(quote))
                            {
                                column.Item().Width(300).Border(1).BorderColor(Colors.Teal.Lighten1).Padding(14).Column(signature =>
                                {
                                    signature.Spacing(5);
                                    signature.Item().Text("Signe electroniquement").FontSize(9).Bold().FontColor(PrimaryColor);
                                    signature.Item().Text(ClientName(quote.Customer, quote.CustomerId)).FontSize(9);
                                    signature.Item().Text(SignatureDate(quote)).FontSize(8).FontColor(Colors.Grey.Darken1);
                                });
                            }
                        });

                        row.ConstantItem(50);

                        row.ConstantItem(260).Background(SoftBackground).Border(1).BorderColor(Colors.Grey.Lighten2).Padding(18).Column(column =>
                        {
                            column.Spacing(12);
                            TotalLine(column, "Total HT", quote.Subtotal, quote.Currency, false);
                            TotalLine(column, "TVA", quote.VatTotal, quote.Currency, false);
                            TotalLine(column, "Total TTC", quote.Total, quote.Currency, true);
                        });
                    });
                });

                page.Footer().Column(column =>
                {
                    column.Item().BorderTop(0.5f).BorderColor(Colors.Grey.Lighten2).PaddingTop(10).AlignCenter().Text(settings.FooterText ?? $"{settings.CompanyName} - Devis genere par OceanERP").FontSize(8).FontColor(Colors.Grey.Darken1);
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

    private static IContainer InfoCard(IContainer container)
        => container.MinHeight(132).Border(1).BorderColor(Colors.Grey.Lighten2).Padding(16);

    private static void InfoRow(ColumnDescriptor column, string label, string value, bool important = false)
    {
        column.Item().Row(row =>
        {
            row.ConstantItem(80).Text(label).Bold().FontColor(PrimaryColor);
            var text = row.RelativeItem().AlignRight().Text(value);
            if (important)
            {
                text.Bold().FontSize(14).FontColor(PrimaryColor);
            }
        });
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

    private static string StatusLabel(QuoteStatus status)
        => status switch
        {
            QuoteStatus.Draft => "Brouillon",
            QuoteStatus.Sent => "Envoye",
            QuoteStatus.Signed => "Signe",
            QuoteStatus.Refused => "Refuse",
            QuoteStatus.Expired => "Expire",
            QuoteStatus.ConvertedToOrder => "Transforme en commande",
            _ => status.ToString()
        };

    private static bool ShouldShowSignatureBox(Quote quote)
        => quote.Status is QuoteStatus.Signed or QuoteStatus.ConvertedToOrder;

    private static string SignatureDate(Quote quote)
    {
        var signedAt = quote.StatusHistory
            .Where(x => x.Status is QuoteStatus.Signed or QuoteStatus.ConvertedToOrder)
            .OrderByDescending(x => x.ChangedAt)
            .Select(x => (DateTimeOffset?)x.ChangedAt)
            .FirstOrDefault();
        return signedAt is null ? "Signature electronique OceanERP" : signedAt.Value.ToString("dd/MM/yyyy HH:mm");
    }

    private static string FormatMoney(decimal amount, string currency)
        => $"{amount:0.00} {currency}";

    private static void TotalLine(ColumnDescriptor column, string label, decimal amount, string currency, bool important)
    {
        column.Item().Row(row =>
        {
            row.RelativeItem().Text(label).FontSize(important ? 14 : 10).Bold().FontColor(important ? PrimaryColor : "#14212B");
            var text = row.RelativeItem().AlignRight().Text(FormatMoney(amount, currency));
            if (important)
            {
                text.Bold().FontSize(14).FontColor(AccentColor);
            }
        });
    }
}
