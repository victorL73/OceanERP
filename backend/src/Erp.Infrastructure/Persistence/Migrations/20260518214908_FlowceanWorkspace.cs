using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Erp.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class FlowceanWorkspace : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "FlowceanWorkspaces",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Slug = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: false),
                    Name = table.Column<string>(type: "character varying(190)", maxLength: 190, nullable: false),
                    OwnerUserId = table.Column<Guid>(type: "uuid", nullable: true),
                    DataJson = table.Column<string>(type: "jsonb", nullable: false),
                    Version = table.Column<int>(type: "integer", nullable: false),
                    IsPersonal = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    CreatedByUserId = table.Column<Guid>(type: "uuid", nullable: true),
                    UpdatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    UpdatedByUserId = table.Column<Guid>(type: "uuid", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_FlowceanWorkspaces", x => x.Id);
                    table.ForeignKey(
                        name: "FK_FlowceanWorkspaces_Users_OwnerUserId",
                        column: x => x.OwnerUserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateTable(
                name: "FlowceanWorkspaceEvents",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    FlowceanWorkspaceId = table.Column<Guid>(type: "uuid", nullable: false),
                    ActorUserId = table.Column<Guid>(type: "uuid", nullable: true),
                    EventType = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: false),
                    PayloadJson = table.Column<string>(type: "jsonb", nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_FlowceanWorkspaceEvents", x => x.Id);
                    table.ForeignKey(
                        name: "FK_FlowceanWorkspaceEvents_FlowceanWorkspaces_FlowceanWorkspac~",
                        column: x => x.FlowceanWorkspaceId,
                        principalTable: "FlowceanWorkspaces",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_FlowceanWorkspaceEvents_Users_ActorUserId",
                        column: x => x.ActorUserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateIndex(
                name: "IX_FlowceanWorkspaceEvents_ActorUserId",
                table: "FlowceanWorkspaceEvents",
                column: "ActorUserId");

            migrationBuilder.CreateIndex(
                name: "IX_FlowceanWorkspaceEvents_FlowceanWorkspaceId_CreatedAt",
                table: "FlowceanWorkspaceEvents",
                columns: new[] { "FlowceanWorkspaceId", "CreatedAt" });

            migrationBuilder.CreateIndex(
                name: "IX_FlowceanWorkspaces_OwnerUserId",
                table: "FlowceanWorkspaces",
                column: "OwnerUserId");

            migrationBuilder.CreateIndex(
                name: "IX_FlowceanWorkspaces_Slug",
                table: "FlowceanWorkspaces",
                column: "Slug",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "FlowceanWorkspaceEvents");

            migrationBuilder.DropTable(
                name: "FlowceanWorkspaces");
        }
    }
}
