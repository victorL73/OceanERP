using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Erp.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class InvoiceCreditNotes : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_Invoices_SalesOrderId",
                table: "Invoices");

            migrationBuilder.AddColumn<Guid>(
                name: "CreditOfInvoiceId",
                table: "Invoices",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "FacturXProfile",
                table: "Invoices",
                type: "character varying(80)",
                maxLength: 80,
                nullable: false,
                defaultValue: "Basic");

            migrationBuilder.AddColumn<string>(
                name: "Kind",
                table: "Invoices",
                type: "character varying(40)",
                maxLength: 40,
                nullable: false,
                defaultValue: "Invoice");

            migrationBuilder.CreateIndex(
                name: "IX_Invoices_CreditOfInvoiceId",
                table: "Invoices",
                column: "CreditOfInvoiceId");

            migrationBuilder.CreateIndex(
                name: "IX_Invoices_SalesOrderId",
                table: "Invoices",
                column: "SalesOrderId",
                unique: true,
                filter: "\"SalesOrderId\" IS NOT NULL AND \"Kind\" = 'Invoice'");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_Invoices_CreditOfInvoiceId",
                table: "Invoices");

            migrationBuilder.DropIndex(
                name: "IX_Invoices_SalesOrderId",
                table: "Invoices");

            migrationBuilder.DropColumn(
                name: "CreditOfInvoiceId",
                table: "Invoices");

            migrationBuilder.DropColumn(
                name: "FacturXProfile",
                table: "Invoices");

            migrationBuilder.DropColumn(
                name: "Kind",
                table: "Invoices");

            migrationBuilder.CreateIndex(
                name: "IX_Invoices_SalesOrderId",
                table: "Invoices",
                column: "SalesOrderId",
                unique: true,
                filter: "\"SalesOrderId\" IS NOT NULL");
        }
    }
}
