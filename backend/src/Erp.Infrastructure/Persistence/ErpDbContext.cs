using Erp.Application.Common;
using Erp.Domain.Auth;
using Erp.Domain.Common;
using Erp.Domain.Customers;
using Erp.Domain.Documents;
using Erp.Domain.FutureModules;
using Erp.Domain.Notifications;
using Erp.Domain.Products;
using Erp.Domain.Quotes;
using Microsoft.EntityFrameworkCore;

namespace Erp.Infrastructure.Persistence;

public sealed class ErpDbContext(DbContextOptions<ErpDbContext> options, ICurrentUserService? currentUser = null) : DbContext(options)
{
    public DbSet<User> Users => Set<User>();
    public DbSet<Role> Roles => Set<Role>();
    public DbSet<Permission> Permissions => Set<Permission>();
    public DbSet<UserRole> UserRoles => Set<UserRole>();
    public DbSet<RefreshToken> RefreshTokens => Set<RefreshToken>();
    public DbSet<AuditLog> AuditLogs => Set<AuditLog>();

    public DbSet<Customer> Customers => Set<Customer>();
    public DbSet<CustomerContact> CustomerContacts => Set<CustomerContact>();
    public DbSet<CustomerAddress> CustomerAddresses => Set<CustomerAddress>();

    public DbSet<Product> Products => Set<Product>();
    public DbSet<ProductCategory> ProductCategories => Set<ProductCategory>();
    public DbSet<ProductBrand> ProductBrands => Set<ProductBrand>();
    public DbSet<ProductSupplier> ProductSuppliers => Set<ProductSupplier>();

    public DbSet<Quote> Quotes => Set<Quote>();
    public DbSet<QuoteLine> QuoteLines => Set<QuoteLine>();
    public DbSet<QuoteDocument> QuoteDocuments => Set<QuoteDocument>();
    public DbSet<QuoteStatusHistory> QuoteStatusHistories => Set<QuoteStatusHistory>();

    public DbSet<DriveFolder> DriveFolders => Set<DriveFolder>();
    public DbSet<DriveItem> DriveItems => Set<DriveItem>();
    public DbSet<DriveFileVersion> DriveFileVersions => Set<DriveFileVersion>();
    public DbSet<DrivePermission> DrivePermissions => Set<DrivePermission>();
    public DbSet<DriveShare> DriveShares => Set<DriveShare>();
    public DbSet<DriveActivityLog> DriveActivityLogs => Set<DriveActivityLog>();
    public DbSet<DocumentLink> DocumentLinks => Set<DocumentLink>();

    public DbSet<Notification> Notifications => Set<Notification>();
    public DbSet<NotificationPreference> NotificationPreferences => Set<NotificationPreference>();

    public DbSet<Warehouse> Warehouses => Set<Warehouse>();
    public DbSet<StockItem> StockItems => Set<StockItem>();
    public DbSet<StockMovement> StockMovements => Set<StockMovement>();
    public DbSet<SalesOrder> SalesOrders => Set<SalesOrder>();
    public DbSet<SalesOrderLine> SalesOrderLines => Set<SalesOrderLine>();
    public DbSet<SalesOrderStatusHistory> SalesOrderStatusHistories => Set<SalesOrderStatusHistory>();
    public DbSet<Invoice> Invoices => Set<Invoice>();
    public DbSet<InvoiceLine> InvoiceLines => Set<InvoiceLine>();
    public DbSet<InvoicePayment> InvoicePayments => Set<InvoicePayment>();
    public DbSet<InvoiceDocument> InvoiceDocuments => Set<InvoiceDocument>();
    public DbSet<InvoiceStatusHistory> InvoiceStatusHistories => Set<InvoiceStatusHistory>();
    public DbSet<PurchaseOrder> PurchaseOrders => Set<PurchaseOrder>();
    public DbSet<PurchaseOrderLine> PurchaseOrderLines => Set<PurchaseOrderLine>();
    public DbSet<PurchaseOrderCharge> PurchaseOrderCharges => Set<PurchaseOrderCharge>();
    public DbSet<MailServerSettings> MailServerSettings => Set<MailServerSettings>();
    public DbSet<MailAccount> MailAccounts => Set<MailAccount>();
    public DbSet<MailAccountAccess> MailAccountAccesses => Set<MailAccountAccess>();
    public DbSet<EmailMessage> EmailMessages => Set<EmailMessage>();
    public DbSet<EmailAttachment> EmailAttachments => Set<EmailAttachment>();
    public DbSet<EmailLink> EmailLinks => Set<EmailLink>();
    public DbSet<EmailTemplate> EmailTemplates => Set<EmailTemplate>();
    public DbSet<EmailDistributionList> EmailDistributionLists => Set<EmailDistributionList>();
    public DbSet<EmailDistributionListMember> EmailDistributionListMembers => Set<EmailDistributionListMember>();
    public DbSet<AiSettings> AiSettings => Set<AiSettings>();
    public DbSet<QuoteDocumentSettings> QuoteDocumentSettings => Set<QuoteDocumentSettings>();
    public DbSet<PrestashopConnection> PrestashopConnections => Set<PrestashopConnection>();
    public DbSet<PrestashopSyncLog> PrestashopSyncLogs => Set<PrestashopSyncLog>();
    public DbSet<ExternalReference> ExternalReferences => Set<ExternalReference>();
    public DbSet<ServiceTicket> ServiceTickets => Set<ServiceTicket>();
    public DbSet<ServiceTicketMessage> ServiceTicketMessages => Set<ServiceTicketMessage>();
    public DbSet<ServiceTicketStatusHistory> ServiceTicketStatusHistories => Set<ServiceTicketStatusHistory>();
    public DbSet<ServiceTicketInitialResponder> ServiceTicketInitialResponders => Set<ServiceTicketInitialResponder>();
    public DbSet<CalendarEvent> CalendarEvents => Set<CalendarEvent>();
    public DbSet<CalendarReminder> CalendarReminders => Set<CalendarReminder>();
    public DbSet<CalendarEventLink> CalendarEventLinks => Set<CalendarEventLink>();
    public DbSet<SignatureRequest> SignatureRequests => Set<SignatureRequest>();
    public DbSet<SignatureRecipient> SignatureRecipients => Set<SignatureRecipient>();
    public DbSet<SignatureOtp> SignatureOtps => Set<SignatureOtp>();
    public DbSet<SignatureEvidence> SignatureEvidences => Set<SignatureEvidence>();
    public DbSet<SignedDocument> SignedDocuments => Set<SignedDocument>();
    public DbSet<ApiClient> ApiClients => Set<ApiClient>();
    public DbSet<ApiKey> ApiKeys => Set<ApiKey>();
    public DbSet<ApiRequestLog> ApiRequestLogs => Set<ApiRequestLog>();
    public DbSet<FlowceanWorkspace> FlowceanWorkspaces => Set<FlowceanWorkspace>();
    public DbSet<FlowceanWorkspaceMember> FlowceanWorkspaceMembers => Set<FlowceanWorkspaceMember>();
    public DbSet<FlowceanWorkspaceEvent> FlowceanWorkspaceEvents => Set<FlowceanWorkspaceEvent>();
    public DbSet<MeetingRoom> MeetingRooms => Set<MeetingRoom>();
    public DbSet<MeetingParticipant> MeetingParticipants => Set<MeetingParticipant>();
    public DbSet<MeetingSignal> MeetingSignals => Set<MeetingSignal>();
    public DbSet<MeetingTranscript> MeetingTranscripts => Set<MeetingTranscript>();
    public DbSet<MeetingChatMessage> MeetingChatMessages => Set<MeetingChatMessage>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        modelBuilder.Entity<User>(entity =>
        {
            entity.HasIndex(x => x.Email).IsUnique();
            entity.Property(x => x.Email).HasMaxLength(320);
            entity.Property(x => x.DisplayName).HasMaxLength(160);
            entity.Property(x => x.PasswordHash).HasMaxLength(1024);
        });

