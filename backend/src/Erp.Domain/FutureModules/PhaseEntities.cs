using Erp.Domain.Common;

namespace Erp.Domain.FutureModules;

// Phase 2/3 placeholders keep the ubiquitous language explicit without pretending
// that every workflow is production-complete in the MVP.
public sealed class Warehouse : AuditableEntity { public string Name { get; set; } = string.Empty; }
public sealed class StockItem : AuditableEntity { public Guid ProductId { get; set; } public Guid WarehouseId { get; set; } public decimal QuantityOnHand { get; set; } public decimal AlertThreshold { get; set; } }
public sealed class StockMovement : AuditableEntity { public Guid ProductId { get; set; } public Guid WarehouseId { get; set; } public decimal Quantity { get; set; } public string Reason { get; set; } = string.Empty; }
public sealed class SalesOrder : AuditableEntity { public string Number { get; set; } = string.Empty; public Guid CustomerId { get; set; } public string Status { get; set; } = "Draft"; }
public sealed class SalesOrderLine : Entity { public Guid SalesOrderId { get; set; } public string Description { get; set; } = string.Empty; public decimal Quantity { get; set; } public decimal UnitPrice { get; set; } }
public sealed class SalesOrderStatusHistory : Entity { public Guid SalesOrderId { get; set; } public string Status { get; set; } = string.Empty; public DateTimeOffset ChangedAt { get; set; } = DateTimeOffset.UtcNow; }
public sealed class Invoice : AuditableEntity { public string Number { get; set; } = string.Empty; public Guid CustomerId { get; set; } public string Status { get; set; } = "Draft"; }
public sealed class InvoiceLine : Entity { public Guid InvoiceId { get; set; } public string Description { get; set; } = string.Empty; public decimal Quantity { get; set; } public decimal UnitPrice { get; set; } }
public sealed class InvoicePayment : Entity { public Guid InvoiceId { get; set; } public decimal Amount { get; set; } public DateOnly PaidOn { get; set; } }
public sealed class InvoiceDocument : Entity { public Guid InvoiceId { get; set; } public string StoragePath { get; set; } = string.Empty; }
public sealed class InvoiceStatusHistory : Entity { public Guid InvoiceId { get; set; } public string Status { get; set; } = string.Empty; public DateTimeOffset ChangedAt { get; set; } = DateTimeOffset.UtcNow; }
public sealed class Supplier : AuditableEntity { public string Name { get; set; } = string.Empty; }
public sealed class PurchaseOrder : AuditableEntity { public string Number { get; set; } = string.Empty; public Guid SupplierId { get; set; } }
public sealed class PurchaseOrderLine : Entity { public Guid PurchaseOrderId { get; set; } public string Description { get; set; } = string.Empty; public decimal Quantity { get; set; } }
public sealed class SupplierInvoice : AuditableEntity { public string Number { get; set; } = string.Empty; public Guid SupplierId { get; set; } public decimal Total { get; set; } }
public sealed class GoodsReceipt : AuditableEntity { public string Number { get; set; } = string.Empty; public Guid PurchaseOrderId { get; set; } }
public sealed class AccountingEntry : AuditableEntity { public string JournalCode { get; set; } = string.Empty; public decimal Debit { get; set; } public decimal Credit { get; set; } }
public sealed class Payment : AuditableEntity { public decimal Amount { get; set; } public DateOnly PaymentDate { get; set; } }
public sealed class AccountJournal : AuditableEntity { public string Code { get; set; } = string.Empty; public string Name { get; set; } = string.Empty; }
public sealed class ServiceTicket : AuditableEntity { public string Number { get; set; } = string.Empty; public Guid CustomerId { get; set; } public string Status { get; set; } = "Open"; }
public sealed class ServiceTicketMessage : Entity { public Guid ServiceTicketId { get; set; } public string Body { get; set; } = string.Empty; }
public sealed class ServiceTicketStatusHistory : Entity { public Guid ServiceTicketId { get; set; } public string Status { get; set; } = string.Empty; public DateTimeOffset ChangedAt { get; set; } = DateTimeOffset.UtcNow; }
public sealed class MailAccount : AuditableEntity { public string Email { get; set; } = string.Empty; public string SmtpHost { get; set; } = string.Empty; public string ImapHost { get; set; } = string.Empty; }
public sealed class EmailMessage : AuditableEntity { public string Subject { get; set; } = string.Empty; public string From { get; set; } = string.Empty; public string To { get; set; } = string.Empty; }
public sealed class EmailAttachment : Entity { public Guid EmailMessageId { get; set; } public string StoragePath { get; set; } = string.Empty; }
public sealed class EmailLink : Entity { public Guid EmailMessageId { get; set; } public string Module { get; set; } = string.Empty; public Guid EntityId { get; set; } }
public sealed class EmailTemplate : AuditableEntity { public string Name { get; set; } = string.Empty; public string Body { get; set; } = string.Empty; }
public sealed class CalendarEvent : AuditableEntity { public string Title { get; set; } = string.Empty; public DateTimeOffset StartsAt { get; set; } public DateTimeOffset EndsAt { get; set; } }
public sealed class CalendarReminder : Entity { public Guid CalendarEventId { get; set; } public DateTimeOffset RemindAt { get; set; } }
public sealed class CalendarEventLink : Entity { public Guid CalendarEventId { get; set; } public string Module { get; set; } = string.Empty; public Guid EntityId { get; set; } }
public sealed class SignatureRequest : AuditableEntity { public Guid DocumentId { get; set; } public string Status { get; set; } = "Draft"; public DateTimeOffset ExpiresAt { get; set; } }
public sealed class SignatureRecipient : Entity { public Guid SignatureRequestId { get; set; } public string Email { get; set; } = string.Empty; }
public sealed class SignatureOtp : Entity { public Guid SignatureRecipientId { get; set; } public string OtpHash { get; set; } = string.Empty; public DateTimeOffset ExpiresAt { get; set; } }
public sealed class SignatureEvidence : Entity { public Guid SignatureRequestId { get; set; } public string DocumentSha256 { get; set; } = string.Empty; public string? IpAddress { get; set; } public string? UserAgent { get; set; } }
public sealed class SignedDocument : Entity { public Guid SignatureRequestId { get; set; } public string StoragePath { get; set; } = string.Empty; }
public sealed class PrestashopConnection : AuditableEntity { public string ShopUrl { get; set; } = string.Empty; public string ApiKeySecretName { get; set; } = string.Empty; }
public sealed class PrestashopSyncLog : Entity { public Guid PrestashopConnectionId { get; set; } public string Status { get; set; } = string.Empty; public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow; }
public sealed class ExternalReference : Entity { public string Provider { get; set; } = string.Empty; public string ExternalId { get; set; } = string.Empty; public string Module { get; set; } = string.Empty; public Guid EntityId { get; set; } }
public sealed class ApiClient : AuditableEntity { public string Name { get; set; } = string.Empty; public bool IsActive { get; set; } = true; }
public sealed class ApiKey : Entity { public Guid ApiClientId { get; set; } public string KeyHash { get; set; } = string.Empty; public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow; }
public sealed class ApiRequestLog : Entity { public Guid? ApiClientId { get; set; } public string Path { get; set; } = string.Empty; public int StatusCode { get; set; } public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow; }

