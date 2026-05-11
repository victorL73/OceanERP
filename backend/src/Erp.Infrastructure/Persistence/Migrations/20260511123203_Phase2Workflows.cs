using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Erp.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class Phase2Workflows : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "ReferenceId",
                table: "StockMovements",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ReferenceModule",
                table: "StockMovements",
                type: "character varying(80)",
                maxLength: 80,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Type",
                table: "StockMovements",
                type: "character varying(80)",
                maxLength: 80,
                nullable: false,
                defaultValue: "Adjustment");

            migrationBuilder.AddColumn<decimal>(
                name: "QuantityReserved",
                table: "StockItems",
                type: "numeric(18,3)",
                precision: 18,
                scale: 3,
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "CancelledAt",
                table: "SalesOrders",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "CompletedAt",
                table: "SalesOrders",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "ConfirmedAt",
                table: "SalesOrders",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "ShippedAt",
                table: "SalesOrders",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "WarehouseId",
                table: "SalesOrders",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "ProductId",
                table: "SalesOrderLines",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "ImapPort",
                table: "MailAccounts",
                type: "integer",
                nullable: false,
                defaultValue: 993);

            migrationBuilder.AddColumn<string>(
                name: "PasswordSecretName",
                table: "MailAccounts",
                type: "character varying(160)",
                maxLength: 160,
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "SmtpPort",
                table: "MailAccounts",
                type: "integer",
                nullable: false,
                defaultValue: 587);

            migrationBuilder.AddColumn<bool>(
                name: "UseSsl",
                table: "MailAccounts",
                type: "boolean",
                nullable: false,
                defaultValue: true);

            migrationBuilder.AddColumn<string>(
                name: "UserName",
                table: "MailAccounts",
                type: "character varying(320)",
                maxLength: 320,
                nullable: true);

            migrationBuilder.AddColumn<DateOnly>(
                name: "DueDate",
                table: "Invoices",
                type: "date",
                nullable: false,
                defaultValueSql: "(CURRENT_DATE + INTERVAL '30 days')::date");

            migrationBuilder.AddColumn<DateOnly>(
                name: "IssueDate",
                table: "Invoices",
                type: "date",
                nullable: false,
                defaultValueSql: "CURRENT_DATE");

            migrationBuilder.AddColumn<Guid>(
                name: "SalesOrderId",
                table: "Invoices",
                type: "uuid",
                nullable: true);

            migrationBuilder.AlterColumn<string>(
                name: "StoragePath",
                table: "InvoiceDocuments",
                type: "character varying(1024)",
                maxLength: 1024,
                nullable: false,
                oldClrType: typeof(string),
                oldType: "text");

            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "CreatedAt",
                table: "InvoiceDocuments",
                type: "timestamp with time zone",
                nullable: false,
                defaultValueSql: "CURRENT_TIMESTAMP");

            migrationBuilder.AddColumn<string>(
                name: "FileName",
                table: "InvoiceDocuments",
                type: "character varying(260)",
                maxLength: 260,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "MimeType",
                table: "InvoiceDocuments",
                type: "character varying(120)",
                maxLength: 120,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<long>(
                name: "Size",
                table: "InvoiceDocuments",
                type: "bigint",
                nullable: false,
                defaultValue: 0L);

            migrationBuilder.AddColumn<int>(
                name: "Version",
                table: "InvoiceDocuments",
                type: "integer",
                nullable: false,
                defaultValue: 1);

            migrationBuilder.AddColumn<string>(
                name: "Body",
                table: "EmailMessages",
                type: "text",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "Direction",
                table: "EmailMessages",
                type: "character varying(40)",
                maxLength: 40,
                nullable: false,
                defaultValue: "Outgoing");

            migrationBuilder.AddColumn<bool>(
                name: "IsRead",
                table: "EmailMessages",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "SentAt",
                table: "EmailMessages",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Status",
                table: "EmailMessages",
                type: "character varying(80)",
                maxLength: 80,
                nullable: false,
                defaultValue: "Queued");

            migrationBuilder.CreateIndex(
                name: "IX_Invoices_SalesOrderId",
                table: "Invoices",
                column: "SalesOrderId",
                unique: true,
                filter: "\"SalesOrderId\" IS NOT NULL");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_Invoices_SalesOrderId",
                table: "Invoices");

            migrationBuilder.DropColumn(
                name: "ReferenceId",
                table: "StockMovements");

            migrationBuilder.DropColumn(
                name: "ReferenceModule",
                table: "StockMovements");

            migrationBuilder.DropColumn(
                name: "Type",
                table: "StockMovements");

            migrationBuilder.DropColumn(
                name: "QuantityReserved",
                table: "StockItems");

            migrationBuilder.DropColumn(
                name: "CancelledAt",
                table: "SalesOrders");

            migrationBuilder.DropColumn(
                name: "CompletedAt",
                table: "SalesOrders");

            migrationBuilder.DropColumn(
                name: "ConfirmedAt",
                table: "SalesOrders");

            migrationBuilder.DropColumn(
                name: "ShippedAt",
                table: "SalesOrders");

            migrationBuilder.DropColumn(
                name: "WarehouseId",
                table: "SalesOrders");

            migrationBuilder.DropColumn(
                name: "ProductId",
                table: "SalesOrderLines");

            migrationBuilder.DropColumn(
                name: "ImapPort",
                table: "MailAccounts");

            migrationBuilder.DropColumn(
                name: "PasswordSecretName",
                table: "MailAccounts");

            migrationBuilder.DropColumn(
                name: "SmtpPort",
                table: "MailAccounts");

            migrationBuilder.DropColumn(
                name: "UseSsl",
                table: "MailAccounts");

            migrationBuilder.DropColumn(
                name: "UserName",
                table: "MailAccounts");

            migrationBuilder.DropColumn(
                name: "DueDate",
                table: "Invoices");

            migrationBuilder.DropColumn(
                name: "IssueDate",
                table: "Invoices");

            migrationBuilder.DropColumn(
                name: "SalesOrderId",
                table: "Invoices");

            migrationBuilder.DropColumn(
                name: "CreatedAt",
                table: "InvoiceDocuments");

            migrationBuilder.DropColumn(
                name: "FileName",
                table: "InvoiceDocuments");

            migrationBuilder.DropColumn(
                name: "MimeType",
                table: "InvoiceDocuments");

            migrationBuilder.DropColumn(
                name: "Size",
                table: "InvoiceDocuments");

            migrationBuilder.DropColumn(
                name: "Version",
                table: "InvoiceDocuments");

            migrationBuilder.DropColumn(
                name: "Body",
                table: "EmailMessages");

            migrationBuilder.DropColumn(
                name: "Direction",
                table: "EmailMessages");

            migrationBuilder.DropColumn(
                name: "IsRead",
                table: "EmailMessages");

            migrationBuilder.DropColumn(
                name: "SentAt",
                table: "EmailMessages");

            migrationBuilder.DropColumn(
                name: "Status",
                table: "EmailMessages");

            migrationBuilder.AlterColumn<string>(
                name: "StoragePath",
                table: "InvoiceDocuments",
                type: "text",
                nullable: false,
                oldClrType: typeof(string),
                oldType: "character varying(1024)",
                oldMaxLength: 1024);
        }
    }
}