        modelBuilder.Entity<Role>(entity =>
        {
            entity.HasIndex(x => x.Name).IsUnique();
            entity.Property(x => x.Name).HasMaxLength(120);
            entity.Property(x => x.Description).HasMaxLength(300);
            entity.HasMany(x => x.Permissions).WithMany(x => x.Roles);
        });

        modelBuilder.Entity<Permission>(entity =>
        {
            entity.HasIndex(x => x.Code).IsUnique();
            entity.Property(x => x.Module).HasMaxLength(80);
            entity.Property(x => x.Action).HasMaxLength(80);
            entity.Property(x => x.Code).HasMaxLength(180);
        });

        modelBuilder.Entity<UserRole>(entity =>
        {
            entity.HasKey(x => new { x.UserId, x.RoleId });
            entity.HasOne(x => x.User).WithMany(x => x.UserRoles).HasForeignKey(x => x.UserId);
            entity.HasOne(x => x.Role).WithMany(x => x.UserRoles).HasForeignKey(x => x.RoleId);
        });

        modelBuilder.Entity<RefreshToken>(entity =>
        {
            entity.HasIndex(x => x.TokenHash).IsUnique();
            entity.Property(x => x.TokenHash).HasMaxLength(128);
            entity.Property(x => x.ReplacedByTokenHash).HasMaxLength(128);
        });

        modelBuilder.Entity<AuditLog>(entity =>
        {
            entity.HasIndex(x => x.CreatedAt);
            entity.Property(x => x.Action).HasMaxLength(120);
            entity.Property(x => x.EntityName).HasMaxLength(120);
        });

        modelBuilder.Entity<Customer>(entity =>
        {
            entity.HasIndex(x => x.Code).IsUnique();
            entity.Property(x => x.Code).HasMaxLength(60);
            entity.Property(x => x.CompanyName).HasMaxLength(240);
            entity.Property(x => x.LegalName).HasMaxLength(240);
            entity.Property(x => x.TradeName).HasMaxLength(240);
            entity.Property(x => x.SirenNumber).HasMaxLength(20);
            entity.Property(x => x.SiretNumber).HasMaxLength(20);
            entity.Property(x => x.VatNumber).HasMaxLength(80);
            entity.Property(x => x.Email).HasMaxLength(320);
            entity.Property(x => x.Phone).HasMaxLength(80);
            entity.Property(x => x.MobilePhone).HasMaxLength(80);
            entity.Property(x => x.Website).HasMaxLength(500);
            entity.Property(x => x.Industry).HasMaxLength(160);
            entity.Property(x => x.CustomerType).HasMaxLength(80);
            entity.Property(x => x.Source).HasMaxLength(120);
            entity.Property(x => x.AccountingCode).HasMaxLength(80);
            entity.Property(x => x.PaymentTerms).HasMaxLength(160);
            entity.Property(x => x.DefaultDiscountRate).HasPrecision(5, 2);
        });

