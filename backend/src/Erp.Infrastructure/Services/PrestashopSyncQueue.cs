using System.Threading.Channels;

namespace Erp.Infrastructure.Services;

public interface IPrestashopSyncQueue
{
    ValueTask EnqueueAsync(Guid syncLogId, CancellationToken cancellationToken);
    ValueTask<Guid> DequeueAsync(CancellationToken cancellationToken);
}

internal sealed class PrestashopSyncQueue : IPrestashopSyncQueue
{
    private readonly Channel<Guid> queue = Channel.CreateUnbounded<Guid>();

    public ValueTask EnqueueAsync(Guid syncLogId, CancellationToken cancellationToken)
        => queue.Writer.WriteAsync(syncLogId, cancellationToken);

    public ValueTask<Guid> DequeueAsync(CancellationToken cancellationToken)
        => queue.Reader.ReadAsync(cancellationToken);
}
