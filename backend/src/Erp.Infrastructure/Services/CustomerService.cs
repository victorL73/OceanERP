using Erp.Application.Common;
using Erp.Application.Customers;
using Erp.Domain.Customers;
using Erp.Domain.FutureModules;
using Erp.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using System.Xml.Linq;

namespace Erp.Infrastructure.Services;

public sealed class CustomerService(ErpDbContext db, IConfiguration configuration, IHttpClientFactory httpClientFactory) : ICustomerService
{
    private const string PrestashopProvider = "PrestaShop";
    private const string PrestashopCustomerModule = "customers";

    public async Task<PagedResult<CustomerDto>> SearchAsync(string? search, int page, int pageSize, CancellationToken cancellationToken)
    {
        page = Math.Max(1, page);
        pageSize = Math.Clamp(pageSize, 1, 100);

        var query = db.Customers.Include(x => x.Contacts).Include(x => x.Addresses).AsQueryable();
        if (!string.IsNullOrWhiteSpace(search))
        {
            query = query.Where(x =>
                x.Code.Contains(search)
                || x.CompanyName.Contains(search)
                || (x.LegalName != null && x.LegalName.Contains(search))
                || (x.TradeName != null && x.TradeName.Contains(search))
                || (x.SirenNumber != null && x.SirenNumber.Contains(search))
                || (x.SiretNumber != null && x.SiretNumber.Contains(search))
                || (x.Email != null && x.Email.Contains(search))
                || x.Contacts.Any(contact => contact.Email != null && contact.Email.Contains(search)));
        }

        var total = await query.CountAsync(cancellationToken);
        var customers = await query.OrderBy(x => x.CompanyName).Skip((page - 1) * pageSize).Take(pageSize).ToListAsync(cancellationToken);
        return new PagedResult<CustomerDto>(customers.Select(Map).ToList(), total, page, pageSize);
    }

    public async Task<Result<CustomerDto>> GetAsync(Guid id, CancellationToken cancellationToken)
    {
        var customer = await db.Customers.Include(x => x.Contacts).Include(x => x.Addresses).FirstOrDefaultAsync(x => x.Id == id, cancellationToken);
        return customer is null ? Result<CustomerDto>.Failure("Customer not found.") : Result<CustomerDto>.Success(Map(customer));
    }

