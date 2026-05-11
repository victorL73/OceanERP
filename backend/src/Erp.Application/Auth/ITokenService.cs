using Erp.Domain.Auth;

namespace Erp.Application.Auth;

public interface ITokenService
{
    string CreateAccessToken(User user, IEnumerable<string> roles, IEnumerable<string> permissions, DateTimeOffset expiresAt);
    string CreateRefreshToken();
    string HashToken(string token);
}

