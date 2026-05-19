using Erp.Domain.Auth;
using Erp.Domain.Products;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace Erp.Infrastructure.Persistence;

public static class DataSeeder
{
    public static async Task SeedAsync(IServiceProvider services, CancellationToken cancellationToken = default)
    {
        await using var scope = services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<ErpDbContext>();
        var hasher = scope.ServiceProvider.GetRequiredService<IPasswordHasher<User>>();
        var configuration = scope.ServiceProvider.GetRequiredService<IConfiguration>();

        if (db.Database.ProviderName != "Microsoft.EntityFrameworkCore.InMemory")
        {
            await db.Database.MigrateAsync(cancellationToken);
        }

        var permissionCodes = new[]
        {
            "auth.users.read", "auth.users.write",
            "customers.read", "customers.write",
            "products.read", "products.write",
            "quotes.read", "quotes.write",
            "drive.read", "drive.write",
            "notifications.read", "notifications.write",
            "dashboard.read",
            "stock.read", "stock.write",
            "orders.read", "orders.write",
            "purchases.read", "purchases.write",
            "invoices.read", "invoices.write",
            "emails.read", "emails.write",
            "prestashop.read", "prestashop.write",
            "service.read", "service.write",
            "calendar.read", "calendar.write",
            "meet.read", "meet.write",
            "signatures.read", "signatures.write",
            "onlyoffice.read", "onlyoffice.write",
            "flowcean.read", "flowcean.write"
        };

        foreach (var code in permissionCodes)
        {
            if (!await db.Permissions.AnyAsync(x => x.Code == code, cancellationToken))
            {
                var parts = code.Split('.');
                db.Permissions.Add(new Permission { Module = parts[0], Action = parts[1], Code = code });
            }
        }

        await db.SaveChangesAsync(cancellationToken);

        var adminRole = await db.Roles.Include(x => x.Permissions).FirstOrDefaultAsync(x => x.Name == "Administrator", cancellationToken);
        if (adminRole is null)
        {
            adminRole = new Role { Name = "Administrator", Description = "Full ERP administrator" };
            db.Roles.Add(adminRole);
        }

        adminRole.Permissions.Clear();
        foreach (var permission in await db.Permissions.ToListAsync(cancellationToken))
        {
            adminRole.Permissions.Add(permission);
        }

        var salesRole = await db.Roles.Include(x => x.Permissions).FirstOrDefaultAsync(x => x.Name == "Sales", cancellationToken);
        if (salesRole is null)
        {
            salesRole = new Role { Name = "Sales", Description = "Sales team access" };
            db.Roles.Add(salesRole);
        }

        foreach (var permission in await db.Permissions.Where(x => x.Code.StartsWith("customers") || x.Code.StartsWith("products") || x.Code.StartsWith("quotes") || x.Code == "dashboard.read").ToListAsync(cancellationToken))
        {
            if (!salesRole.Permissions.Any(x => x.Id == permission.Id))
            {
                salesRole.Permissions.Add(permission);
            }
        }

        await db.SaveChangesAsync(cancellationToken);

        var adminEmail = configuration["Seed:AdminEmail"] ?? "admin@oceanerp.local";
        var adminPassword = configuration["Seed:AdminPassword"] ?? "ChangeMe!12345";
        var admin = await db.Users.Include(x => x.UserRoles).FirstOrDefaultAsync(x => x.Email == adminEmail, cancellationToken);
        if (admin is null)
        {
            admin = new User { Email = adminEmail, DisplayName = "OceanERP Admin", IsActive = true };
            admin.PasswordHash = hasher.HashPassword(admin, adminPassword);
            db.Users.Add(admin);
        }

        if (!admin.UserRoles.Any(x => x.RoleId == adminRole.Id))
        {
            admin.UserRoles.Add(new UserRole { UserId = admin.Id, RoleId = adminRole.Id });
        }

        if (!await db.ProductCategories.AnyAsync(cancellationToken))
        {
            db.ProductCategories.AddRange(
                new ProductCategory { Name = "Materiel", Description = "Produits physiques" },
                new ProductCategory { Name = "Service", Description = "Prestations et services" });
        }

        if (!await db.ProductSuppliers.AnyAsync(cancellationToken))
        {
            db.ProductSuppliers.Add(new ProductSupplier { Name = "Fournisseur principal" });
        }

        if (!await db.Warehouses.AnyAsync(cancellationToken))
        {
            db.Warehouses.Add(new Erp.Domain.FutureModules.Warehouse { Name = "Entrepot principal" });
        }

        await db.SaveChangesAsync(cancellationToken);
    }
}
