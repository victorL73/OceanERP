namespace Erp.Infrastructure.Security;

public sealed class JwtOptions
{
    public string Issuer { get; set; } = "OceanERP";
    public string Audience { get; set; } = "OceanERP";
    public string SigningKey { get; set; } = "CHANGE_ME_MINIMUM_32_CHARACTERS_KEY";
    public int AccessTokenMinutes { get; set; } = 30;
    public int RefreshTokenDays { get; set; } = 14;
}

