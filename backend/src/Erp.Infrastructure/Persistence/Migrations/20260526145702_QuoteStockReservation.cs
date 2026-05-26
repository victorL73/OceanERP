using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Erp.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class QuoteStockReservation : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "StockReleasedAt",
                table: "Quotes",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "StockReservationWarehouseId",
                table: "Quotes",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "StockReserved",
                table: "Quotes",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "StockReservedAt",
                table: "Quotes",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_Quotes_StockReservationWarehouseId",
                table: "Quotes",
                column: "StockReservationWarehouseId");

            migrationBuilder.AddForeignKey(
                name: "FK_Quotes_Warehouses_StockReservationWarehouseId",
                table: "Quotes",
                column: "StockReservationWarehouseId",
                principalTable: "Warehouses",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Quotes_Warehouses_StockReservationWarehouseId",
                table: "Quotes");

            migrationBuilder.DropIndex(
                name: "IX_Quotes_StockReservationWarehouseId",
                table: "Quotes");

            migrationBuilder.DropColumn(
                name: "StockReleasedAt",
                table: "Quotes");

            migrationBuilder.DropColumn(
                name: "StockReservationWarehouseId",
                table: "Quotes");

            migrationBuilder.DropColumn(
                name: "StockReserved",
                table: "Quotes");

            migrationBuilder.DropColumn(
                name: "StockReservedAt",
                table: "Quotes");
        }
    }
}
