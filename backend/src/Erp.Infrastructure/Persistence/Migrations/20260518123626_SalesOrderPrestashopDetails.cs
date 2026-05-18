using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Erp.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class SalesOrderPrestashopDetails : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "ExternalStatusName",
                table: "SalesOrders",
                type: "character varying(160)",
                maxLength: 160,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "InvoiceReference",
                table: "SalesOrders",
                type: "character varying(80)",
                maxLength: 80,
                nullable: true);

            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "OrderedAt",
                table: "SalesOrders",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "PaidTotal",
                table: "SalesOrders",
                type: "numeric(18,2)",
                precision: 18,
                scale: 2,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "PaymentMethod",
                table: "SalesOrders",
                type: "character varying(160)",
                maxLength: 160,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "PaymentModule",
                table: "SalesOrders",
                type: "character varying(120)",
                maxLength: 120,
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "ProductsTotal",
                table: "SalesOrders",
                type: "numeric(18,2)",
                precision: 18,
                scale: 2,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ShippingServiceName",
                table: "SalesOrders",
                type: "character varying(180)",
                maxLength: 180,
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "ShippingTotal",
                table: "SalesOrders",
                type: "numeric(18,2)",
                precision: 18,
                scale: 2,
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "ShippingWeightKg",
                table: "SalesOrders",
                type: "numeric(18,3)",
                precision: 18,
                scale: 3,
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "ExternalStatusName",
                table: "SalesOrders");

            migrationBuilder.DropColumn(
                name: "InvoiceReference",
                table: "SalesOrders");

            migrationBuilder.DropColumn(
                name: "OrderedAt",
                table: "SalesOrders");

            migrationBuilder.DropColumn(
                name: "PaidTotal",
                table: "SalesOrders");

            migrationBuilder.DropColumn(
                name: "PaymentMethod",
                table: "SalesOrders");

            migrationBuilder.DropColumn(
                name: "PaymentModule",
                table: "SalesOrders");

            migrationBuilder.DropColumn(
                name: "ProductsTotal",
                table: "SalesOrders");

            migrationBuilder.DropColumn(
                name: "ShippingServiceName",
                table: "SalesOrders");

            migrationBuilder.DropColumn(
                name: "ShippingTotal",
                table: "SalesOrders");

            migrationBuilder.DropColumn(
                name: "ShippingWeightKg",
                table: "SalesOrders");
        }
    }
}
