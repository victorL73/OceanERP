using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Erp.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class EmailAutoSyncSettings : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "ImapAutoSyncEnabled",
                table: "MailServerSettings",
                type: "boolean",
                nullable: false,
                defaultValue: true);

            migrationBuilder.AddColumn<int>(
                name: "ImapSyncIntervalMinutes",
                table: "MailServerSettings",
                type: "integer",
                nullable: false,
                defaultValue: 5);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "ImapAutoSyncEnabled",
                table: "MailServerSettings");

            migrationBuilder.DropColumn(
                name: "ImapSyncIntervalMinutes",
                table: "MailServerSettings");
        }
    }
}