        modelBuilder.Entity<CustomerContact>(entity =>
        {
            entity.Property(x => x.FirstName).HasMaxLength(120);
            entity.Property(x => x.LastName).HasMaxLength(120);
            entity.Property(x => x.Email).HasMaxLength(320);
        });

        modelBuilder.Entity<CustomerAddress>(entity =>
        {
            entity.Property(x => x.Label).HasMaxLength(80);
            entity.Property(x => x.Line1).HasMaxLength(240);
            entity.Property(x => x.Line2).HasMaxLength(240);
            entity.Property(x => x.PostalCode).HasMaxLength(40);
            entity.Property(x => x.City).HasMaxLength(120);
            entity.Property(x => x.Country).HasMaxLength(120);
        });

        modelBuilder.Entity<ProductCategory>(entity =>
        {
            entity.HasIndex(x => x.Name).IsUnique();
            entity.Property(x => x.Name).HasMaxLength(160);
        });

        modelBuilder.Entity<ProductBrand>(entity =>
        {
            entity.HasIndex(x => x.Name).IsUnique();
            entity.Property(x => x.Name).HasMaxLength(200);
        });

        modelBuilder.Entity<ProductSupplier>(entity =>
        {
            entity.HasIndex(x => x.Name).IsUnique();
            entity.Property(x => x.Name).HasMaxLength(200);
            entity.Property(x => x.Email).HasMaxLength(320);
        });

        modelBuilder.Entity<Product>(entity =>
        {
            entity.HasIndex(x => x.Reference).IsUnique();
            entity.Property(x => x.Reference).HasMaxLength(80);
            entity.Property(x => x.Name).HasMaxLength(240);
            entity.Property(x => x.ImageUrl).HasMaxLength(1000);
            entity.Property(x => x.PurchasePrice).HasPrecision(18, 2);
            entity.Property(x => x.SalePrice).HasPrecision(18, 2);
            entity.Property(x => x.VatRate).HasPrecision(5, 2);
        });

        modelBuilder.Entity<Quote>(entity =>
        {
            entity.HasIndex(x => x.Number).IsUnique();
            entity.Property(x => x.Number).HasMaxLength(80);
            entity.Property(x => x.Status).HasConversion<string>().HasMaxLength(40);
            entity.Property(x => x.Subtotal).HasPrecision(18, 2);
            entity.Property(x => x.VatTotal).HasPrecision(18, 2);
            entity.Property(x => x.Total).HasPrecision(18, 2);
            entity.Property(x => x.Currency).HasMaxLength(3);
        });

        modelBuilder.Entity<QuoteLine>(entity =>
        {
            entity.Property(x => x.Description).HasMaxLength(500);
            entity.Property(x => x.Quantity).HasPrecision(18, 3);
            entity.Property(x => x.UnitPrice).HasPrecision(18, 2);
            entity.Property(x => x.DiscountRate).HasPrecision(5, 2);
            entity.Property(x => x.VatRate).HasPrecision(5, 2);
            entity.Property(x => x.LineNetTotal).HasPrecision(18, 2);
            entity.Property(x => x.LineVatTotal).HasPrecision(18, 2);
            entity.Property(x => x.LineTotal).HasPrecision(18, 2);
        });

        modelBuilder.Entity<QuoteStatusHistory>(entity =>
        {
            entity.Property(x => x.Status).HasConversion<string>().HasMaxLength(40);
        });

        modelBuilder.Entity<QuoteDocument>(entity =>
        {
            entity.Property(x => x.FileName).HasMaxLength(260);
            entity.Property(x => x.MimeType).HasMaxLength(120);
            entity.Property(x => x.StoragePath).HasMaxLength(1024);
        });

        modelBuilder.Entity<DriveFolder>(entity =>
        {
            entity.Property(x => x.Name).HasMaxLength(260);
            entity.HasOne(x => x.ParentFolder).WithMany(x => x.Children).HasForeignKey(x => x.ParentFolderId).OnDelete(DeleteBehavior.Restrict);
        });

        modelBuilder.Entity<DriveItem>(entity =>
        {
            entity.Property(x => x.Name).HasMaxLength(260);
            entity.Property(x => x.MimeType).HasMaxLength(120);
            entity.Property(x => x.StoragePath).HasMaxLength(1024);
        });

        modelBuilder.Entity<DriveFileVersion>(entity =>
        {
            entity.HasIndex(x => new { x.DriveItemId, x.Version }).IsUnique();
            entity.Property(x => x.StoragePath).HasMaxLength(1024);
            entity.Property(x => x.Sha256).HasMaxLength(128);
        });

        modelBuilder.Entity<DocumentLink>(entity =>
        {
            entity.HasIndex(x => new { x.Module, x.EntityId });
            entity.Property(x => x.Module).HasMaxLength(80);
        });

        modelBuilder.Entity<Notification>(entity =>
        {
            entity.HasIndex(x => new { x.UserId, x.IsRead });
            entity.Property(x => x.Type).HasMaxLength(120);
            entity.Property(x => x.Title).HasMaxLength(180);
        });

        modelBuilder.Entity<NotificationPreference>(entity =>
        {
            entity.HasIndex(x => new { x.UserId, x.NotificationType }).IsUnique();
            entity.Property(x => x.NotificationType).HasMaxLength(120);
        });

