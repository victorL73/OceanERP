using System;
using Erp.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Erp.Infrastructure.Persistence.Migrations
{
    [DbContext(typeof(ErpDbContext))]
    [Migration("20260526192000_NotificationReadRetention")]
    public partial class NotificationReadRetention : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "ReadAt",
                table: "Notifications",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.Sql("""
                UPDATE "Notifications"
                SET "ReadAt" = "CreatedAt"
                WHERE "IsRead" = TRUE AND "ReadAt" IS NULL;
                """);

            migrationBuilder.CreateIndex(
                name: "IX_Notifications_IsRead_ReadAt",
                table: "Notifications",
                columns: new[] { "IsRead", "ReadAt" });
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_Notifications_IsRead_ReadAt",
                table: "Notifications");

            migrationBuilder.DropColumn(
                name: "ReadAt",
                table: "Notifications");
        }
    }
}
