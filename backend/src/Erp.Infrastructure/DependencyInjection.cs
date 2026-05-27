using Erp.Application.Auth;
using Erp.Application.Ai;
using Erp.Application.Backups;
using Erp.Application.Calendar;
using Erp.Application.Customers;
using Erp.Application.Dashboard;
using Erp.Application.Documents;
using Erp.Application.Emails;
using Erp.Application.ExpenseReports;
using Erp.Application.Flowcean;
using Erp.Application.Invoices;
using Erp.Application.Meetings;
using Erp.Application.Notifications;
using Erp.Application.Prestashop;
using Erp.Application.Products;
using Erp.Application.Purchases;
using Erp.Application.Quotes;
using Erp.Application.Sales;
using Erp.Application.ServiceTickets;
using Erp.Application.Signatures;
using Erp.Application.Stock;
using Erp.Application.Treasury;
using Erp.Domain.Auth;
using Erp.Infrastructure.Files;
using Erp.Infrastructure.Pdf;
using Erp.Infrastructure.Persistence;
using Erp.Infrastructure.Security;
using Erp.Infrastructure.Services;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;

namespace Erp.Infrastructure;

public static class DependencyInjection
{
    public static IServiceCollection AddInfrastructure(this IServiceCollection services, IConfiguration configuration)
    {
        services.Configure<JwtOptions>(configuration.GetSection("Jwt"));
        services.Configure<FileStorageOptions>(configuration.GetSection("Storage"));
        services.Configure<BackupOptions>(configuration.GetSection("Backup"));

        services.AddDbContext<ErpDbContext>(options =>
        {
            var connectionString = configuration.GetConnectionString("DefaultConnection")
                ?? "Host=localhost;Port=5432;Database=oceanerp;Username=oceanerp;Password=oceanerp";
            options.UseNpgsql(connectionString);
        });

        services.AddSingleton<IPrestashopSyncQueue, PrestashopSyncQueue>();
        services.AddScoped<IPrestashopService, PrestashopService>();
        services.TryAddScoped<IPrestashopSyncNotifier, NoopPrestashopSyncNotifier>();
        services.AddHttpClient();
        services.AddHttpClient<PrestashopSyncExecutor>();
        services.AddHostedService<PrestashopSyncWorker>();
        services.AddHostedService<PrestashopAutoSyncWorker>();
        services.AddScoped<IPasswordHasher<User>, PasswordHasher<User>>();
        services.AddScoped<ITokenService, TokenService>();
        services.AddScoped<IAuthService, AuthService>();
        services.AddScoped<ICustomerService, CustomerService>();
        services.AddScoped<IProductService, ProductService>();
        services.AddScoped<IQuoteService, QuoteService>();
        services.AddScoped<QuoteDocumentDriveLinker>();
        services.AddScoped<IQuoteSettingsService, QuoteSettingsService>();
        services.AddScoped<IAiSettingsService, AiSettingsService>();
        services.AddScoped<IQuotePdfService, QuotePdfService>();
        services.AddScoped<IInvoicePdfService, InvoicePdfService>();
        services.AddScoped<ISalesOrderShipmentPdfService, SalesOrderShipmentPdfService>();
        services.AddScoped<IFileStorageService, FileSystemStorageService>();
        services.AddScoped<IDriveService, DriveService>();
        services.AddScoped<INotificationService, NotificationService>();
        services.AddScoped<IDashboardService, DashboardService>();
        services.AddScoped<ITreasuryService, TreasuryService>();
        services.AddScoped<IExpenseReportService, ExpenseReportService>();
        services.AddScoped<IStockService, StockService>();
        services.AddScoped<ILowStockAlertService, LowStockAlertService>();
        services.AddScoped<ISalesOrderService, SalesOrderService>();
        services.AddScoped<IPurchaseOrderService, PurchaseOrderService>();
        services.AddScoped<IInvoiceService, InvoiceService>();
        services.AddScoped<IEmailService, EmailService>();
        services.AddScoped<IServiceTicketService, ServiceTicketService>();
        services.AddScoped<ICalendarService, CalendarService>();
        services.AddScoped<ISignatureService, SignatureService>();
        services.AddScoped<IOnlyOfficeService, OnlyOfficeService>();
        services.AddScoped<IFlowceanService, FlowceanService>();
        services.AddScoped<IMeetingService, MeetingService>();
        services.AddScoped<IBackupService, BackupService>();
        services.AddHostedService<LowStockAlertWorker>();
        services.AddHostedService<BackupScheduleWorker>();
        services.AddHostedService<NotificationCleanupWorker>();

        return services;
    }
}
