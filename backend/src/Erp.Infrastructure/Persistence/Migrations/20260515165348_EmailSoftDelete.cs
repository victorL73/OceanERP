using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Erp.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class EmailSoftDelete : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "DeletedAt",
                table: "EmailMessages",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "IsDeleted",
                table: "EmailMessages",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.CreateIndex(
                name: "IX_EmailMessages_MailAccountId_IsDeleted",
                table: "EmailMessages",
                columns: new[] { "MailAccountId", "IsDeleted" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_EmailMessages_MailAccountId_IsDeleted",
                table: "EmailMessages");

            migrationBuilder.DropColumn(
                name: "DeletedAt",
                table: "EmailMessages");

            migrationBuilder.DropColumn(
                name: "IsDeleted",
                table: "EmailMessages");
        }
    }
}