    public async Task<Result<CustomerDto>> CreateAsync(CreateCustomerRequest request, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.Code) || string.IsNullOrWhiteSpace(request.CompanyName))
        {
            return Result<CustomerDto>.Failure("Customer code and company name are required.");
        }

        if (await db.Customers.AnyAsync(x => x.Code == request.Code, cancellationToken))
        {
            return Result<CustomerDto>.Failure("Customer code already exists.");
        }

        var customer = new Customer
        {
            Code = request.Code.Trim(),
            CompanyName = request.CompanyName.Trim(),
            LegalName = Clean(request.LegalName),
            TradeName = Clean(request.TradeName),
            SirenNumber = CleanIdentifier(request.SirenNumber),
            SiretNumber = CleanIdentifier(request.SiretNumber),
            VatNumber = Clean(request.VatNumber),
            Email = Clean(request.Email),
            Phone = Clean(request.Phone),
            MobilePhone = Clean(request.MobilePhone),
            Website = Clean(request.Website),
            Industry = Clean(request.Industry),
            CustomerType = Clean(request.CustomerType),
            Source = Clean(request.Source),
            AccountingCode = Clean(request.AccountingCode),
            PaymentTerms = Clean(request.PaymentTerms),
            DefaultDiscountRate = Math.Max(0, request.DefaultDiscountRate ?? 0),
            Notes = Clean(request.Notes)
        };

        ApplyChildren(customer, request.Contacts, request.Addresses);
        db.Customers.Add(customer);
        await db.SaveChangesAsync(cancellationToken);
        return Result<CustomerDto>.Success(Map(customer));
    }

    public async Task<Result<CustomerDto>> UpdateAsync(Guid id, UpdateCustomerRequest request, CancellationToken cancellationToken)
    {
        var customer = await db.Customers.Include(x => x.Contacts).Include(x => x.Addresses).FirstOrDefaultAsync(x => x.Id == id, cancellationToken);
        if (customer is null)
        {
            return Result<CustomerDto>.Failure("Customer not found.");
        }

        customer.CompanyName = request.CompanyName.Trim();
        customer.LegalName = Clean(request.LegalName);
        customer.TradeName = Clean(request.TradeName);
        customer.SirenNumber = CleanIdentifier(request.SirenNumber);
        customer.SiretNumber = CleanIdentifier(request.SiretNumber);
        customer.VatNumber = Clean(request.VatNumber);
        customer.Email = Clean(request.Email);
        customer.Phone = Clean(request.Phone);
        customer.MobilePhone = Clean(request.MobilePhone);
        customer.Website = Clean(request.Website);
        customer.Industry = Clean(request.Industry);
        customer.CustomerType = Clean(request.CustomerType);
        customer.Source = Clean(request.Source);
        customer.AccountingCode = Clean(request.AccountingCode);
        customer.PaymentTerms = Clean(request.PaymentTerms);
        customer.DefaultDiscountRate = Math.Max(0, request.DefaultDiscountRate ?? 0);
        customer.Notes = Clean(request.Notes);
        customer.IsActive = request.IsActive;
        db.CustomerContacts.RemoveRange(customer.Contacts);
        db.CustomerAddresses.RemoveRange(customer.Addresses);
        customer.Contacts.Clear();
        customer.Addresses.Clear();
        ApplyChildren(customer, request.Contacts, request.Addresses);
        var publishResult = await PublishPrestashopCustomerAsync(customer, cancellationToken);
        if (!publishResult.Succeeded)
        {
            return Result<CustomerDto>.Failure(publishResult.Error!);
        }

        await db.SaveChangesAsync(cancellationToken);
        return Result<CustomerDto>.Success(Map(customer));
    }

    private static void ApplyChildren(Customer customer, IReadOnlyList<UpsertCustomerContactRequest>? contacts, IReadOnlyList<UpsertCustomerAddressRequest>? addresses)
    {
        foreach (var contact in contacts ?? [])
        {
            customer.Contacts.Add(new CustomerContact
            {
                FirstName = contact.FirstName,
                LastName = contact.LastName,
                Email = contact.Email,
                Phone = contact.Phone,
                JobTitle = contact.JobTitle,
                IsPrimary = contact.IsPrimary
            });
        }

        foreach (var address in addresses ?? [])
        {
            customer.Addresses.Add(new CustomerAddress
            {
                Label = address.Label,
                Line1 = address.Line1,
                Line2 = address.Line2,
                PostalCode = address.PostalCode,
                City = address.City,
                Country = address.Country,
                IsBilling = address.IsBilling,
                IsShipping = address.IsShipping
            });
        }
    }

    private static CustomerDto Map(Customer customer)
        => new(
            customer.Id,
            customer.Code,
            customer.CompanyName,
            customer.LegalName,
            customer.TradeName,
            customer.SirenNumber,
            customer.SiretNumber,
            customer.VatNumber,
            customer.Email,
            customer.Phone,
            customer.MobilePhone,
            customer.Website,
            customer.Industry,
            customer.CustomerType,
            customer.Source,
            customer.AccountingCode,
            customer.PaymentTerms,
            customer.DefaultDiscountRate,
            customer.Notes,
            customer.IsActive,
            customer.Contacts.Select(x => new CustomerContactDto(x.Id, x.FirstName, x.LastName, x.Email, x.Phone, x.JobTitle, x.IsPrimary)).ToList(),
            customer.Addresses.Select(x => new CustomerAddressDto(x.Id, x.Label, x.Line1, x.Line2, x.PostalCode, x.City, x.Country, x.IsBilling, x.IsShipping)).ToList());

    private static string? Clean(string? value)
        => string.IsNullOrWhiteSpace(value) ? null : value.Trim();

    private static string? CleanIdentifier(string? value)
        => string.IsNullOrWhiteSpace(value) ? null : new string(value.Where(char.IsLetterOrDigit).ToArray()).Trim();

    private async Task<Result> PublishPrestashopCustomerAsync(Customer customer, CancellationToken cancellationToken)
    {
        var externalReference = await db.ExternalReferences.FirstOrDefaultAsync(
            x => x.Provider == PrestashopProvider && x.Module == PrestashopCustomerModule && x.EntityId == customer.Id,
            cancellationToken);
        if (externalReference is null)
        {
            return Result.Success();
        }

        var externalCustomerId = ExtractPrestashopId(externalReference, PrestashopCustomerModule);
        if (string.IsNullOrWhiteSpace(externalCustomerId))
        {
            return Result.Failure("Reference PrestaShop client invalide.");
        }

        var connection = await db.PrestashopConnections
            .Where(x => x.IsActive)
            .OrderByDescending(x => x.UpdatedAt ?? x.CreatedAt)
            .FirstOrDefaultAsync(cancellationToken);
        if (connection is null)
        {
            return Result.Failure("Aucune connexion PrestaShop active n'est configuree.");
        }

        var apiKeyResult = PrestashopSecretProtector.ResolveApiKey(configuration, connection);
        if (!apiKeyResult.Succeeded)
        {
            return Result.Failure(apiKeyResult.Error ?? "Cle API PrestaShop non configuree.");
        }

        try
        {
            var apiBaseUrl = GetApiBaseUrl(connection.ShopUrl);
            await UpdatePrestashopCustomerAsync(apiBaseUrl, externalCustomerId, apiKeyResult.Value!, customer, cancellationToken);
            await UpdatePrestashopCustomerAddressAsync(apiBaseUrl, externalCustomerId, apiKeyResult.Value!, customer, cancellationToken);
            return Result.Success();
        }
        catch (OperationCanceledException)
        {
            throw;
        }
        catch (Exception ex)
        {
            return Result.Failure($"Modification PrestaShop impossible: {TrimDetail(FullExceptionMessage(ex))}");
        }
    }

    private async Task UpdatePrestashopCustomerAsync(string apiBaseUrl, string externalCustomerId, string apiKey, Customer customer, CancellationToken cancellationToken)
    {
        var document = await GetPrestashopXmlAsync($"{apiBaseUrl}/customers/{externalCustomerId}?display=full&output_format=XML", "client", apiKey, cancellationToken);
        var customerElement = document.Root?.Element("customer") ?? document.Descendants("customer").FirstOrDefault();
        if (customerElement is null)
        {
            throw new InvalidOperationException("Reponse PrestaShop client invalide.");
        }

        RemoveReadOnlyFields(customerElement);
        var primaryContact = SelectPrimaryContact(customer);
        SetElementValue(customerElement, "company", FirstNonEmpty(customer.LegalName, customer.TradeName, customer.CompanyName));
        SetElementValue(customerElement, "active", customer.IsActive ? "1" : "0");
        SetElementValue(customerElement, "note", customer.Notes ?? string.Empty);
        SetElementValue(customerElement, "siret", FirstNonEmpty(customer.SiretNumber, customer.SirenNumber, customer.VatNumber));

        if (primaryContact is not null || !string.IsNullOrWhiteSpace(customer.Email))
        {
            SetElementValue(customerElement, "firstname", SafePrestashopName(primaryContact?.FirstName, "Client"));
            SetElementValue(customerElement, "lastname", SafePrestashopName(primaryContact?.LastName, customer.CompanyName));
            var email = FirstNonEmpty(primaryContact?.Email, customer.Email);
            if (!string.IsNullOrWhiteSpace(email))
            {
                SetElementValue(customerElement, "email", email);
            }
        }

        await PutPrestashopXmlAsync($"{apiBaseUrl}/customers/{externalCustomerId}", "client", apiKey, document, cancellationToken);
    }

    private async Task UpdatePrestashopCustomerAddressAsync(string apiBaseUrl, string externalCustomerId, string apiKey, Customer customer, CancellationToken cancellationToken)
    {
        var address = customer.Addresses.OrderByDescending(x => x.IsBilling).ThenByDescending(x => x.IsShipping).FirstOrDefault();
        if (address is null)
        {
            return;
        }

        var addressId = await FindFirstPrestashopAddressIdAsync(apiBaseUrl, externalCustomerId, apiKey, cancellationToken);
        if (string.IsNullOrWhiteSpace(addressId))
        {
            return;
        }

        var document = await GetPrestashopXmlAsync($"{apiBaseUrl}/addresses/{addressId}?display=full&output_format=XML", "adresse client", apiKey, cancellationToken);
        var addressElement = document.Root?.Element("address") ?? document.Descendants("address").FirstOrDefault();
        if (addressElement is null)
        {
            throw new InvalidOperationException("Reponse PrestaShop adresse invalide.");
        }

        var primaryContact = SelectPrimaryContact(customer);
        RemoveReadOnlyFields(addressElement);
        SetElementValue(addressElement, "company", FirstNonEmpty(customer.LegalName, customer.TradeName, customer.CompanyName));
        SetElementValue(addressElement, "firstname", SafePrestashopName(primaryContact?.FirstName, "Client"));
        SetElementValue(addressElement, "lastname", SafePrestashopName(primaryContact?.LastName, customer.CompanyName));
        SetElementValue(addressElement, "address1", address.Line1);
        SetElementValue(addressElement, "address2", address.Line2 ?? string.Empty);
        SetElementValue(addressElement, "postcode", address.PostalCode);
        SetElementValue(addressElement, "city", address.City);
        SetElementValue(addressElement, "alias", string.IsNullOrWhiteSpace(address.Label) ? "Adresse ERP" : address.Label);
        SetElementValue(addressElement, "phone", FirstNonEmpty(primaryContact?.Phone, customer.Phone, customer.MobilePhone));
        SetElementValue(addressElement, "vat_number", customer.VatNumber ?? string.Empty);

        await PutPrestashopXmlAsync($"{apiBaseUrl}/addresses/{addressId}", "adresse client", apiKey, document, cancellationToken);
    }

    private async Task<string?> FindFirstPrestashopAddressIdAsync(string apiBaseUrl, string externalCustomerId, string apiKey, CancellationToken cancellationToken)
    {
        var httpClient = httpClientFactory.CreateClient(nameof(CustomerService));
        using var request = new HttpRequestMessage(HttpMethod.Get, $"{apiBaseUrl}/addresses?filter[id_customer]=[{externalCustomerId}]&display=full&limit=1&output_format=JSON");
        AddPrestashopHeaders(request, apiKey, "application/json");

        using var response = await httpClient.SendAsync(request, cancellationToken);
        var body = await response.Content.ReadAsStringAsync(cancellationToken);
        if (!response.IsSuccessStatusCode)
        {
            throw new InvalidOperationException($"GET adresse client PrestaShop HTTP {(int)response.StatusCode} {TrimDetail(body)}");
        }

        using var document = JsonDocument.Parse(body);
        if (!document.RootElement.TryGetProperty("addresses", out var addresses) || addresses.ValueKind != JsonValueKind.Array)
        {
            return null;
        }

        var first = addresses.EnumerateArray().FirstOrDefault();
        if (first.ValueKind == JsonValueKind.Undefined)
        {
            return null;
        }

        return GetJsonString(first, "id");
    }

    private async Task<XDocument> GetPrestashopXmlAsync(string url, string label, string apiKey, CancellationToken cancellationToken)
    {
        var httpClient = httpClientFactory.CreateClient(nameof(CustomerService));
        using var request = new HttpRequestMessage(HttpMethod.Get, url);
        AddPrestashopHeaders(request, apiKey, "application/xml");

        using var response = await httpClient.SendAsync(request, cancellationToken);
        var body = await response.Content.ReadAsStringAsync(cancellationToken);
        if (!response.IsSuccessStatusCode)
        {
            throw new InvalidOperationException($"GET {label} PrestaShop HTTP {(int)response.StatusCode} {TrimDetail(body)}");
        }

        return XDocument.Parse(body, LoadOptions.PreserveWhitespace);
    }

    private async Task PutPrestashopXmlAsync(string url, string label, string apiKey, XDocument document, CancellationToken cancellationToken)
    {
        var httpClient = httpClientFactory.CreateClient(nameof(CustomerService));
        using var request = new HttpRequestMessage(HttpMethod.Put, url);
        AddPrestashopHeaders(request, apiKey, "application/xml");
        request.Content = new StringContent(document.ToString(SaveOptions.DisableFormatting), Encoding.UTF8, "application/xml");

        using var response = await httpClient.SendAsync(request, cancellationToken);
        var body = await response.Content.ReadAsStringAsync(cancellationToken);
        if (!response.IsSuccessStatusCode)
        {
            throw new InvalidOperationException($"PUT {label} PrestaShop HTTP {(int)response.StatusCode} {TrimDetail(body)}");
        }
    }

    private static CustomerContact? SelectPrimaryContact(Customer customer)
        => customer.Contacts.OrderByDescending(x => x.IsPrimary).FirstOrDefault(x => !string.IsNullOrWhiteSpace(x.Email))
            ?? customer.Contacts.OrderByDescending(x => x.IsPrimary).FirstOrDefault();

    private static string SafePrestashopName(string? value, string fallback)
    {
        var cleaned = string.IsNullOrWhiteSpace(value) ? fallback : value.Trim();
        cleaned = cleaned.Replace("\n", " ").Replace("\r", " ").Trim();
        return string.IsNullOrWhiteSpace(cleaned) ? "Client" : cleaned;
    }

    private static string FirstNonEmpty(params string?[] values)
        => values.FirstOrDefault(value => !string.IsNullOrWhiteSpace(value))?.Trim() ?? string.Empty;

    private static void RemoveReadOnlyFields(XElement element)
    {
        var readOnlyFields = new HashSet<string>(StringComparer.OrdinalIgnoreCase)
        {
            "date_add",
            "date_upd",
            "last_passwd_gen",
            "newsletter_date_add",
            "ip_registration_newsletter",
            "reset_password_token",
            "reset_password_validity"
        };

        foreach (var child in element.Elements().Where(x => readOnlyFields.Contains(x.Name.LocalName)).ToList())
        {
            child.Remove();
        }
    }

    private static void SetElementValue(XElement parent, string name, string value)
    {
        var element = parent.Element(name);
        if (element is null)
        {
            element = new XElement(name);
            parent.Add(element);
        }

        element.Value = value;
    }

    private static void AddPrestashopHeaders(HttpRequestMessage request, string apiKey, string accept)
    {
        request.Headers.Authorization = new AuthenticationHeaderValue(
            "Basic",
            Convert.ToBase64String(Encoding.ASCII.GetBytes($"{apiKey}:")));
        request.Headers.Accept.Add(new MediaTypeWithQualityHeaderValue(accept));
    }

    private static string? ExtractPrestashopId(ExternalReference externalReference, string module)
    {
        var prefix = $"{module}:";
        return externalReference.ExternalId.StartsWith(prefix, StringComparison.OrdinalIgnoreCase)
            ? externalReference.ExternalId[prefix.Length..]
            : externalReference.ExternalId;
    }

    private static string GetApiBaseUrl(string shopUrl)
    {
        var normalized = shopUrl.Trim().TrimEnd('/');
        return normalized.EndsWith("/api", StringComparison.OrdinalIgnoreCase)
            ? normalized
            : $"{normalized}/api";
    }

    private static string? GetJsonString(JsonElement element, string name)
        => element.TryGetProperty(name, out var property)
            ? property.ValueKind switch
            {
                JsonValueKind.String => property.GetString(),
                JsonValueKind.Number => property.TryGetInt64(out var value) ? value.ToString() : property.GetRawText(),
                _ => property.GetRawText().Trim('"')
            }
            : null;

    private static string TrimDetail(string detail)
        => detail.ReplaceLineEndings(" ").Length > 300 ? detail.ReplaceLineEndings(" ")[..300] : detail.ReplaceLineEndings(" ");

    private static string FullExceptionMessage(Exception exception)
    {
        var messages = new List<string>();
        for (var current = exception; current is not null; current = current.InnerException)
        {
            if (!string.IsNullOrWhiteSpace(current.Message))
            {
                messages.Add(current.Message);
            }
        }

        return string.Join(" | ", messages.Distinct());
    }
}
