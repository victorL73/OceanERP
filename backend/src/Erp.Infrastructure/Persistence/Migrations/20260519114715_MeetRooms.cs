using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Erp.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class MeetRooms : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "MeetingRooms",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Code = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    Title = table.Column<string>(type: "character varying(260)", maxLength: 260, nullable: false),
                    CalendarEventId = table.Column<Guid>(type: "uuid", nullable: true),
                    InviteToken = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: true),
                    ScheduledStartAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    LastActivityAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    IsLocked = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    CreatedByUserId = table.Column<Guid>(type: "uuid", nullable: true),
                    UpdatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    UpdatedByUserId = table.Column<Guid>(type: "uuid", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_MeetingRooms", x => x.Id);
                    table.ForeignKey(
                        name: "FK_MeetingRooms_CalendarEvents_CalendarEventId",
                        column: x => x.CalendarEventId,
                        principalTable: "CalendarEvents",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateTable(
                name: "MeetingChatMessages",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    MeetingRoomId = table.Column<Guid>(type: "uuid", nullable: false),
                    UserId = table.Column<Guid>(type: "uuid", nullable: true),
                    ClientId = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: false),
                    SenderName = table.Column<string>(type: "character varying(180)", maxLength: 180, nullable: false),
                    Message = table.Column<string>(type: "character varying(10000)", maxLength: 10000, nullable: false),
                    FileName = table.Column<string>(type: "character varying(260)", maxLength: 260, nullable: true),
                    FileMimeType = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: true),
                    FileSize = table.Column<long>(type: "bigint", nullable: true),
                    FileStoragePath = table.Column<string>(type: "character varying(1024)", maxLength: 1024, nullable: true),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_MeetingChatMessages", x => x.Id);
                    table.ForeignKey(
                        name: "FK_MeetingChatMessages_MeetingRooms_MeetingRoomId",
                        column: x => x.MeetingRoomId,
                        principalTable: "MeetingRooms",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_MeetingChatMessages_Users_UserId",
                        column: x => x.UserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateTable(
                name: "MeetingParticipants",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    MeetingRoomId = table.Column<Guid>(type: "uuid", nullable: false),
                    UserId = table.Column<Guid>(type: "uuid", nullable: true),
                    ClientId = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: false),
                    DisplayName = table.Column<string>(type: "character varying(180)", maxLength: 180, nullable: false),
                    SourceLanguage = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    TargetLanguage = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    MicrophoneEnabled = table.Column<bool>(type: "boolean", nullable: false),
                    CameraEnabled = table.Column<bool>(type: "boolean", nullable: false),
                    ScreenEnabled = table.Column<bool>(type: "boolean", nullable: false),
                    ConnectionState = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    JoinedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    LastSeenAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_MeetingParticipants", x => x.Id);
                    table.ForeignKey(
                        name: "FK_MeetingParticipants_MeetingRooms_MeetingRoomId",
                        column: x => x.MeetingRoomId,
                        principalTable: "MeetingRooms",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_MeetingParticipants_Users_UserId",
                        column: x => x.UserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateTable(
                name: "MeetingSignals",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    MeetingRoomId = table.Column<Guid>(type: "uuid", nullable: false),
                    SenderClientId = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: false),
                    RecipientClientId = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: false),
                    SignalType = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: false),
                    PayloadJson = table.Column<string>(type: "jsonb", nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_MeetingSignals", x => x.Id);
                    table.ForeignKey(
                        name: "FK_MeetingSignals_MeetingRooms_MeetingRoomId",
                        column: x => x.MeetingRoomId,
                        principalTable: "MeetingRooms",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "MeetingTranscripts",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    MeetingRoomId = table.Column<Guid>(type: "uuid", nullable: false),
                    UserId = table.Column<Guid>(type: "uuid", nullable: true),
                    ClientId = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: false),
                    SpeakerName = table.Column<string>(type: "character varying(180)", maxLength: 180, nullable: false),
                    SourceLanguage = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    Text = table.Column<string>(type: "character varying(20000)", maxLength: 20000, nullable: false),
                    TranslatedText = table.Column<string>(type: "character varying(20000)", maxLength: 20000, nullable: true),
                    IsFinal = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_MeetingTranscripts", x => x.Id);
                    table.ForeignKey(
                        name: "FK_MeetingTranscripts_MeetingRooms_MeetingRoomId",
                        column: x => x.MeetingRoomId,
                        principalTable: "MeetingRooms",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_MeetingTranscripts_Users_UserId",
                        column: x => x.UserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateIndex(
                name: "IX_MeetingChatMessages_MeetingRoomId_CreatedAt",
                table: "MeetingChatMessages",
                columns: new[] { "MeetingRoomId", "CreatedAt" });

            migrationBuilder.CreateIndex(
                name: "IX_MeetingChatMessages_UserId",
                table: "MeetingChatMessages",
                column: "UserId");

            migrationBuilder.CreateIndex(
                name: "IX_MeetingParticipants_MeetingRoomId_ClientId",
                table: "MeetingParticipants",
                columns: new[] { "MeetingRoomId", "ClientId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_MeetingParticipants_UserId",
                table: "MeetingParticipants",
                column: "UserId");

            migrationBuilder.CreateIndex(
                name: "IX_MeetingRooms_CalendarEventId",
                table: "MeetingRooms",
                column: "CalendarEventId");

            migrationBuilder.CreateIndex(
                name: "IX_MeetingRooms_Code",
                table: "MeetingRooms",
                column: "Code",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_MeetingRooms_InviteToken",
                table: "MeetingRooms",
                column: "InviteToken",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_MeetingRooms_ScheduledStartAt",
                table: "MeetingRooms",
                column: "ScheduledStartAt");

            migrationBuilder.CreateIndex(
                name: "IX_MeetingSignals_MeetingRoomId_RecipientClientId_CreatedAt",
                table: "MeetingSignals",
                columns: new[] { "MeetingRoomId", "RecipientClientId", "CreatedAt" });

            migrationBuilder.CreateIndex(
                name: "IX_MeetingTranscripts_MeetingRoomId_CreatedAt",
                table: "MeetingTranscripts",
                columns: new[] { "MeetingRoomId", "CreatedAt" });

            migrationBuilder.CreateIndex(
                name: "IX_MeetingTranscripts_UserId",
                table: "MeetingTranscripts",
                column: "UserId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "MeetingChatMessages");

            migrationBuilder.DropTable(
                name: "MeetingParticipants");

            migrationBuilder.DropTable(
                name: "MeetingSignals");

            migrationBuilder.DropTable(
                name: "MeetingTranscripts");

            migrationBuilder.DropTable(
                name: "MeetingRooms");
        }
    }
}
