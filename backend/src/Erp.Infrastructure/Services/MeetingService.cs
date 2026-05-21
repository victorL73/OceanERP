using System.Security.Cryptography;
using System.Text.Json;
using Erp.Application.Common;
using Erp.Application.Documents;
using Erp.Application.Meetings;
using Erp.Domain.FutureModules;
using Erp.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;

namespace Erp.Infrastructure.Services;

public sealed class MeetingService(ErpDbContext db, ICurrentUserService currentUser, IFileStorageService fileStorage, IConfiguration configuration) : IMeetingService
{
    private const int PresenceTtlSeconds = 45;
    private const int SignalTtlMinutes = 3;
    private const long ChatAttachmentMaxBytes = 5 * 1024 * 1024;

    private static readonly MeetingLanguageDto[] Languages =
    [
        new("fr-FR", "Francais"),
        new("en-US", "Anglais"),
        new("es-ES", "Espagnol"),
        new("de-DE", "Allemand"),
        new("it-IT", "Italien"),
        new("pt-PT", "Portugais")
    ];

    public MeetingIceConfigurationDto IceConfiguration()
    {
        var servers = new List<MeetingIceServerDto>();
        var stunUrls = SplitConfigUrls(configuration["MEET_STUN_URLS"]);
        if (stunUrls.Count == 0)
        {
            stunUrls.Add("stun:stun.l.google.com:19302");
            stunUrls.Add("stun:stun1.l.google.com:19302");
        }

        servers.Add(new MeetingIceServerDto(stunUrls.ToArray()));

        var turnUrls = SplitConfigUrls(configuration["MEET_TURN_URLS"]);
        if (turnUrls.Count > 0)
        {
            servers.Add(new MeetingIceServerDto(
                turnUrls.ToArray(),
                NormalizeConfigValue(configuration["MEET_TURN_USERNAME"]),
                NormalizeConfigValue(configuration["MEET_TURN_CREDENTIAL"])));
        }

        return new MeetingIceConfigurationDto(servers);
    }

    public async Task<MeetingDashboardDto> DashboardAsync(CancellationToken cancellationToken)
    {
        var rooms = await db.MeetingRooms
            .AsNoTracking()
            .OrderByDescending(x => x.LastActivityAt)
            .ThenByDescending(x => x.CreatedAt)
            .Take(50)
            .ToListAsync(cancellationToken);

        return new MeetingDashboardDto(await MapRoomsAsync(rooms, cancellationToken), Languages, ChatAttachmentMaxBytes);
    }

    public async Task<Result<MeetingRoomStateDto>> GetAsync(Guid roomId, string? clientId, DateTimeOffset? since, CancellationToken cancellationToken)
    {
        var room = await db.MeetingRooms.AsNoTracking().FirstOrDefaultAsync(x => x.Id == roomId, cancellationToken);
        if (room is null)
        {
            return Result<MeetingRoomStateDto>.Failure("Salle de meeting introuvable.");
        }

        return Result<MeetingRoomStateDto>.Success(await MapStateAsync(room, clientId, since, cancellationToken));
    }

    public async Task<Result<MeetingRoomStateDto>> CreateAsync(CreateMeetingRoomRequest request, CancellationToken cancellationToken)
    {
        var title = Normalize(request.Title);
        if (string.IsNullOrWhiteSpace(title))
        {
            return Result<MeetingRoomStateDto>.Failure("Le titre de la salle est obligatoire.");
        }

        if (request.CalendarEventId.HasValue && !await db.CalendarEvents.AnyAsync(x => x.Id == request.CalendarEventId.Value, cancellationToken))
        {
            return Result<MeetingRoomStateDto>.Failure("Evenement agenda introuvable.");
        }

        var room = new MeetingRoom
        {
            Code = await GenerateUniqueCodeAsync(cancellationToken),
            Title = title,
            CalendarEventId = request.CalendarEventId,
            ScheduledStartAt = request.ScheduledStartAt,
            LastActivityAt = DateTimeOffset.UtcNow
        };
        db.MeetingRooms.Add(room);

        if (request.CalendarEventId.HasValue)
        {
            db.CalendarEventLinks.Add(new CalendarEventLink
            {
                CalendarEventId = request.CalendarEventId.Value,
                Module = "meeting",
                EntityId = room.Id
            });
        }

        if (!string.IsNullOrWhiteSpace(request.ClientId))
        {
            UpsertParticipant(room.Id, request.ClientId!, request.DisplayName, request.SourceLanguage, request.TargetLanguage, request.Media);
        }

        await db.SaveChangesAsync(cancellationToken);
        return Result<MeetingRoomStateDto>.Success(await MapStateAsync(room, request.ClientId, null, cancellationToken));
    }