        modelBuilder.Entity<Warehouse>(entity =>
        {
            entity.Property(x => x.Name).HasMaxLength(160);
            entity.Property(x => x.AddressLine1).HasMaxLength(240);
            entity.Property(x => x.AddressLine2).HasMaxLength(240);
            entity.Property(x => x.PostalCode).HasMaxLength(40);
            entity.Property(x => x.City).HasMaxLength(120);
            entity.Property(x => x.Country).HasMaxLength(120);
            entity.Property(x => x.RepresentativeName).HasMaxLength(160);
            entity.Property(x => x.Phone).HasMaxLength(80);
            entity.Property(x => x.Email).HasMaxLength(320);
            entity.Property(x => x.Notes).HasMaxLength(1000);
            entity.HasIndex(x => x.Name).IsUnique();
        });

        modelBuilder.Entity<StockItem>(entity =>
        {
            entity.HasIndex(x => new { x.ProductId, x.WarehouseId }).IsUnique();
            entity.Property(x => x.QuantityOnHand).HasPrecision(18, 3);
            entity.Property(x => x.QuantityReserved).HasPrecision(18, 3);
            entity.Property(x => x.AlertThreshold).HasPrecision(18, 3);
        });

        modelBuilder.Entity<StockMovement>(entity =>
        {
            entity.Property(x => x.Quantity).HasPrecision(18, 3);
            entity.Property(x => x.Type).HasMaxLength(80);
            entity.Property(x => x.Reason).HasMaxLength(240);
            entity.Property(x => x.ReferenceModule).HasMaxLength(80);
        });

        modelBuilder.Entity<SalesOrder>(entity =>
        {
            entity.HasIndex(x => x.Number).IsUnique();
            entity.HasIndex(x => x.CustomerId);
            entity.HasIndex(x => x.WarehouseId);
            entity.Property(x => x.Number).HasMaxLength(80);
            entity.Property(x => x.Status).HasMaxLength(40);
            entity.Property(x => x.ExternalStatusName).HasMaxLength(160);
            entity.Property(x => x.PaymentMethod).HasMaxLength(160);
            entity.Property(x => x.PaymentModule).HasMaxLength(120);
            entity.Property(x => x.PaidTotal).HasPrecision(18, 2);
            entity.Property(x => x.ProductsTotal).HasPrecision(18, 2);
            entity.Property(x => x.ShippingTotal).HasPrecision(18, 2);
            entity.Property(x => x.ShippingWeightKg).HasPrecision(18, 3);
            entity.Property(x => x.InvoiceReference).HasMaxLength(80);
            entity.Property(x => x.ShippingServiceName).HasMaxLength(180);
            entity.Property(x => x.ShippingCarrierName).HasMaxLength(160);
            entity.Property(x => x.ShippingTrackingNumber).HasMaxLength(120);
            entity.Property(x => x.ShippingAddressName).HasMaxLength(220);
            entity.Property(x => x.ShippingAddressLine1).HasMaxLength(240);
            entity.Property(x => x.ShippingAddressLine2).HasMaxLength(240);
            entity.Property(x => x.ShippingPostalCode).HasMaxLength(40);
            entity.Property(x => x.ShippingCity).HasMaxLength(160);
            entity.Property(x => x.ShippingCountry).HasMaxLength(120);
            entity.Property(x => x.ShippingPhone).HasMaxLength(80);
            entity.Property(x => x.ShippingEmail).HasMaxLength(220);
        });

        modelBuilder.Entity<SalesOrderLine>(entity =>
        {
            entity.Property(x => x.Description).HasMaxLength(500);
            entity.Property(x => x.Quantity).HasPrecision(18, 3);
            entity.Property(x => x.UnitPrice).HasPrecision(18, 2);
        });

        modelBuilder.Entity<Invoice>(entity =>
        {
            entity.HasIndex(x => x.Number).IsUnique();
            entity.HasIndex(x => x.SalesOrderId).IsUnique().HasFilter("\"SalesOrderId\" IS NOT NULL AND \"Kind\" = 'Invoice'");
            entity.HasIndex(x => x.CreditOfInvoiceId);
            entity.Property(x => x.Number).HasMaxLength(80);
            entity.Property(x => x.Kind).HasMaxLength(40);
            entity.Property(x => x.Status).HasMaxLength(40);
            entity.Property(x => x.FacturXProfile).HasMaxLength(80);
        });

        modelBuilder.Entity<InvoiceLine>(entity =>
        {
            entity.Property(x => x.Description).HasMaxLength(500);
            entity.Property(x => x.Quantity).HasPrecision(18, 3);
            entity.Property(x => x.UnitPrice).HasPrecision(18, 2);
        });

        modelBuilder.Entity<InvoicePayment>(entity =>
        {
            entity.Property(x => x.Amount).HasPrecision(18, 2);
        });

        modelBuilder.Entity<InvoiceDocument>(entity =>
        {
            entity.Property(x => x.FileName).HasMaxLength(260);
            entity.Property(x => x.MimeType).HasMaxLength(120);
            entity.Property(x => x.StoragePath).HasMaxLength(1024);
        });

