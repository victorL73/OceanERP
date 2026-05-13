using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Erp.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class EmailModuleCompletion : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "DisplayName",
                table: "MailAccounts",
                type: "character varying(160)",
                maxLength: 160,
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "IsActive",
                table: "MailAccounts",
                type: "boolean",
                nullable: false,
                defaultValue: true);

            migrationBuilder.AddColumn<string>(
                name: "PasswordProtectedValue",
                table: "MailAccounts",
                type: "character varying(2000)",
                maxLength: 2000,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "SignatureHtml",
                table: "MailAccounts",
                type: "character varying(10000)",
                maxLength: 10000,
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "IsActive",
                table: "EmailTemplates",
                type: "boolean",
                nullable: false,
                defaultValue: true);

            migrationBuilder.AddColumn<string>(
                name: "Subject",
                table: "EmailTemplates",
                type: "character varying(300)",
                maxLength: 300,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "ErrorMessage",
                table: "EmailMessages",
                type: "character varying(1000)",
                maxLength: 1000,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ExternalMessageId",
                table: "EmailMessages",
                type: "character varying(512)",
                maxLength: 512,
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "MailAccountId",
                table: "EmailMessages",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "ReceivedAt",
                table: "EmailMessages",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AlterColumn<string>(
                name: "StoragePath",
                table: "EmailAttachments",
                type: "character varying(1024)",
                maxLength: 1024,
                nullable: false,
                oldClrType: typeof(string),
                oldType: "text");

            migrationBuilder.AddColumn<string>(
                name: "FileName",
                table: "EmailAttachments",
                type: "character varying(260)",
                maxLength: 260,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "MimeType",
                table: "EmailAttachments",
                type: "character varying(120)",
                maxLength: 120,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<long>(
                name: "Size",
                table: "EmailAttachments",
                type: "bigint",
                nullable: false,
                defaultValue: 0L);

            migrationBuilder.CreateTable(
                name: "MailAccountAccesses",
                columns: table => new
                {
                    MailAccountId = table.Column<Guid>(type: "uuid", nullable: false),
                    UserId = table.Column<Guid>(type: "uuid", nullable: false),
                    Id = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_MailAccountAccesses", x => new { x.MailAccountId, x.UserId });
                    table.ForeignKey(
                        name: "FK_MailAccountAccesses_MailAccounts_MailAccountId",
                        column: x => x.MailAccountId,
                        principalTable: "MailAccounts",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_MailAccountAccesses_Users_UserId",
                        column: x => x.UserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "MailServerSettings",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    SmtpHost = table.Column<string>(type: "character varying(240)", maxLength: 240, nullable: false),
                    SmtpPort = table.Column<int>(type: "integer", nullable: false),
                    ImapHost = table.Column<string>(type: "character varying(240)", maxLength: 240, nullable: false),
                    ImapPort = table.Column<int>(type: "integer", nullable: false),
                    UseSsl = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    CreatedByUserId = table.Column<Guid>(type: "uuid", nullable: true),
                    UpdatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    UpdatedByUserId = table.Column<Guid>(type: "uuid", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_MailServerSettings", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_MailAccounts_Email",
                table: "MailAccounts",
                column: "Email");

            migrationBuilder.CreateIndex(
                name: "IX_EmailMessages_MailAccountId_ExternalMessageId",
                table: "EmailMessages",
                columns: new[] { "MailAccountId", "ExternalMessageId" });

            migrationBuilder.CreateIndex(
                name: "IX_MailAccountAccesses_UserId",
                table: "MailAccountAccesses",
                column: "UserId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "MailAccountAccesses");

            migrationBuilder.DropTable(
                name: "MailServerSettings");

            migrationBuilder.DropIndex(
                name: "IX_MailAccounts_Email",
                table: "MailAccounts");

            migrationBuilder.DropIndex(
                name: "IX_EmailMessages_MailAccountId_ExternalMessageId",
                table: "EmailMessages");

            migrationBuilder.DropColumn(
                name: "DisplayName",
                table: "MailAccounts");

            migrationBuilder.DropColumn(
                name: "IsActive",
                table: "MailAccounts");

            migrationBuilder.DropColumn(
                name: "PasswordProtectedValue",
                table: "MailAccounts");

            migrationBuilder.DropColumn(
                name: "SignatureHtml",
                table: "MailAccounts");

            migrationBuilder.DropColumn(
                name: "IsActive",
                table: "EmailTemplates");

            migrationBuilder.DropColumn(
                name: "Subject",
                table: "EmailTemplates");

            migrationBuilder.DropColumn(
                name: "ErrorMessage",
                table: "EmailMessages");

            migrationBuilder.DropColumn(
                name: "ExternalMessageId",
                table: "EmailMessages");

            migrationBuilder.DropColumn(
                name: "MailAccountId",
                table: "EmailMessages");

            migrationBuilder.DropColumn(
                name: "ReceivedAt",
                table: "EmailMessages");

            migrationBuilder.DropColumn(
                name: "FileName",
                table: "EmailAttachments");

            migrationBuilder.DropColumn(
                name: "MimeType",
                table: "EmailAttachments");

            migrationBuilder.DropColumn(
                name: "Size",
                table: "EmailAttachments");

            migrationBuilder.AlterColumn<string>(
                name: "StoragePath",
                table: "EmailAttachments",
                type: "text",
                nullable: false,
                oldClrType: typeof(string),
                oldType: "character varying(1024)",
                oldMaxLength: 1024);
        }
    }
}
