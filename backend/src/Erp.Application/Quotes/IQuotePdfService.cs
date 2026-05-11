using Erp.Domain.Quotes;

namespace Erp.Application.Quotes;

public interface IQuotePdfService
{
    byte[] Generate(Quote quote);
}

