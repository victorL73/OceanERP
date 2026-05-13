using Erp.Application.Common;

namespace Erp.Application.Quotes;

public interface IQuoteSettingsService
{
    Task<QuoteSettingsDto> GetAsync(CancellationToken cancellationToken);
    Task<Result<QuoteSettingsDto>> UpdateAsync(UpdateQuoteSettingsRequest request, CancellationToken cancellationToken);
    Task<Result<QuoteSettingsDto>> UploadLogoAsync(string fileName, string mimeType, Stream content, long size, CancellationToken cancellationToken);
    Task<Result<QuoteSettingsDto>> DeleteLogoAsync(CancellationToken cancellationToken);
}
