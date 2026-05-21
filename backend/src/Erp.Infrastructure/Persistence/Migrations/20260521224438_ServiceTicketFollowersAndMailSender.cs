using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Erp.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class ServiceTicketFollowersAndMailSender : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "ExternalAuthorEmail",
                table: "ServiceTicketMessages",
                type: "character varying(320)",
                maxLength: 320,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ExternalAuthorName",
                table: "ServiceTicketMessages",
                type: "character varying(180)",
                maxLength: 180,
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "DefaultSystemMailAccountId",
                table: "MailServerSettings",
                type: "uuid",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "ServiceTicketPublicLinks",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    ServiceTicketId = table.Column<Guid>(type: "uuid", nullable: false),
                    TokenHash = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: false),
                    ExpiresAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    CreatedByUserId = table.Column<Guid>(type: "uuid", nullable: true),
                    IsRevoked = table.Column<bool>(type: "boolean", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ServiceTicketPublicLinks", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ServiceTicketPublicLinks_ServiceTickets_ServiceTicketId",
                        column: x => x.ServiceTicketId,
                        principalTable: "ServiceTickets",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_ServiceTicketPublicLinks_Users_CreatedByUserId",
                        column: x => x.CreatedByUserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateTable(
                name: "ServiceTicketWatchers",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    ServiceTicketId = table.Column<Guid>(type: "uuid", nullable: false),
                    UserId = table.Column<Guid>(type: "uuid", nullable: false),
                    AddedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ServiceTicketWatchers", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ServiceTicketWatchers_ServiceTickets_ServiceTicketId",
                        column: x => x.ServiceTicketId,
                        principalTable: "ServiceTickets",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_ServiceTicketWatchers_Users_UserId",
                        column: x => x.UserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_MailServerSettings_DefaultSystemMailAccountId",
                table: "MailServerSettings",
                column: "DefaultSystemMailAccountId");

            migrationBuilder.CreateIndex(
                name: "IX_ServiceTicketPublicLinks_CreatedByUserId",
                table: "ServiceTicketPublicLinks",
                column: "CreatedByUserId");

            migrationBuilder.CreateIndex(
                name: "IX_ServiceTicketPublicLinks_ServiceTicketId",
                table: "ServiceTicketPublicLinks",
                column: "ServiceTicketId");

            migrationBuilder.CreateIndex(
                name: "IX_ServiceTicketPublicLinks_TokenHash",
                table: "ServiceTicketPublicLinks",
                column: "TokenHash",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_ServiceTicketWatchers_ServiceTicketId_UserId",
                table: "ServiceTicketWatchers",
                columns: new[] { "ServiceTicketId", "UserId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_ServiceTicketWatchers_UserId",
                table: "ServiceTicketWatchers",
                column: "UserId");

            migrationBuilder.AddForeignKey(
                name: "FK_MailServerSettings_MailAccounts_DefaultSystemMailAccountId",
                table: "MailServerSettings",
                column: "DefaultSystemMailAccountId",
                principalTable: "MailAccounts",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_MailServerSettings_MailAccounts_DefaultSystemMailAccountId",
                table: "MailServerSettings");

            migrationBuilder.DropTable(
                name: "ServiceTicketPublicLinks");

            migrationBuilder.DropTable(
                name: "ServiceTicketWatchers");

            migrationBuilder.DropIndex(
                name: "IX_MailServerSettings_DefaultSystemMailAccountId",
                table: "MailServerSettings");

            migrationBuilder.DropColumn(
                name: "ExternalAuthorEmail",
                table: "ServiceTicketMessages");

            migrationBuilder.DropColumn(
                name: "ExternalAuthorName",
                table: "ServiceTicketMessages");

            migrationBuilder.DropColumn(
                name: "DefaultSystemMailAccountId",
                table: "MailServerSettings");
        }
    }
}