    public async Task<Result<MeetingRoomStateDto>> JoinAsync(JoinMeetingRoomRequest request, CancellationToken cancellationToken)
    {
        var key = Normalize(request.CodeOrToken);
        if (string.IsNullOrWhiteSpace(key))
        {
            return Result<MeetingRoomStateDto>.Failure("Code ou lien de salle obligatoire.");
        }

        var room = await db.MeetingRooms.FirstOrDefaultAsync(x => x.Code == key || x.InviteToken == key, cancellationToken);
        if (room is null)
        {
            return Result<MeetingRoomStateDto>.Failure("Salle de meeting introuvable.");
        }

        if (room.InviteToken == key && room.ScheduledStartAt.HasValue && room.ScheduledStartAt.Value > DateTimeOffset.UtcNow.AddMinutes(10))
        {
            return Result<MeetingRoomStateDto>.Failure("Le lien invite sera ouvert 10 minutes avant le rendez-vous.");
        }

        if (room.IsLocked)
        {
            return Result<MeetingRoomStateDto>.Failure("Cette salle est verrouillee.");
        }

        room.LastActivityAt = DateTimeOffset.UtcNow;
        UpsertParticipant(room.Id, request.ClientId, request.DisplayName, request.SourceLanguage, request.TargetLanguage, request.Media);
        await db.SaveChangesAsync(cancellationToken);
        return Result<MeetingRoomStateDto>.Success(await MapStateAsync(room, request.ClientId, null, cancellationToken));
    }

    public async Task<Result<MeetingRoomStateDto>> JoinPublicAsync(JoinMeetingRoomRequest request, CancellationToken cancellationToken)
    {
        var roomResult = await FindPublicRoomAsync(request.CodeOrToken, cancellationToken);
        if (!roomResult.Succeeded)
        {
            return Result<MeetingRoomStateDto>.Failure(roomResult.Error!);
        }

        var room = roomResult.Value!;
        room.LastActivityAt = DateTimeOffset.UtcNow;
        UpsertParticipant(room.Id, request.ClientId, request.DisplayName, request.SourceLanguage, request.TargetLanguage, request.Media);
        await db.SaveChangesAsync(cancellationToken);
        return Result<MeetingRoomStateDto>.Success(await MapStateAsync(room, request.ClientId, null, cancellationToken));
    }

    public async Task<Result<string>> EnsureInviteAsync(Guid roomId, CancellationToken cancellationToken)
    {
        var room = await db.MeetingRooms.FirstOrDefaultAsync(x => x.Id == roomId, cancellationToken);
        if (room is null)
        {
            return Result<string>.Failure("Salle de meeting introuvable.");
        }

        if (string.IsNullOrWhiteSpace(room.InviteToken))
        {
            room.InviteToken = GenerateToken();
            room.LastActivityAt = DateTimeOffset.UtcNow;
            await db.SaveChangesAsync(cancellationToken);
        }

        return Result<string>.Success(room.InviteToken!);
    }

    public async Task<Result<MeetingRoomStateDto>> SyncAsync(Guid roomId, SyncMeetingRoomRequest request, CancellationToken cancellationToken)
    {
        var room = await db.MeetingRooms.FirstOrDefaultAsync(x => x.Id == roomId, cancellationToken);
        if (room is null)
        {
            return Result<MeetingRoomStateDto>.Failure("Salle de meeting introuvable.");
        }

        room.LastActivityAt = DateTimeOffset.UtcNow;
        UpsertParticipant(room.Id, request.ClientId, request.DisplayName, request.SourceLanguage, request.TargetLanguage, request.Media);
        await CleanupSignalsAsync(cancellationToken);
        await db.SaveChangesAsync(cancellationToken);
        return Result<MeetingRoomStateDto>.Success(await MapStateAsync(room, request.ClientId, request.Since, cancellationToken));
    }

