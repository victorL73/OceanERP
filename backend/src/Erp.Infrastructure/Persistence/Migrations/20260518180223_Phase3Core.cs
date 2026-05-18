using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Erp.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class Phase3Core : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "ApiClients",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Name = table.Column<string>(type: "character varying(180)", maxLength: 180, nullable: false),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    CreatedByUserId = table.Column<Guid>(type: "uuid", nullable: true),
                    UpdatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    UpdatedByUserId = table.Column<Guid>(type: "uuid", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ApiClients", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "CalendarEvents",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Title = table.Column<string>(type: "character varying(260)", maxLength: 260, nullable: false),
                    Description = table.Column<string>(type: "character varying(4000)", maxLength: 4000, nullable: true),
                    Location = table.Column<string>(type: "character varying(260)", maxLength: 260, nullable: true),
                    StartsAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    EndsAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    IsPrivate = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    CreatedByUserId = table.Column<Guid>(type: "uuid", nullable: true),
                    UpdatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    UpdatedByUserId = table.Column<Guid>(type: "uuid", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CalendarEvents", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "ServiceTickets",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Number = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: false),
                    CustomerId = table.Column<Guid>(type: "uuid", nullable: false),
                    ProductId = table.Column<Guid>(type: "uuid", nullable: true),
                    SalesOrderId = table.Column<Guid>(type: "uuid", nullable: true),
                    Subject = table.Column<string>(type: "character varying(260)", maxLength: 260, nullable: false),
                    Description = table.Column<string>(type: "character varying(4000)", maxLength: 4000, nullable: true),
                    Priority = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    Status = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    CreatedByUserId = table.Column<Guid>(type: "uuid", nullable: true),
                    UpdatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    UpdatedByUserId = table.Column<Guid>(type: "uuid", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ServiceTickets", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ServiceTickets_Customers_CustomerId",
                        column: x => x.CustomerId,
                        principalTable: "Customers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_ServiceTickets_Products_ProductId",
                        column: x => x.ProductId,
                        principalTable: "Products",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_ServiceTickets_SalesOrders_SalesOrderId",
                        column: x => x.SalesOrderId,
                        principalTable: "SalesOrders",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateTable(
                name: "SignatureRequests",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    DriveItemId = table.Column<Guid>(type: "uuid", nullable: false),
                    Title = table.Column<string>(type: "character varying(260)", maxLength: 260, nullable: false),
                    Status = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    ExpiresAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    CompletedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    CreatedByUserId = table.Column<Guid>(type: "uuid", nullable: true),
                    UpdatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    UpdatedByUserId = table.Column<Guid>(type: "uuid", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SignatureRequests", x => x.Id);
                    table.ForeignKey(
                        name: "FK_SignatureRequests_DriveItems_DriveItemId",
                        column: x => x.DriveItemId,
                        principalTable: "DriveItems",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "ApiKeys",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    ApiClientId = table.Column<Guid>(type: "uuid", nullable: false),
                    KeyHash = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ApiKeys", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ApiKeys_ApiClients_ApiClientId",
                        column: x => x.ApiClientId,
                        principalTable: "ApiClients",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "ApiRequestLogs",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    ApiClientId = table.Column<Guid>(type: "uuid", nullable: true),
                    Path = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: false),
                    StatusCode = table.Column<int>(type: "integer", nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ApiRequestLogs", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ApiRequestLogs_ApiClients_ApiClientId",
                        column: x => x.ApiClientId,
                        principalTable: "ApiClients",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateTable(
                name: "CalendarEventLinks",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    CalendarEventId = table.Column<Guid>(type: "uuid", nullable: false),
                    Module = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: false),
                    EntityId = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CalendarEventLinks", x => x.Id);
                    table.ForeignKey(
                        name: "FK_CalendarEventLinks_CalendarEvents_CalendarEventId",
                        column: x => x.CalendarEventId,
                        principalTable: "CalendarEvents",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "CalendarReminders",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    CalendarEventId = table.Column<Guid>(type: "uuid", nullable: false),
                    RemindAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    IsSent = table.Column<bool>(type: "boolean", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CalendarReminders", x => x.Id);
                    table.ForeignKey(
                        name: "FK_CalendarReminders_CalendarEvents_CalendarEventId",
                        column: x => x.CalendarEventId,
                        principalTable: "CalendarEvents",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "ServiceTicketMessages",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    ServiceTicketId = table.Column<Guid>(type: "uuid", nullable: false),
                    AuthorUserId = table.Column<Guid>(type: "uuid", nullable: true),
                    Body = table.Column<string>(type: "character varying(10000)", maxLength: 10000, nullable: false),
                    IsInternal = table.Column<bool>(type: "boolean", nullable: false),
                    AttachmentDriveItemId = table.Column<Guid>(type: "uuid", nullable: true),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ServiceTicketMessages", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ServiceTicketMessages_DriveItems_AttachmentDriveItemId",
                        column: x => x.AttachmentDriveItemId,
                        principalTable: "DriveItems",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_ServiceTicketMessages_ServiceTickets_ServiceTicketId",
                        column: x => x.ServiceTicketId,
                        principalTable: "ServiceTickets",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_ServiceTicketMessages_Users_AuthorUserId",
                        column: x => x.AuthorUserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateTable(
                name: "ServiceTicketStatusHistories",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    ServiceTicketId = table.Column<Guid>(type: "uuid", nullable: false),
                    Status = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    Comment = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    ChangedByUserId = table.Column<Guid>(type: "uuid", nullable: true),
                    ChangedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ServiceTicketStatusHistories", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ServiceTicketStatusHistories_ServiceTickets_ServiceTicketId",
                        column: x => x.ServiceTicketId,
                        principalTable: "ServiceTickets",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_ServiceTicketStatusHistories_Users_ChangedByUserId",
                        column: x => x.ChangedByUserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateTable(
                name: "SignatureRecipients",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    SignatureRequestId = table.Column<Guid>(type: "uuid", nullable: false),
                    Email = table.Column<string>(type: "character varying(320)", maxLength: 320, nullable: false),
                    Name = table.Column<string>(type: "character varying(180)", maxLength: 180, nullable: true),
                    TokenHash = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: false),
                    Status = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    SignedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SignatureRecipients", x => x.Id);
                    table.ForeignKey(
                        name: "FK_SignatureRecipients_SignatureRequests_SignatureRequestId",
                        column: x => x.SignatureRequestId,
                        principalTable: "SignatureRequests",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "SignedDocuments",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    SignatureRequestId = table.Column<Guid>(type: "uuid", nullable: false),
                    FileName = table.Column<string>(type: "character varying(260)", maxLength: 260, nullable: false),
                    MimeType = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: false),
                    Size = table.Column<long>(type: "bigint", nullable: false),
                    StoragePath = table.Column<string>(type: "character varying(1024)", maxLength: 1024, nullable: false),
                    DocumentSha256 = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SignedDocuments", x => x.Id);
                    table.ForeignKey(
                        name: "FK_SignedDocuments_SignatureRequests_SignatureRequestId",
                        column: x => x.SignatureRequestId,
                        principalTable: "SignatureRequests",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "SignatureEvidences",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    SignatureRequestId = table.Column<Guid>(type: "uuid", nullable: false),
                    SignatureRecipientId = table.Column<Guid>(type: "uuid", nullable: true),
                    Action = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: false),
                    DocumentSha256 = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: false),
                    ConditionsAccepted = table.Column<bool>(type: "boolean", nullable: false),
                    SignatureMode = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: true),
                    DrawnSignatureDataUrl = table.Column<string>(type: "text", nullable: true),
                    IpAddress = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: true),
                    UserAgent = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SignatureEvidences", x => x.Id);
                    table.ForeignKey(
                        name: "FK_SignatureEvidences_SignatureRecipients_SignatureRecipientId",
                        column: x => x.SignatureRecipientId,
                        principalTable: "SignatureRecipients",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_SignatureEvidences_SignatureRequests_SignatureRequestId",
                        column: x => x.SignatureRequestId,
                        principalTable: "SignatureRequests",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "SignatureOtps",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    SignatureRecipientId = table.Column<Guid>(type: "uuid", nullable: false),
                    OtpHash = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: false),
                    ExpiresAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    UsedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SignatureOtps", x => x.Id);
                    table.ForeignKey(
                        name: "FK_SignatureOtps_SignatureRecipients_SignatureRecipientId",
                        column: x => x.SignatureRecipientId,
                        principalTable: "SignatureRecipients",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_ApiClients_Name",
                table: "ApiClients",
                column: "Name",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_ApiKeys_ApiClientId",
                table: "ApiKeys",
                column: "ApiClientId");

            migrationBuilder.CreateIndex(
                name: "IX_ApiKeys_KeyHash",
                table: "ApiKeys",
                column: "KeyHash",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_ApiRequestLogs_ApiClientId",
                table: "ApiRequestLogs",
                column: "ApiClientId");

            migrationBuilder.CreateIndex(
                name: "IX_ApiRequestLogs_CreatedAt",
                table: "ApiRequestLogs",
                column: "CreatedAt");

            migrationBuilder.CreateIndex(
                name: "IX_CalendarEventLinks_CalendarEventId",
                table: "CalendarEventLinks",
                column: "CalendarEventId");

            migrationBuilder.CreateIndex(
                name: "IX_CalendarEventLinks_Module_EntityId",
                table: "CalendarEventLinks",
                columns: new[] { "Module", "EntityId" });

            migrationBuilder.CreateIndex(
                name: "IX_CalendarEvents_StartsAt",
                table: "CalendarEvents",
                column: "StartsAt");

            migrationBuilder.CreateIndex(
                name: "IX_CalendarReminders_CalendarEventId_IsSent",
                table: "CalendarReminders",
                columns: new[] { "CalendarEventId", "IsSent" });

            migrationBuilder.CreateIndex(
                name: "IX_ServiceTicketMessages_AttachmentDriveItemId",
                table: "ServiceTicketMessages",
                column: "AttachmentDriveItemId");

            migrationBuilder.CreateIndex(
                name: "IX_ServiceTicketMessages_AuthorUserId",
                table: "ServiceTicketMessages",
                column: "AuthorUserId");

            migrationBuilder.CreateIndex(
                name: "IX_ServiceTicketMessages_ServiceTicketId",
                table: "ServiceTicketMessages",
                column: "ServiceTicketId");

            migrationBuilder.CreateIndex(
                name: "IX_ServiceTickets_CustomerId_Status",
                table: "ServiceTickets",
                columns: new[] { "CustomerId", "Status" });

            migrationBuilder.CreateIndex(
                name: "IX_ServiceTickets_Number",
                table: "ServiceTickets",
                column: "Number",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_ServiceTickets_ProductId",
                table: "ServiceTickets",
                column: "ProductId");

            migrationBuilder.CreateIndex(
                name: "IX_ServiceTickets_SalesOrderId",
                table: "ServiceTickets",
                column: "SalesOrderId");

            migrationBuilder.CreateIndex(
                name: "IX_ServiceTicketStatusHistories_ChangedByUserId",
                table: "ServiceTicketStatusHistories",
                column: "ChangedByUserId");

            migrationBuilder.CreateIndex(
                name: "IX_ServiceTicketStatusHistories_ServiceTicketId",
                table: "ServiceTicketStatusHistories",
                column: "ServiceTicketId");

            migrationBuilder.CreateIndex(
                name: "IX_SignatureEvidences_SignatureRecipientId",
                table: "SignatureEvidences",
                column: "SignatureRecipientId");

            migrationBuilder.CreateIndex(
                name: "IX_SignatureEvidences_SignatureRequestId",
                table: "SignatureEvidences",
                column: "SignatureRequestId");

            migrationBuilder.CreateIndex(
                name: "IX_SignatureOtps_SignatureRecipientId",
                table: "SignatureOtps",
                column: "SignatureRecipientId");

            migrationBuilder.CreateIndex(
                name: "IX_SignatureRecipients_SignatureRequestId",
                table: "SignatureRecipients",
                column: "SignatureRequestId");

            migrationBuilder.CreateIndex(
                name: "IX_SignatureRecipients_TokenHash",
                table: "SignatureRecipients",
                column: "TokenHash",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_SignatureRequests_DriveItemId",
                table: "SignatureRequests",
                column: "DriveItemId");

            migrationBuilder.CreateIndex(
                name: "IX_SignatureRequests_Status",
                table: "SignatureRequests",
                column: "Status");

            migrationBuilder.CreateIndex(
                name: "IX_SignedDocuments_SignatureRequestId",
                table: "SignedDocuments",
                column: "SignatureRequestId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "ApiKeys");

            migrationBuilder.DropTable(
                name: "ApiRequestLogs");

            migrationBuilder.DropTable(
                name: "CalendarEventLinks");

            migrationBuilder.DropTable(
                name: "CalendarReminders");

            migrationBuilder.DropTable(
                name: "ServiceTicketMessages");

            migrationBuilder.DropTable(
                name: "ServiceTicketStatusHistories");

            migrationBuilder.DropTable(
                name: "SignatureEvidences");

            migrationBuilder.DropTable(
                name: "SignatureOtps");

            migrationBuilder.DropTable(
                name: "SignedDocuments");

            migrationBuilder.DropTable(
                name: "ApiClients");

            migrationBuilder.DropTable(
                name: "CalendarEvents");

            migrationBuilder.DropTable(
                name: "ServiceTickets");

            migrationBuilder.DropTable(
                name: "SignatureRecipients");

            migrationBuilder.DropTable(
                name: "SignatureRequests");
        }
    }
}
