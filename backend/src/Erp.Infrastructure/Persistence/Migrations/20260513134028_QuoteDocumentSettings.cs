using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Erp.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class QuoteDocumentSettings : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "QuoteDocumentSettings",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    CompanyName = table.Column<string>(type: "character varying(240)", maxLength: 240, nullable: false),
                    AddressLine1 = table.Column<string>(type: "character varying(240)", maxLength: 240, nullable: true),
                    AddressLine2 = table.Column<string>(type: "character varying(240)", maxLength: 240, nullable: true),
                    PostalCode = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: true),
                    City = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: true),
                    Country = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: true),
                    Phone = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: true),
                    Email = table.Column<string>(type: "character varying(320)", maxLength: 320, nullable: true),
                    Website = table.Column<string>(type: "character varying(240)", maxLength: 240, nullable: true),
                    VatNumber = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: true),
                    Siret = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: true),
                    LegalText = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true),
                    FooterText = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true),
                    LogoStoragePath = table.Column<string>(type: "character varying(1024)", maxLength: 1024, nullable: true),
                    LogoFileName = table.Column<string>(type: "character varying(260)", maxLength: 260, nullable: true),
                    LogoMimeType = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: true),
                    LogoSize = table.Column<long>(type: "bigint", nullable: true),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    CreatedByUserId = table.Column<Guid>(type: "uuid", nullable: true),
                    UpdatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    UpdatedByUserId = table.Column<Guid>(type: "uuid", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_QuoteDocumentSettings", x => x.Id);
                });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "QuoteDocumentSettings");
        }
    }
}
