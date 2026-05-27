using Microsoft.AspNetCore.Authorization;

namespace Erp.Api.Security;

public sealed class PermissionAuthorizationHandler : AuthorizationHandler<PermissionRequirement>
{
    protected override Task HandleRequirementAsync(AuthorizationHandlerContext context, PermissionRequirement requirement)
    {
        if (context.User.HasClaim("permission", requirement.Permission) ||
            context.User.IsInRole("Administrator") ||
            HasLegacyBackupWritePermission(context, requirement))
        {
            context.Succeed(requirement);
        }

        return Task.CompletedTask;
    }

    private static bool HasLegacyBackupWritePermission(AuthorizationHandlerContext context, PermissionRequirement requirement)
        => requirement.Permission.StartsWith("backup.", StringComparison.Ordinal) &&
           context.User.HasClaim("permission", "backup.write");
}
