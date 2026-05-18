using Erp.Application.Sales;
using QuestPDF.Fluent;
using QuestPDF.Helpers;
using QuestPDF.Infrastructure;

namespace Erp.Infrastructure.Pdf;

public sealed class SalesOrderShipmentPdfService : ISalesOrderShipmentPdfService
{
    public byte[] Generate(SalesOrderShipmentSlipPdfModel model)
    {
        QuestPDF.Settings.License = LicenseType.Community;

        return Document.Create(container =>
        {
            container.Page(page =>
            {
                page.Margin(36);
                page.Size(PageSizes.A4);
                page.DefaultTextStyle(x => x.FontSize(10));

                page.Header().Row(row =>
                {
                    row.RelativeItem().Column(column =>
                    {
                        column.Item().Text("OceanERP").FontSize(22).Bold();
                        column.Item().Text(model.DocumentTitle).FontSize(16).SemiBold();
                        column.Item().Text($"Commande: {model.OrderNumber}");
                    });

                    row.RelativeItem().AlignRight().Column(column =>
                    {
                        column.Item().Text($"Date: {DateTimeOffset.UtcNow:dd/MM/yyyy HH:mm}");
                        column.Item().Text($"Transporteur: {Display(model.CarrierName)}");
                        column.Item().Text($"Suivi: {Display(model.TrackingNumber)}");
                    });
                });

                page.Content().PaddingVertical(24).Column(column =>
                {
                    column.Spacing(18);

                    if (!string.IsNullOrWhiteSpace(model.NoticeText))
                    {
                        column.Item()
                            .Border(1)
                            .BorderColor(Colors.Orange.Medium)
                            .Background(Colors.Orange.Lighten5)
                            .Padding(10)
                            .Text(model.NoticeText)
                            .FontColor(Colors.Orange.Darken4)
                            .SemiBold();
                    }

                    column.Item().Row(row =>
                    {
                        row.RelativeItem().Element(AddressCard).Column(address =>
                        {
                            address.Item().Text("Destinataire").Bold().FontSize(12);
                            address.Item().Text(Display(model.ShippingAddress.Name));
                            address.Item().Text(Display(model.ShippingAddress.Line1));
                            if (!string.IsNullOrWhiteSpace(model.ShippingAddress.Line2))
                            {
                                address.Item().Text(model.ShippingAddress.Line2);
                            }

                            address.Item().Text($"{Display(model.ShippingAddress.PostalCode)} {Display(model.ShippingAddress.City)}".Trim());
                            address.Item().Text(Display(model.ShippingAddress.Country));
                            if (!string.IsNullOrWhiteSpace(model.ShippingAddress.Phone))
                            {
                                address.Item().Text($"Tel: {model.ShippingAddress.Phone}");
                            }

                            if (!string.IsNullOrWhiteSpace(model.ShippingAddress.Email))
                            {
                                address.Item().Text($"Email: {model.ShippingAddress.Email}");
                            }
                        });

                        row.ConstantItem(20);
                        row.RelativeItem().Element(AddressCard).Column(info =>
                        {
                            info.Item().Text("Preparation").Bold().FontSize(12);
                            info.Item().Text($"Client: {model.CustomerName}");
                            info.Item().Text($"Commande creee le: {model.CreatedAt:dd/MM/yyyy HH:mm}");
                            info.Item().Text("Controle: colis prepare, document joint, expedition a valider.");
                        });
                    });

                    column.Item().Table(table =>
                    {
                        table.ColumnsDefinition(columns =>
                        {
                            columns.RelativeColumn(5);
                            columns.RelativeColumn();
                        });

                        table.Header(header =>
                        {
                            header.Cell().Element(HeaderCell).Text("Article");
                            header.Cell().Element(HeaderCell).AlignRight().Text("Quantite");
                        });

                        foreach (var line in model.Lines)
                        {
                            table.Cell().Element(BodyCell).Text(line.Description);
                            table.Cell().Element(BodyCell).AlignRight().Text(line.Quantity.ToString("0.###"));
                        }
                    });
                });

                page.Footer().AlignCenter().Text(model.FooterText);
            });
        }).GeneratePdf();

        static string Display(string? value) => string.IsNullOrWhiteSpace(value) ? "-" : value.Trim();
        static IContainer AddressCard(IContainer container) => container.Border(1).BorderColor(Colors.Grey.Lighten2).Padding(12);
        static IContainer HeaderCell(IContainer container) => container.BorderBottom(1).BorderColor(Colors.Grey.Medium).PaddingVertical(6);
        static IContainer BodyCell(IContainer container) => container.BorderBottom(0.5f).BorderColor(Colors.Grey.Lighten2).PaddingVertical(6);
    }
}