    public async Task<Result<MeetingRoomStateDto>> SyncPublicAsync(string token, SyncMeetingRoomRequest request, CancellationToken cancellationToken)
    {
        var roomResult = await FindPublicRoomAsync(token, cancellationToken);
        if (!roomResult.Succeeded)
        {
            return Result<MeetingRoomStateDto>.Failure(roomResult.Error!);
        }

        var room = roomResult.Value!;
        room.LastActivityAt = DateTimeOffset.UtcNow;
        UpsertParticipant(room.Id, request.ClientId, request.DisplayName, request.SourceLanguage, request.TargetLanguage, request.Media);
        await CleanupSignalsAsync(cancellationToken);
        await db.SaveChangesAsync(cancellationToken);
        return Result<MeetingRoomStateDto>.Success(await MapStateAsync(room, request.ClientId, request.Since, cancellationToken));
    }

    public async Task<Result<MeetingSignalDto>> SendSignalAsync(Guid roomId, SendMeetingSignalRequest request, CancellationToken cancellationToken)
    {
        if (!await db.MeetingRooms.AnyAsync(x => x.Id == roomId, cancellationToken))
        {
            return Result<MeetingSignalDto>.Failure("Salle de meeting introuvable.");
        }

        return await SendSignalForRoomAsync(roomId, request, cancellationToken);
    }

    public async Task<Result<MeetingSignalDto>> SendPublicSignalAsync(string token, SendMeetingSignalRequest request, CancellationToken cancellationToken)
    {
        var roomResult = await FindPublicRoomAsync(token, cancellationToken);
        if (!roomResult.Succeeded)
        {
            return Result<MeetingSignalDto>.Failure(roomResult.Error!);
        }

        return await SendSignalForRoomAsync(roomResult.Value!.Id, request, cancellationToken);
    }

    private async Task<Result<MeetingSignalDto>> SendSignalForRoomAsync(Guid roomId, SendMeetingSignalRequest request, CancellationToken cancellationToken)
    {
        var signal = new MeetingSignal
        {
            MeetingRoomId = roomId,
            SenderClientId = Normalize(request.SenderClientId),
            RecipientClientId = Normalize(request.RecipientClientId),
            SignalType = Normalize(request.SignalType),
            PayloadJson = NormalizeJson(request.PayloadJson),
            CreatedAt = DateTimeOffset.UtcNow
        };
        db.MeetingSignals.Add(signal);
        await db.SaveChangesAsync(cancellationToken);
        return Result<MeetingSignalDto>.Success(Map(signal));
    }

    public async Task<Result<MeetingTranscriptDto>> AddTranscriptAsync(Guid roomId, AddMeetingTranscriptRequest request, CancellationToken cancellationToken)
    {
        if (!await db.MeetingRooms.AnyAsync(x => x.Id == roomId, cancellationToken))
        {
            return Result<MeetingTranscriptDto>.Failure("Salle de meeting introuvable.");
        }

        return await AddTranscriptForRoomAsync(roomId, request, cancellationToken);
    }

    public async Task<Result<MeetingTranscriptDto>> AddPublicTranscriptAsync(string token, AddMeetingTranscriptRequest request, CancellationToken cancellationToken)
    {
        var roomResult = await FindPublicRoomAsync(token, cancellationToken);
        if (!roomResult.Succeeded)
        {
            return Result<MeetingTranscriptDto>.Failure(roomResult.Error!);
        }

        return await AddTranscriptForRoomAsync(roomResult.Value!.Id, request, cancellationToken);
    }

