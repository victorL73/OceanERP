using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Erp.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class PrestashopColissimoConnectionSettings : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "ColissimoBridgeTokenProtectedValue",
                table: "PrestashopConnections",
                type: "character varying(2000)",
                maxLength: 2000,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ColissimoLabelEndpointTemplate",
                table: "PrestashopConnections",
                type: "character varying(2000)",
                maxLength: 2000,
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "ColissimoBridgeTokenProtectedValue",
                table: "PrestashopConnections");

            migrationBuilder.DropColumn(
                name: "ColissimoLabelEndpointTemplate",
                table: "PrestashopConnections");
        }
    }
}
