using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Erp.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class ServiceTicketAssignment : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "AssignedUserId",
                table: "ServiceTickets",
                type: "uuid",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "ServiceTicketInitialResponders",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    UserId = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ServiceTicketInitialResponders", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ServiceTicketInitialResponders_Users_UserId",
                        column: x => x.UserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_ServiceTickets_AssignedUserId",
                table: "ServiceTickets",
                column: "AssignedUserId");

            migrationBuilder.CreateIndex(
                name: "IX_ServiceTicketInitialResponders_UserId",
                table: "ServiceTicketInitialResponders",
                column: "UserId",
                unique: true);

            migrationBuilder.AddForeignKey(
                name: "FK_ServiceTickets_Users_AssignedUserId",
                table: "ServiceTickets",
                column: "AssignedUserId",
                principalTable: "Users",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_ServiceTickets_Users_AssignedUserId",
                table: "ServiceTickets");

            migrationBuilder.DropTable(
                name: "ServiceTicketInitialResponders");

            migrationBuilder.DropIndex(
                name: "IX_ServiceTickets_AssignedUserId",
                table: "ServiceTickets");

            migrationBuilder.DropColumn(
                name: "AssignedUserId",
                table: "ServiceTickets");
        }
    }
}