    private async Task<Result<MeetingTranscriptDto>> AddTranscriptForRoomAsync(Guid roomId, AddMeetingTranscriptRequest request, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.Text))
        {
            return Result<MeetingTranscriptDto>.Failure("Texte de transcription obligatoire.");
        }

        var transcript = new MeetingTranscript
        {
            MeetingRoomId = roomId,
            UserId = currentUser.UserId,
            ClientId = Normalize(request.ClientId),
            SpeakerName = Normalize(request.SpeakerName),
            SourceLanguage = NormalizeLanguage(request.SourceLanguage),
            Text = request.Text.Trim(),
            TranslatedText = string.IsNullOrWhiteSpace(request.TranslatedText) ? null : request.TranslatedText.Trim(),
            IsFinal = request.IsFinal,
            CreatedAt = DateTimeOffset.UtcNow
        };
        db.MeetingTranscripts.Add(transcript);
        await db.SaveChangesAsync(cancellationToken);
        return Result<MeetingTranscriptDto>.Success(Map(transcript));
    }

    public async Task<Result<MeetingChatMessageDto>> AddChatMessageAsync(Guid roomId, AddMeetingChatMessageRequest request, CancellationToken cancellationToken)
    {
        if (!await db.MeetingRooms.AnyAsync(x => x.Id == roomId, cancellationToken))
        {
            return Result<MeetingChatMessageDto>.Failure("Salle de meeting introuvable.");
        }

        return await AddChatMessageForRoomAsync(roomId, request, cancellationToken);
    }

    public async Task<Result<MeetingChatMessageDto>> AddPublicChatMessageAsync(string token, AddMeetingChatMessageRequest request, CancellationToken cancellationToken)
    {
        var roomResult = await FindPublicRoomAsync(token, cancellationToken);
        if (!roomResult.Succeeded)
        {
            return Result<MeetingChatMessageDto>.Failure(roomResult.Error!);
        }

        return await AddChatMessageForRoomAsync(roomResult.Value!.Id, request, cancellationToken);
    }

    private async Task<Result<MeetingChatMessageDto>> AddChatMessageForRoomAsync(Guid roomId, AddMeetingChatMessageRequest request, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.Message) && string.IsNullOrWhiteSpace(request.FileBase64))
        {
            return Result<MeetingChatMessageDto>.Failure("Message ou piece jointe obligatoire.");
        }

        StoredFile? stored = null;
        if (!string.IsNullOrWhiteSpace(request.FileBase64))
        {
            var bytesResult = DecodeBase64(request.FileBase64);
            if (!bytesResult.Succeeded)
            {
                return Result<MeetingChatMessageDto>.Failure(bytesResult.Error!);
            }

            var bytes = bytesResult.Value!;
            if (bytes.Length > ChatAttachmentMaxBytes)
            {
                return Result<MeetingChatMessageDto>.Failure("La piece jointe depasse 5 Mo.");
            }

            await using var stream = new MemoryStream(bytes);
            stored = await fileStorage.SaveAsync("meeting-chat", request.FileName ?? $"piece-jointe-{Guid.NewGuid():N}.bin", stream, cancellationToken);
        }

        var message = new MeetingChatMessage
        {
            MeetingRoomId = roomId,
            UserId = currentUser.UserId,
            ClientId = Normalize(request.ClientId),
            SenderName = Normalize(request.SenderName),
            Message = request.Message?.Trim() ?? string.Empty,
            FileName = stored is null ? null : Normalize(request.FileName ?? "piece-jointe.bin"),
            FileMimeType = stored is null ? null : Normalize(request.FileMimeType ?? "application/octet-stream"),
            FileSize = stored?.Size,
            FileStoragePath = stored?.StoragePath,
            CreatedAt = DateTimeOffset.UtcNow
        };
        db.MeetingChatMessages.Add(message);
        await db.SaveChangesAsync(cancellationToken);
        return Result<MeetingChatMessageDto>.Success(Map(message));
    }

    public async Task<Result> LeaveAsync(Guid roomId, LeaveMeetingRoomRequest request, CancellationToken cancellationToken)
    {
        var participants = await db.MeetingParticipants
            .Where(x => x.MeetingRoomId == roomId && x.ClientId == request.ClientId)
            .ToListAsync(cancellationToken);
        db.MeetingParticipants.RemoveRange(participants);
        await db.SaveChangesAsync(cancellationToken);
        return Result.Success();
    }

    public async Task<Result> LeavePublicAsync(string token, LeaveMeetingRoomRequest request, CancellationToken cancellationToken)
    {
        var roomResult = await FindPublicRoomAsync(token, cancellationToken);
        if (!roomResult.Succeeded)
        {
            return Result.Failure(roomResult.Error!);
        }

        return await LeaveAsync(roomResult.Value!.Id, request, cancellationToken);
    }

    public async Task<Result> DeleteAsync(Guid roomId, CancellationToken cancellationToken)
    {
        var room = await db.MeetingRooms.FirstOrDefaultAsync(x => x.Id == roomId, cancellationToken);
        if (room is null)
        {
            return Result.Failure("Salle de meeting introuvable.");
        }

        var messages = await db.MeetingChatMessages.Where(x => x.MeetingRoomId == roomId).ToListAsync(cancellationToken);
        foreach (var message in messages.Where(x => !string.IsNullOrWhiteSpace(x.FileStoragePath)))
        {
            await fileStorage.DeleteAsync(message.FileStoragePath!, cancellationToken);
        }

        db.MeetingSignals.RemoveRange(await db.MeetingSignals.Where(x => x.MeetingRoomId == roomId).ToListAsync(cancellationToken));
        db.MeetingTranscripts.RemoveRange(await db.MeetingTranscripts.Where(x => x.MeetingRoomId == roomId).ToListAsync(cancellationToken));
        db.MeetingChatMessages.RemoveRange(messages);
        db.MeetingParticipants.RemoveRange(await db.MeetingParticipants.Where(x => x.MeetingRoomId == roomId).ToListAsync(cancellationToken));
        db.CalendarEventLinks.RemoveRange(await db.CalendarEventLinks.Where(x => x.Module == "meeting" && x.EntityId == roomId).ToListAsync(cancellationToken));
        db.MeetingRooms.Remove(room);
        await db.SaveChangesAsync(cancellationToken);
        return Result.Success();
    }

    public async Task<Result<(Stream Content, string FileName, string MimeType)>> OpenChatAttachmentAsync(Guid messageId, CancellationToken cancellationToken)
    {
        var message = await db.MeetingChatMessages.AsNoTracking().FirstOrDefaultAsync(x => x.Id == messageId, cancellationToken);
        if (message?.FileStoragePath is null)
        {
            return Result<(Stream, string, string)>.Failure("Piece jointe introuvable.");
        }

        var stream = await fileStorage.OpenReadAsync(message.FileStoragePath, cancellationToken);
        return Result<(Stream, string, string)>.Success((stream, message.FileName ?? "piece-jointe.bin", message.FileMimeType ?? "application/octet-stream"));
    }

    public async Task<Result<(Stream Content, string FileName, string MimeType)>> OpenPublicChatAttachmentAsync(string token, Guid messageId, CancellationToken cancellationToken)
    {
        var roomResult = await FindPublicRoomAsync(token, cancellationToken);
        if (!roomResult.Succeeded)
        {
            return Result<(Stream, string, string)>.Failure(roomResult.Error!);
        }

        var message = await db.MeetingChatMessages.AsNoTracking().FirstOrDefaultAsync(x => x.Id == messageId && x.MeetingRoomId == roomResult.Value!.Id, cancellationToken);
        if (message?.FileStoragePath is null)
        {
            return Result<(Stream, string, string)>.Failure("Piece jointe introuvable.");
        }

        var stream = await fileStorage.OpenReadAsync(message.FileStoragePath, cancellationToken);
        return Result<(Stream, string, string)>.Success((stream, message.FileName ?? "piece-jointe.bin", message.FileMimeType ?? "application/octet-stream"));
    }

    private async Task<Result<MeetingRoom>> FindPublicRoomAsync(string? token, CancellationToken cancellationToken)
    {
        var normalizedToken = Normalize(token);
        if (string.IsNullOrWhiteSpace(normalizedToken))
        {
            return Result<MeetingRoom>.Failure("Lien invite obligatoire.");
        }

        var room = await db.MeetingRooms.FirstOrDefaultAsync(x => x.InviteToken == normalizedToken, cancellationToken);
        if (room is null)
        {
            return Result<MeetingRoom>.Failure("Lien Meet invalide ou expire.");
        }

        if (room.ScheduledStartAt.HasValue && room.ScheduledStartAt.Value > DateTimeOffset.UtcNow.AddMinutes(10))
        {
            return Result<MeetingRoom>.Failure("Le lien invite sera ouvert 10 minutes avant le rendez-vous.");
        }

        if (room.IsLocked)
        {
            return Result<MeetingRoom>.Failure("Cette salle est verrouillee.");
        }

        return Result<MeetingRoom>.Success(room);
    }

    private async Task<MeetingRoomStateDto> MapStateAsync(MeetingRoom room, string? clientId, DateTimeOffset? since, CancellationToken cancellationToken)
    {
        var syncCursor = DateTimeOffset.UtcNow;
        var activeSince = DateTimeOffset.UtcNow.AddSeconds(-PresenceTtlSeconds);
        var roomDto = (await MapRoomsAsync([room], cancellationToken))[0];

        var participantEntities = await db.MeetingParticipants.AsNoTracking()
            .Where(x => x.MeetingRoomId == room.Id && x.LastSeenAt >= activeSince)
            .OrderBy(x => x.JoinedAt)
            .ToListAsync(cancellationToken);
        var participants = participantEntities.Select(Map).ToList();

        var signalQuery = db.MeetingSignals.AsNoTracking().Where(x => x.MeetingRoomId == room.Id);
        if (!string.IsNullOrWhiteSpace(clientId))
        {
            signalQuery = signalQuery.Where(x => x.RecipientClientId == clientId || x.RecipientClientId == "*");
        }

        if (since.HasValue)
        {
            signalQuery = signalQuery.Where(x => x.CreatedAt > since.Value);
        }

        var signalEntities = await signalQuery.OrderBy(x => x.CreatedAt).Take(200).ToListAsync(cancellationToken);
        var signals = signalEntities.Select(Map).ToList();

        var transcriptEntities = await db.MeetingTranscripts.AsNoTracking()
            .Where(x => x.MeetingRoomId == room.Id && (!since.HasValue || x.CreatedAt > since.Value))
            .OrderBy(x => x.CreatedAt)
            .Take(300)
            .ToListAsync(cancellationToken);
        var transcripts = transcriptEntities.Select(Map).ToList();

        var messageEntities = await db.MeetingChatMessages.AsNoTracking()
            .Where(x => x.MeetingRoomId == room.Id && (!since.HasValue || x.CreatedAt > since.Value))
            .OrderBy(x => x.CreatedAt)
            .Take(300)
            .ToListAsync(cancellationToken);
        var messages = messageEntities.Select(Map).ToList();

        return new MeetingRoomStateDto(roomDto, participants, signals, transcripts, messages, syncCursor);
    }

    private async Task<IReadOnlyList<MeetingRoomDto>> MapRoomsAsync(IReadOnlyList<MeetingRoom> rooms, CancellationToken cancellationToken)
    {
        var userIds = rooms.Select(x => x.CreatedByUserId).OfType<Guid>().Distinct().ToList();
        var users = await db.Users.AsNoTracking()
            .Where(x => userIds.Contains(x.Id))
            .Select(x => new { x.Id, x.DisplayName })
            .ToDictionaryAsync(x => x.Id, x => x.DisplayName, cancellationToken);

        return rooms.Select(x => new MeetingRoomDto(
            x.Id,
            x.Code,
            x.Title,
            x.CalendarEventId,
            x.InviteToken,
            x.ScheduledStartAt,
            x.CreatedAt,
            x.LastActivityAt,
            x.IsLocked,
            x.CreatedByUserId.HasValue && users.TryGetValue(x.CreatedByUserId.Value, out var name) ? name : null)).ToList();
    }

    private void UpsertParticipant(Guid roomId, string clientId, string? displayName, string sourceLanguage, string targetLanguage, MeetingMediaStateDto? media)
    {
        var now = DateTimeOffset.UtcNow;
        var normalizedClientId = Normalize(clientId);
        var participant = db.MeetingParticipants.Local.FirstOrDefault(x => x.MeetingRoomId == roomId && x.ClientId == normalizedClientId)
            ?? db.MeetingParticipants.FirstOrDefault(x => x.MeetingRoomId == roomId && x.ClientId == normalizedClientId);

        if (participant is null)
        {
            participant = new MeetingParticipant
            {
                MeetingRoomId = roomId,
                ClientId = normalizedClientId,
                UserId = currentUser.UserId,
                JoinedAt = now
            };
            db.MeetingParticipants.Add(participant);
        }

        participant.DisplayName = Normalize(displayName ?? currentUser.Email ?? "Invite");
        participant.SourceLanguage = NormalizeLanguage(sourceLanguage);
        participant.TargetLanguage = NormalizeLanguage(targetLanguage);
        participant.MicrophoneEnabled = media?.MicrophoneEnabled ?? participant.MicrophoneEnabled;
        participant.CameraEnabled = media?.CameraEnabled ?? participant.CameraEnabled;
        participant.ScreenEnabled = media?.ScreenEnabled ?? participant.ScreenEnabled;
        participant.ConnectionState = Normalize(media?.ConnectionState ?? "Connected");
        participant.LastSeenAt = now;
    }

    private async Task CleanupSignalsAsync(CancellationToken cancellationToken)
    {
        var threshold = DateTimeOffset.UtcNow.AddMinutes(-SignalTtlMinutes);
        var expired = await db.MeetingSignals.Where(x => x.CreatedAt < threshold).ToListAsync(cancellationToken);
        db.MeetingSignals.RemoveRange(expired);
    }

    private async Task<string> GenerateUniqueCodeAsync(CancellationToken cancellationToken)
    {
        for (var attempt = 0; attempt < 12; attempt++)
        {
            var code = $"MEET-{RandomNumberGenerator.GetInt32(100000, 999999)}";
            if (!await db.MeetingRooms.AnyAsync(x => x.Code == code, cancellationToken))
            {
                return code;
            }
        }

        return $"MEET-{Guid.NewGuid():N}"[..13].ToUpperInvariant();
    }

    private static string GenerateToken()
        => Convert.ToHexString(RandomNumberGenerator.GetBytes(24)).ToLowerInvariant();

    private static Result<byte[]> DecodeBase64(string value)
    {
        try
        {
            var normalized = value.Contains(',', StringComparison.Ordinal) ? value[(value.IndexOf(',', StringComparison.Ordinal) + 1)..] : value;
            return Result<byte[]>.Success(Convert.FromBase64String(normalized));
        }
        catch (FormatException)
        {
            return Result<byte[]>.Failure("Piece jointe invalide.");
        }
    }

    private static string Normalize(string? value)
        => string.IsNullOrWhiteSpace(value) ? string.Empty : value.Trim();

    private static List<string> SplitConfigUrls(string? value)
        => string.IsNullOrWhiteSpace(value)
            ? new List<string>()
            : value.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
                .Where(x => !string.IsNullOrWhiteSpace(x))
                .ToList();

    private static string? NormalizeConfigValue(string? value)
        => string.IsNullOrWhiteSpace(value) ? null : value.Trim();

    private static string NormalizeLanguage(string? value)
    {
        var normalized = Normalize(value);
        return Languages.Any(x => x.Code.Equals(normalized, StringComparison.OrdinalIgnoreCase)) ? normalized : "fr-FR";
    }

    private static string NormalizeJson(string? value)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            return "{}";
        }

        try
        {
            using var _ = JsonDocument.Parse(value);
            return value.Trim();
        }
        catch (JsonException)
        {
            return "{}";
        }
    }

    private static MeetingParticipantDto Map(MeetingParticipant participant)
        => new(participant.Id, participant.UserId, participant.ClientId, participant.DisplayName, participant.SourceLanguage, participant.TargetLanguage, participant.MicrophoneEnabled, participant.CameraEnabled, participant.ScreenEnabled, participant.ConnectionState, participant.JoinedAt, participant.LastSeenAt);

    private static MeetingSignalDto Map(MeetingSignal signal)
        => new(signal.Id, signal.SenderClientId, signal.RecipientClientId, signal.SignalType, signal.PayloadJson, signal.CreatedAt);

    private static MeetingTranscriptDto Map(MeetingTranscript transcript)
        => new(transcript.Id, transcript.UserId, transcript.ClientId, transcript.SpeakerName, transcript.SourceLanguage, transcript.Text, transcript.TranslatedText, transcript.IsFinal, transcript.CreatedAt);

    private static MeetingChatMessageDto Map(MeetingChatMessage message)
        => new(message.Id, message.UserId, message.ClientId, message.SenderName, message.Message, message.FileName, message.FileMimeType, message.FileSize, !string.IsNullOrWhiteSpace(message.FileStoragePath), message.CreatedAt);
}
