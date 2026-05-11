using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Erp.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class PrestashopSyncExecutionLog : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "CompletedAt",
                table: "PrestashopSyncLogs",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Message",
                table: "PrestashopSyncLogs",
                type: "character varying(1000)",
                maxLength: 1000,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "StartedAt",
                table: "PrestashopSyncLogs",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.Sql("""
                UPDATE "PrestashopSyncLogs"
                SET "Status" = 'Failed',
                    "Message" = 'Ancienne demande marquee Queued avant ajout du moteur de synchronisation. Relancez une synchronisation manuelle.',
                    "CompletedAt" = COALESCE("CompletedAt", "CreatedAt")
                WHERE "Status" = 'Queued';
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "CompletedAt",
                table: "PrestashopSyncLogs");

            migrationBuilder.DropColumn(
                name: "Message",
                table: "PrestashopSyncLogs");

            migrationBuilder.DropColumn(
                name: "StartedAt",
                table: "PrestashopSyncLogs");
        }
    }
}
