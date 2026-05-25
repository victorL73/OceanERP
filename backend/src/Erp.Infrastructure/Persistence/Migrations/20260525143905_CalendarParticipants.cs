using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Erp.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class CalendarParticipants : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "CalendarParticipants",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    CalendarEventId = table.Column<Guid>(type: "uuid", nullable: false),
                    UserId = table.Column<Guid>(type: "uuid", nullable: true),
                    ExternalName = table.Column<string>(type: "character varying(180)", maxLength: 180, nullable: true),
                    ExternalEmail = table.Column<string>(type: "character varying(320)", maxLength: 320, nullable: true),
                    Type = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    Status = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    InviteTokenHash = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: true),
                    InviteSentAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    RespondedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CalendarParticipants", x => x.Id);
                    table.ForeignKey(
                        name: "FK_CalendarParticipants_CalendarEvents_CalendarEventId",
                        column: x => x.CalendarEventId,
                        principalTable: "CalendarEvents",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_CalendarParticipants_Users_UserId",
                        column: x => x.UserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateIndex(
                name: "IX_CalendarParticipants_CalendarEventId",
                table: "CalendarParticipants",
                column: "CalendarEventId");

            migrationBuilder.CreateIndex(
                name: "IX_CalendarParticipants_InviteTokenHash",
                table: "CalendarParticipants",
                column: "InviteTokenHash",
                unique: true,
                filter: "\"InviteTokenHash\" IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "IX_CalendarParticipants_UserId",
                table: "CalendarParticipants",
                column: "UserId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "CalendarParticipants");
        }
    }
}
