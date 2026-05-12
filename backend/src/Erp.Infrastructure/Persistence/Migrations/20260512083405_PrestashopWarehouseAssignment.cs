using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Erp.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class PrestashopWarehouseAssignment : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "WarehouseId",
                table: "PrestashopConnections",
                type: "uuid",
                nullable: true);

            migrationBuilder.Sql("""
                DO $$
                DECLARE
                    legacy_id uuid;
                    target_id uuid;
                BEGIN
                    SELECT "Id" INTO legacy_id
                    FROM "Warehouses"
                    WHERE lower("Name") = lower('PrestaShop')
                    LIMIT 1;

                    SELECT "Id" INTO target_id
                    FROM "Warehouses"
                    WHERE lower("Name") = lower('Entrepot principal')
                    LIMIT 1;

                    IF target_id IS NULL THEN
                        SELECT "Id" INTO target_id
                        FROM "Warehouses"
                        WHERE legacy_id IS NULL OR "Id" <> legacy_id
                        ORDER BY "Name"
                        LIMIT 1;
                    END IF;

                    IF target_id IS NULL AND legacy_id IS NOT NULL THEN
                        UPDATE "Warehouses"
                        SET "Name" = 'Entrepot principal'
                        WHERE "Id" = legacy_id;

                        target_id := legacy_id;
                    END IF;

                    IF target_id IS NOT NULL THEN
                        UPDATE "PrestashopConnections"
                        SET "WarehouseId" = target_id
                        WHERE "WarehouseId" IS NULL;
                    END IF;

                    IF legacy_id IS NOT NULL AND target_id IS NOT NULL AND legacy_id <> target_id THEN
                        UPDATE "StockItems" target_item
                        SET "QuantityOnHand" = target_item."QuantityOnHand" + source_item."QuantityOnHand",
                            "QuantityReserved" = target_item."QuantityReserved" + source_item."QuantityReserved",
                            "AlertThreshold" = GREATEST(target_item."AlertThreshold", source_item."AlertThreshold")
                        FROM "StockItems" source_item
                        WHERE source_item."WarehouseId" = legacy_id
                          AND target_item."WarehouseId" = target_id
                          AND target_item."ProductId" = source_item."ProductId";

                        DELETE FROM "StockItems" source_item
                        USING "StockItems" target_item
                        WHERE source_item."WarehouseId" = legacy_id
                          AND target_item."WarehouseId" = target_id
                          AND target_item."ProductId" = source_item."ProductId";

                        UPDATE "StockItems"
                        SET "WarehouseId" = target_id
                        WHERE "WarehouseId" = legacy_id;

                        UPDATE "StockMovements"
                        SET "WarehouseId" = target_id
                        WHERE "WarehouseId" = legacy_id;

                        UPDATE "SalesOrders"
                        SET "WarehouseId" = target_id
                        WHERE "WarehouseId" = legacy_id;

                        DELETE FROM "Warehouses"
                        WHERE "Id" = legacy_id;
                    END IF;
                END $$;
                """);

            migrationBuilder.CreateIndex(
                name: "IX_PrestashopConnections_WarehouseId",
                table: "PrestashopConnections",
                column: "WarehouseId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_PrestashopConnections_WarehouseId",
                table: "PrestashopConnections");

            migrationBuilder.DropColumn(
                name: "WarehouseId",
                table: "PrestashopConnections");
        }
    }
}
