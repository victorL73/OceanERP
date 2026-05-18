using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Erp.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class SalesOrderShippingDetails : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "ShippingAddressLine1",
                table: "SalesOrders",
                type: "character varying(240)",
                maxLength: 240,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ShippingAddressLine2",
                table: "SalesOrders",
                type: "character varying(240)",
                maxLength: 240,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ShippingAddressName",
                table: "SalesOrders",
                type: "character varying(220)",
                maxLength: 220,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ShippingCarrierName",
                table: "SalesOrders",
                type: "character varying(160)",
                maxLength: 160,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ShippingCity",
                table: "SalesOrders",
                type: "character varying(160)",
                maxLength: 160,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ShippingCountry",
                table: "SalesOrders",
                type: "character varying(120)",
                maxLength: 120,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ShippingEmail",
                table: "SalesOrders",
                type: "character varying(220)",
                maxLength: 220,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ShippingPhone",
                table: "SalesOrders",
                type: "character varying(80)",
                maxLength: 80,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ShippingPostalCode",
                table: "SalesOrders",
                type: "character varying(40)",
                maxLength: 40,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ShippingTrackingNumber",
                table: "SalesOrders",
                type: "character varying(120)",
                maxLength: 120,
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_SalesOrders_CustomerId",
                table: "SalesOrders",
                column: "CustomerId");

            migrationBuilder.CreateIndex(
                name: "IX_SalesOrders_WarehouseId",
                table: "SalesOrders",
                column: "WarehouseId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_SalesOrders_CustomerId",
                table: "SalesOrders");

            migrationBuilder.DropIndex(
                name: "IX_SalesOrders_WarehouseId",
                table: "SalesOrders");

            migrationBuilder.DropColumn(
                name: "ShippingAddressLine1",
                table: "SalesOrders");

            migrationBuilder.DropColumn(
                name: "ShippingAddressLine2",
                table: "SalesOrders");

            migrationBuilder.DropColumn(
                name: "ShippingAddressName",
                table: "SalesOrders");

            migrationBuilder.DropColumn(
                name: "ShippingCarrierName",
                table: "SalesOrders");

            migrationBuilder.DropColumn(
                name: "ShippingCity",
                table: "SalesOrders");

            migrationBuilder.DropColumn(
                name: "ShippingCountry",
                table: "SalesOrders");

            migrationBuilder.DropColumn(
                name: "ShippingEmail",
                table: "SalesOrders");

            migrationBuilder.DropColumn(
                name: "ShippingPhone",
                table: "SalesOrders");

            migrationBuilder.DropColumn(
                name: "ShippingPostalCode",
                table: "SalesOrders");

            migrationBuilder.DropColumn(
                name: "ShippingTrackingNumber",
                table: "SalesOrders");
        }
    }
}
