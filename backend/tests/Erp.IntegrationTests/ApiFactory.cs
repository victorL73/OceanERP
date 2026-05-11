using Erp.Infrastructure.Persistence;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;

namespace Erp.IntegrationTests;

public sealed class ApiFactory : WebApplicationFactory<Program>
{
    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment("Testing");
        builder.ConfigureAppConfiguration((_, configuration) =>
        {
            configuration.AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["Jwt:Issuer"] = "OceanERP",
                ["Jwt:Audience"] = "OceanERP",
                ["Jwt:SigningKey"] = "CHANGE_ME_OCEANERP_DEVELOPMENT_KEY_32_CHARS_MINIMUM",
                ["Seed:AdminEmail"] = "admin@oceanerp.local",
                ["Seed:AdminPassword"] = "ChangeMe!12345",
                ["Storage:RootPath"] = Path.Combine(Path.GetTempPath(), "oceanerp-tests", Guid.NewGuid().ToString("N"))
            });
        });

        builder.ConfigureServices(services =>
        {
            var databaseName = $"oceanerp-{Guid.NewGuid():N}";
            services.RemoveAll<DbContextOptions<ErpDbContext>>();
            services.RemoveAll<IDbContextOptionsConfiguration<ErpDbContext>>();
            services.AddDbContext<ErpDbContext>(options => options.UseInMemoryDatabase(databaseName));
        });
    }
}