        modelBuilder.Entity<PurchaseOrder>(entity =>
        {
            entity.HasIndex(x => x.Number).IsUnique();
            entity.HasIndex(x => x.SupplierId);
            entity.HasIndex(x => x.WarehouseId);
            entity.Property(x => x.Number).HasMaxLength(80);
            entity.Property(x => x.Status).HasMaxLength(40);
            entity.Property(x => x.Comment).HasMaxLength(2000);
            entity.HasOne<ProductSupplier>().WithMany().HasForeignKey(x => x.SupplierId).OnDelete(DeleteBehavior.Restrict);
            entity.HasOne<Warehouse>().WithMany().HasForeignKey(x => x.WarehouseId).OnDelete(DeleteBehavior.Restrict);
        });

        modelBuilder.Entity<PurchaseOrderLine>(entity =>
        {
            entity.Property(x => x.Description).HasMaxLength(500);
            entity.Property(x => x.Quantity).HasPrecision(18, 3);
            entity.Property(x => x.UnitPrice).HasPrecision(18, 2);
            entity.Property(x => x.VatRate).HasPrecision(5, 2);
            entity.Property(x => x.ReceivedQuantity).HasPrecision(18, 3);
            entity.HasOne<PurchaseOrder>().WithMany().HasForeignKey(x => x.PurchaseOrderId).OnDelete(DeleteBehavior.Cascade);
            entity.HasOne<Product>().WithMany().HasForeignKey(x => x.ProductId).OnDelete(DeleteBehavior.Restrict);
        });

