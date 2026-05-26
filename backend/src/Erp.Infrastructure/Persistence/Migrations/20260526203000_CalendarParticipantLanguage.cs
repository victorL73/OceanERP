using Erp.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Erp.Infrastructure.Persistence.Migrations;

[DbContext(typeof(ErpDbContext))]
[Migration("20260526203000_CalendarParticipantLanguage")]
public partial class CalendarParticipantLanguage : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.AddColumn<string>(
            name: "LanguageCode",
            table: "CalendarParticipants",
            type: "character varying(12)",
            maxLength: 12,
            nullable: false,
            defaultValue: "fr-FR");
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropColumn(
            name: "LanguageCode",
            table: "CalendarParticipants");
    }
}
