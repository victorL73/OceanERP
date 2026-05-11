using Erp.Application.Auth;
using Erp.Application.Customers;
using Erp.Application.Dashboard;
using Erp.Application.Documents;
using Erp.Application.Emails;
using Erp.Application.Invoices;
using Erp.Application.Notifications;
using Erp.Application.Prestashop;
using Erp.Application.Products;
using Erp.Application.Quotes;
using Erp.Application.Sales;
using Erp.Application.Stock;
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

namespace Erp.Infrastructure;

public static class DependencyInjection
{
    public static IServiceCollection AddInfrastructure(this IServiceCollection services, IConfiguration configuration)
    {
        services.Configure<JwtOptions>(configuration.GetSection("Jwt"));
        services.Configure<FileStorageOptions>(configuration.GetSection("Storage"));

        services.AddDbContext<ErpDbContext>(options =>
        {
            var connectionString = configuration.GetConnectionString("DefaultConnection")
                ?? "Host=localhost;Port=5432;Database=oceanerp;Username=oceanerp;Password=oceanerp";
            options.UseNpgsql(connectionString);
        });

        services.AddScoped<IPasswordHasher<User>, PasswordHasher<User>>();
        services.AddScoped<ITokenService, TokenService>();
        services.AddScoped<IAuthService, AuthService>();
        services.AddScoped<ICustomerService, CustomerService>();
        services.AddScoped<IProductService, ProductService>();
        services.AddScoped<IQuoteService, QuoteService>();
        services.AddScoped<IQuotePdfService, QuotePdfService>();
        services.AddScoped<IFileStorageService, FileSystemStorageService>();
        services.AddScoped<IDriveService, DriveService>();
        services.AddScoped<INotificationService, NotificationService>();
        services.AddScoped<IDashboardService, DashboardService>();
        services.AddScoped<IStockService, StockService>();
        services.AddScoped<ISalesOrderService, SalesOrderService>();
        services.AddScoped<IInvoiceService, InvoiceService>();
        services.AddScoped<IEmailService, EmailService>();
        services.AddScoped<IPrestashopService, PrestashopService>();

        return services;
    }
}