        modelBuilder.Entity<PurchaseOrderCharge>(entity =>
        {
            entity.Property(x => x.Label).HasMaxLength(160);
            entity.Property(x => x.Amount).HasPrecision(18, 2);
            entity.Property(x => x.VatRate).HasPrecision(5, 2);
            entity.HasOne<PurchaseOrder>().WithMany().HasForeignKey(x => x.PurchaseOrderId).OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<MailAccount>(entity =>
        {
            entity.HasIndex(x => x.Email);
            entity.Property(x => x.Email).HasMaxLength(320);
            entity.Property(x => x.DisplayName).HasMaxLength(160);
            entity.Property(x => x.SignatureHtml).HasMaxLength(10000);
            entity.Property(x => x.SmtpHost).HasMaxLength(240);
            entity.Property(x => x.ImapHost).HasMaxLength(240);
            entity.Property(x => x.UserName).HasMaxLength(320);
            entity.Property(x => x.PasswordSecretName).HasMaxLength(160);
            entity.Property(x => x.PasswordProtectedValue).HasMaxLength(2000);
        });

        modelBuilder.Entity<MailServerSettings>(entity =>
        {
            entity.Property(x => x.SmtpHost).HasMaxLength(240);
            entity.Property(x => x.ImapHost).HasMaxLength(240);
            entity.Property(x => x.ImapSyncIntervalMinutes).HasDefaultValue(5);
            entity.Property(x => x.ImapAutoSyncEnabled).HasDefaultValue(true);
        });

        modelBuilder.Entity<MailAccountAccess>(entity =>
        {
            entity.HasKey(x => new { x.MailAccountId, x.UserId });
            entity.HasIndex(x => x.UserId);
            entity.HasOne<MailAccount>().WithMany(x => x.Accesses).HasForeignKey(x => x.MailAccountId).OnDelete(DeleteBehavior.Cascade);
            entity.HasOne<User>().WithMany().HasForeignKey(x => x.UserId).OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<EmailMessage>(entity =>
        {
            entity.HasIndex(x => new { x.MailAccountId, x.ExternalMessageId });
            entity.HasIndex(x => new { x.MailAccountId, x.IsDeleted });
            entity.Property(x => x.Subject).HasMaxLength(300);
            entity.Property(x => x.From).HasMaxLength(320);
            entity.Property(x => x.To).HasMaxLength(1000);
            entity.Property(x => x.Cc).HasMaxLength(1000);
            entity.Property(x => x.Bcc).HasMaxLength(1000);
            entity.Property(x => x.ExternalMessageId).HasMaxLength(512);
            entity.Property(x => x.Direction).HasMaxLength(40);
            entity.Property(x => x.Status).HasMaxLength(80);
            entity.Property(x => x.ErrorMessage).HasMaxLength(1000);
        });

        modelBuilder.Entity<EmailAttachment>(entity =>
        {
            entity.Property(x => x.FileName).HasMaxLength(260);
            entity.Property(x => x.MimeType).HasMaxLength(120);
            entity.Property(x => x.StoragePath).HasMaxLength(1024);
        });

        modelBuilder.Entity<EmailLink>(entity =>
        {
            entity.HasIndex(x => new { x.Module, x.EntityId });
            entity.Property(x => x.Module).HasMaxLength(80);
        });

        modelBuilder.Entity<EmailTemplate>(entity =>
        {
            entity.Property(x => x.Name).HasMaxLength(160);
            entity.Property(x => x.Subject).HasMaxLength(300);
        });

        modelBuilder.Entity<EmailDistributionList>(entity =>
        {
            entity.HasIndex(x => x.Name).IsUnique();
            entity.Property(x => x.Name).HasMaxLength(160);
            entity.Property(x => x.Description).HasMaxLength(1000);
        });

        modelBuilder.Entity<EmailDistributionListMember>(entity =>
        {
            entity.HasIndex(x => new { x.EmailDistributionListId, x.Email }).IsUnique();
            entity.Property(x => x.Name).HasMaxLength(160);
            entity.Property(x => x.Email).HasMaxLength(320);
            entity.HasOne<EmailDistributionList>().WithMany(x => x.Members).HasForeignKey(x => x.EmailDistributionListId).OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<AiSettings>(entity =>
        {
            entity.Property(x => x.Provider).HasMaxLength(80);
            entity.Property(x => x.EndpointUrl).HasMaxLength(500);
            entity.Property(x => x.Model).HasMaxLength(160);
            entity.Property(x => x.ApiKeySecretName).HasMaxLength(160);
            entity.Property(x => x.ApiKeyProtectedValue).HasMaxLength(2000);
            entity.Property(x => x.Temperature).HasPrecision(4, 2);
            entity.Property(x => x.SystemPrompt).HasMaxLength(8000);
        });

        modelBuilder.Entity<QuoteDocumentSettings>(entity =>
        {
            entity.Property(x => x.CompanyName).HasMaxLength(240);
            entity.Property(x => x.AddressLine1).HasMaxLength(240);
            entity.Property(x => x.AddressLine2).HasMaxLength(240);
            entity.Property(x => x.PostalCode).HasMaxLength(40);
            entity.Property(x => x.City).HasMaxLength(120);
            entity.Property(x => x.Country).HasMaxLength(120);
            entity.Property(x => x.Phone).HasMaxLength(80);
            entity.Property(x => x.Email).HasMaxLength(320);
            entity.Property(x => x.Website).HasMaxLength(240);
            entity.Property(x => x.VatNumber).HasMaxLength(80);
            entity.Property(x => x.Siret).HasMaxLength(80);
            entity.Property(x => x.LegalText).HasMaxLength(2000);
            entity.Property(x => x.FooterText).HasMaxLength(2000);
            entity.Property(x => x.LogoStoragePath).HasMaxLength(1024);
            entity.Property(x => x.LogoFileName).HasMaxLength(260);
            entity.Property(x => x.LogoMimeType).HasMaxLength(120);
        });

        modelBuilder.Entity<PrestashopConnection>(entity =>
        {
            entity.Property(x => x.ShopUrl).HasMaxLength(500);
            entity.Property(x => x.ApiKeySecretName).HasMaxLength(160);
            entity.Property(x => x.ApiKeyProtectedValue).HasMaxLength(2000);
            entity.Property(x => x.ColissimoLabelEndpointTemplate).HasMaxLength(2000);
            entity.Property(x => x.ColissimoBridgeTokenProtectedValue).HasMaxLength(2000);
            entity.HasIndex(x => x.WarehouseId);
        });

        modelBuilder.Entity<PrestashopSyncLog>(entity =>
        {
            entity.Property(x => x.Status).HasMaxLength(120);
            entity.Property(x => x.Message).HasMaxLength(1000);
        });

        modelBuilder.Entity<ExternalReference>(entity =>
        {
            entity.HasIndex(x => new { x.Provider, x.ExternalId }).IsUnique();
            entity.Property(x => x.Provider).HasMaxLength(80);
            entity.Property(x => x.ExternalId).HasMaxLength(160);
            entity.Property(x => x.Module).HasMaxLength(80);
        });

        modelBuilder.Entity<ServiceTicket>(entity =>
        {
            entity.HasIndex(x => x.Number).IsUnique();
            entity.HasIndex(x => new { x.CustomerId, x.Status });
            entity.HasIndex(x => x.AssignedUserId);
            entity.Property(x => x.Number).HasMaxLength(80);
            entity.Property(x => x.Subject).HasMaxLength(260);
            entity.Property(x => x.Description).HasMaxLength(4000);
            entity.Property(x => x.Priority).HasMaxLength(40);
            entity.Property(x => x.Status).HasMaxLength(40);
            entity.HasOne<Customer>().WithMany().HasForeignKey(x => x.CustomerId).OnDelete(DeleteBehavior.Restrict);
            entity.HasOne<Product>().WithMany().HasForeignKey(x => x.ProductId).OnDelete(DeleteBehavior.SetNull);
            entity.HasOne<SalesOrder>().WithMany().HasForeignKey(x => x.SalesOrderId).OnDelete(DeleteBehavior.SetNull);
            entity.HasOne<User>().WithMany().HasForeignKey(x => x.AssignedUserId).OnDelete(DeleteBehavior.SetNull);
        });

        modelBuilder.Entity<ServiceTicketInitialResponder>(entity =>
        {
            entity.HasIndex(x => x.UserId).IsUnique();
            entity.HasOne<User>().WithMany().HasForeignKey(x => x.UserId).OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<ServiceTicketMessage>(entity =>
        {
            entity.HasIndex(x => x.ServiceTicketId);
            entity.Property(x => x.Body).HasMaxLength(10000);
            entity.HasOne<ServiceTicket>().WithMany().HasForeignKey(x => x.ServiceTicketId).OnDelete(DeleteBehavior.Cascade);
            entity.HasOne<User>().WithMany().HasForeignKey(x => x.AuthorUserId).OnDelete(DeleteBehavior.SetNull);
            entity.HasOne<DriveItem>().WithMany().HasForeignKey(x => x.AttachmentDriveItemId).OnDelete(DeleteBehavior.SetNull);
        });

        modelBuilder.Entity<ServiceTicketStatusHistory>(entity =>
        {
            entity.HasIndex(x => x.ServiceTicketId);
            entity.Property(x => x.Status).HasMaxLength(40);
            entity.Property(x => x.Comment).HasMaxLength(1000);
            entity.HasOne<ServiceTicket>().WithMany().HasForeignKey(x => x.ServiceTicketId).OnDelete(DeleteBehavior.Cascade);
            entity.HasOne<User>().WithMany().HasForeignKey(x => x.ChangedByUserId).OnDelete(DeleteBehavior.SetNull);
        });

        modelBuilder.Entity<CalendarEvent>(entity =>
        {
            entity.HasIndex(x => x.StartsAt);
            entity.Property(x => x.Title).HasMaxLength(260);
            entity.Property(x => x.Description).HasMaxLength(4000);
            entity.Property(x => x.Location).HasMaxLength(260);
        });

        modelBuilder.Entity<CalendarReminder>(entity =>
        {
            entity.HasIndex(x => new { x.CalendarEventId, x.IsSent });
            entity.HasOne<CalendarEvent>().WithMany().HasForeignKey(x => x.CalendarEventId).OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<CalendarEventLink>(entity =>
        {
            entity.HasIndex(x => new { x.Module, x.EntityId });
            entity.Property(x => x.Module).HasMaxLength(80);
            entity.HasOne<CalendarEvent>().WithMany().HasForeignKey(x => x.CalendarEventId).OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<SignatureRequest>(entity =>
        {
            entity.HasIndex(x => x.Status);
            entity.Property(x => x.Title).HasMaxLength(260);
            entity.Property(x => x.Status).HasMaxLength(40);
            entity.HasOne<DriveItem>().WithMany().HasForeignKey(x => x.DriveItemId).OnDelete(DeleteBehavior.Restrict);
        });

        modelBuilder.Entity<SignatureRecipient>(entity =>
        {
            entity.HasIndex(x => x.TokenHash).IsUnique();
            entity.Property(x => x.Email).HasMaxLength(320);
            entity.Property(x => x.Name).HasMaxLength(180);
            entity.Property(x => x.TokenHash).HasMaxLength(128);
            entity.Property(x => x.Status).HasMaxLength(40);
            entity.HasOne<SignatureRequest>().WithMany().HasForeignKey(x => x.SignatureRequestId).OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<SignatureOtp>(entity =>
        {
            entity.Property(x => x.OtpHash).HasMaxLength(128);
            entity.HasOne<SignatureRecipient>().WithMany().HasForeignKey(x => x.SignatureRecipientId).OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<SignatureEvidence>(entity =>
        {
            entity.HasIndex(x => x.SignatureRequestId);
            entity.Property(x => x.Action).HasMaxLength(80);
            entity.Property(x => x.DocumentSha256).HasMaxLength(128);
            entity.Property(x => x.SignatureMode).HasMaxLength(40);
            entity.Property(x => x.IpAddress).HasMaxLength(80);
            entity.Property(x => x.UserAgent).HasMaxLength(1000);
            entity.HasOne<SignatureRequest>().WithMany().HasForeignKey(x => x.SignatureRequestId).OnDelete(DeleteBehavior.Cascade);
            entity.HasOne<SignatureRecipient>().WithMany().HasForeignKey(x => x.SignatureRecipientId).OnDelete(DeleteBehavior.SetNull);
        });

        modelBuilder.Entity<SignedDocument>(entity =>
        {
            entity.HasIndex(x => x.SignatureRequestId);
            entity.Property(x => x.FileName).HasMaxLength(260);
            entity.Property(x => x.MimeType).HasMaxLength(120);
            entity.Property(x => x.StoragePath).HasMaxLength(1024);
            entity.Property(x => x.DocumentSha256).HasMaxLength(128);
            entity.HasOne<SignatureRequest>().WithMany().HasForeignKey(x => x.SignatureRequestId).OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<ApiClient>(entity =>
        {
            entity.HasIndex(x => x.Name).IsUnique();
            entity.Property(x => x.Name).HasMaxLength(180);
        });

        modelBuilder.Entity<ApiKey>(entity =>
        {
            entity.HasIndex(x => x.KeyHash).IsUnique();
            entity.Property(x => x.KeyHash).HasMaxLength(128);
            entity.HasOne<ApiClient>().WithMany().HasForeignKey(x => x.ApiClientId).OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<ApiRequestLog>(entity =>
        {
            entity.HasIndex(x => x.CreatedAt);
            entity.Property(x => x.Path).HasMaxLength(1000);
            entity.HasOne<ApiClient>().WithMany().HasForeignKey(x => x.ApiClientId).OnDelete(DeleteBehavior.SetNull);
        });

        modelBuilder.Entity<FlowceanWorkspace>(entity =>
        {
            entity.HasIndex(x => x.Slug).IsUnique();
            entity.Property(x => x.Slug).HasMaxLength(120);
            entity.Property(x => x.Name).HasMaxLength(190);
            entity.Property(x => x.DataJson).HasColumnType("jsonb");
            entity.HasOne<User>().WithMany().HasForeignKey(x => x.OwnerUserId).OnDelete(DeleteBehavior.SetNull);
        });

        modelBuilder.Entity<FlowceanWorkspaceMember>(entity =>
        {
            entity.HasIndex(x => new { x.FlowceanWorkspaceId, x.UserId }).IsUnique();
            entity.HasIndex(x => x.UserId);
            entity.Property(x => x.Role).HasMaxLength(32);
            entity.HasOne<FlowceanWorkspace>().WithMany().HasForeignKey(x => x.FlowceanWorkspaceId).OnDelete(DeleteBehavior.Cascade);
            entity.HasOne<User>().WithMany().HasForeignKey(x => x.UserId).OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<FlowceanWorkspaceEvent>(entity =>
        {
            entity.HasIndex(x => new { x.FlowceanWorkspaceId, x.CreatedAt });
            entity.Property(x => x.EventType).HasMaxLength(80);
            entity.Property(x => x.PayloadJson).HasColumnType("jsonb");
            entity.HasOne<FlowceanWorkspace>().WithMany().HasForeignKey(x => x.FlowceanWorkspaceId).OnDelete(DeleteBehavior.Cascade);
            entity.HasOne<User>().WithMany().HasForeignKey(x => x.ActorUserId).OnDelete(DeleteBehavior.SetNull);
        });

        modelBuilder.Entity<MeetingRoom>(entity =>
        {
            entity.HasIndex(x => x.Code).IsUnique();
            entity.HasIndex(x => x.InviteToken).IsUnique();
            entity.HasIndex(x => x.CalendarEventId);
            entity.HasIndex(x => x.ScheduledStartAt);
            entity.Property(x => x.Code).HasMaxLength(40);
            entity.Property(x => x.Title).HasMaxLength(260);
            entity.Property(x => x.InviteToken).HasMaxLength(120);
            entity.HasOne<CalendarEvent>().WithMany().HasForeignKey(x => x.CalendarEventId).OnDelete(DeleteBehavior.SetNull);
        });

        modelBuilder.Entity<MeetingParticipant>(entity =>
        {
            entity.HasIndex(x => new { x.MeetingRoomId, x.ClientId }).IsUnique();
            entity.HasIndex(x => x.UserId);
            entity.Property(x => x.ClientId).HasMaxLength(120);
            entity.Property(x => x.DisplayName).HasMaxLength(180);
            entity.Property(x => x.SourceLanguage).HasMaxLength(20);
            entity.Property(x => x.TargetLanguage).HasMaxLength(20);
            entity.Property(x => x.ConnectionState).HasMaxLength(40);
            entity.HasOne<MeetingRoom>().WithMany().HasForeignKey(x => x.MeetingRoomId).OnDelete(DeleteBehavior.Cascade);
            entity.HasOne<User>().WithMany().HasForeignKey(x => x.UserId).OnDelete(DeleteBehavior.SetNull);
        });

        modelBuilder.Entity<MeetingSignal>(entity =>
        {
            entity.HasIndex(x => new { x.MeetingRoomId, x.RecipientClientId, x.CreatedAt });
            entity.Property(x => x.SenderClientId).HasMaxLength(120);
            entity.Property(x => x.RecipientClientId).HasMaxLength(120);
            entity.Property(x => x.SignalType).HasMaxLength(80);
            entity.Property(x => x.PayloadJson).HasColumnType("jsonb");
            entity.HasOne<MeetingRoom>().WithMany().HasForeignKey(x => x.MeetingRoomId).OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<MeetingTranscript>(entity =>
        {
            entity.HasIndex(x => new { x.MeetingRoomId, x.CreatedAt });
            entity.HasIndex(x => x.UserId);
            entity.Property(x => x.ClientId).HasMaxLength(120);
            entity.Property(x => x.SpeakerName).HasMaxLength(180);
            entity.Property(x => x.SourceLanguage).HasMaxLength(20);
            entity.Property(x => x.Text).HasMaxLength(20000);
            entity.Property(x => x.TranslatedText).HasMaxLength(20000);
            entity.HasOne<MeetingRoom>().WithMany().HasForeignKey(x => x.MeetingRoomId).OnDelete(DeleteBehavior.Cascade);
            entity.HasOne<User>().WithMany().HasForeignKey(x => x.UserId).OnDelete(DeleteBehavior.SetNull);
        });

        modelBuilder.Entity<MeetingChatMessage>(entity =>
        {
            entity.HasIndex(x => new { x.MeetingRoomId, x.CreatedAt });
            entity.HasIndex(x => x.UserId);
            entity.Property(x => x.ClientId).HasMaxLength(120);
            entity.Property(x => x.SenderName).HasMaxLength(180);
            entity.Property(x => x.Message).HasMaxLength(10000);
            entity.Property(x => x.FileName).HasMaxLength(260);
            entity.Property(x => x.FileMimeType).HasMaxLength(120);
            entity.Property(x => x.FileStoragePath).HasMaxLength(1024);
            entity.HasOne<MeetingRoom>().WithMany().HasForeignKey(x => x.MeetingRoomId).OnDelete(DeleteBehavior.Cascade);
            entity.HasOne<User>().WithMany().HasForeignKey(x => x.UserId).OnDelete(DeleteBehavior.SetNull);
        });
    }

    public override Task<int> SaveChangesAsync(CancellationToken cancellationToken = default)
    {
        var now = DateTimeOffset.UtcNow;

        foreach (var entry in ChangeTracker.Entries<AuditableEntity>())
        {
            if (entry.State == EntityState.Added)
            {
                entry.Entity.CreatedAt = now;
                entry.Entity.CreatedByUserId ??= currentUser?.UserId;
            }

            if (entry.State == EntityState.Modified)
            {
                entry.Entity.UpdatedAt = now;
                entry.Entity.UpdatedByUserId = currentUser?.UserId;
            }
        }

        return base.SaveChangesAsync(cancellationToken);
    }
}
