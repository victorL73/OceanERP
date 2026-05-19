using Erp.Application.Common;

namespace Erp.Application.Meetings;

public sealed record MeetingLanguageDto(string Code, string Label);

public sealed record MeetingRoomDto(
    Guid Id,
    string Code,
    string Title,
    Guid? CalendarEventId,
    string? InviteToken,
    DateTimeOffset? ScheduledStartAt,
    DateTimeOffset CreatedAt,
    DateTimeOffset LastActivityAt,
    bool IsLocked,
    string? CreatedByName);

public sealed record MeetingParticipantDto(
    Guid Id,
    Guid? UserId,
    string ClientId,
    string DisplayName,
    string SourceLanguage,
    string TargetLanguage,
    bool MicrophoneEnabled,
    bool CameraEnabled,
    bool ScreenEnabled,
    string ConnectionState,
    DateTimeOffset JoinedAt,
    DateTimeOffset LastSeenAt);

public sealed record MeetingSignalDto(
    Guid Id,
    string SenderClientId,
    string RecipientClientId,
    string SignalType,
    string PayloadJson,
    DateTimeOffset CreatedAt);

public sealed record MeetingTranscriptDto(
    Guid Id,
    Guid? UserId,
    string ClientId,
    string SpeakerName,
    string SourceLanguage,
    string Text,
    string? TranslatedText,
    bool IsFinal,
    DateTimeOffset CreatedAt);

public sealed record MeetingChatMessageDto(
    Guid Id,
    Guid? UserId,
    string ClientId,
    string SenderName,
    string Message,
    string? FileName,
    string? FileMimeType,
    long? FileSize,
    bool HasFile,
    DateTimeOffset CreatedAt);

public sealed record MeetingDashboardDto(
    IReadOnlyList<MeetingRoomDto> Rooms,
    IReadOnlyList<MeetingLanguageDto> Languages,
    long ChatAttachmentMaxBytes);

public sealed record MeetingRoomStateDto(
    MeetingRoomDto Room,
    IReadOnlyList<MeetingParticipantDto> Participants,
    IReadOnlyList<MeetingSignalDto> Signals,
    IReadOnlyList<MeetingTranscriptDto> Transcripts,
    IReadOnlyList<MeetingChatMessageDto> ChatMessages,
    DateTimeOffset ServerTime);

public sealed record MeetingMediaStateDto(bool MicrophoneEnabled, bool CameraEnabled, bool ScreenEnabled, string? ConnectionState = null);

public sealed record CreateMeetingRoomRequest(
    string Title,
    DateTimeOffset? ScheduledStartAt = null,
    Guid? CalendarEventId = null,
    string? ClientId = null,
    string? DisplayName = null,
    string SourceLanguage = "fr-FR",
    string TargetLanguage = "en-US",
    MeetingMediaStateDto? Media = null);

public sealed record JoinMeetingRoomRequest(
    string CodeOrToken,
    string ClientId,
    string DisplayName,
    string SourceLanguage = "fr-FR",
    string TargetLanguage = "en-US",
    MeetingMediaStateDto? Media = null);

public sealed record SyncMeetingRoomRequest(
    string ClientId,
    string DisplayName,
    string SourceLanguage = "fr-FR",
    string TargetLanguage = "en-US",
    MeetingMediaStateDto? Media = null,
    DateTimeOffset? Since = null);

public sealed record SendMeetingSignalRequest(string SenderClientId, string RecipientClientId, string SignalType, string PayloadJson);

public sealed record AddMeetingTranscriptRequest(
    string ClientId,
    string SpeakerName,
    string Text,
    string SourceLanguage = "fr-FR",
    string? TranslatedText = null,
    bool IsFinal = true);

public sealed record AddMeetingChatMessageRequest(
    string ClientId,
    string SenderName,
    string Message,
    string? FileName = null,
    string? FileMimeType = null,
    string? FileBase64 = null);

public sealed record LeaveMeetingRoomRequest(string ClientId);

public interface IMeetingService
{
    Task<MeetingDashboardDto> DashboardAsync(CancellationToken cancellationToken);
    Task<Result<MeetingRoomStateDto>> GetAsync(Guid roomId, string? clientId, DateTimeOffset? since, CancellationToken cancellationToken);
    Task<Result<MeetingRoomStateDto>> CreateAsync(CreateMeetingRoomRequest request, CancellationToken cancellationToken);
    Task<Result<MeetingRoomStateDto>> JoinAsync(JoinMeetingRoomRequest request, CancellationToken cancellationToken);
    Task<Result<string>> EnsureInviteAsync(Guid roomId, CancellationToken cancellationToken);
    Task<Result<MeetingRoomStateDto>> SyncAsync(Guid roomId, SyncMeetingRoomRequest request, CancellationToken cancellationToken);
    Task<Result<MeetingSignalDto>> SendSignalAsync(Guid roomId, SendMeetingSignalRequest request, CancellationToken cancellationToken);
    Task<Result<MeetingTranscriptDto>> AddTranscriptAsync(Guid roomId, AddMeetingTranscriptRequest request, CancellationToken cancellationToken);
    Task<Result<MeetingChatMessageDto>> AddChatMessageAsync(Guid roomId, AddMeetingChatMessageRequest request, CancellationToken cancellationToken);
    Task<Result> LeaveAsync(Guid roomId, LeaveMeetingRoomRequest request, CancellationToken cancellationToken);
    Task<Result> DeleteAsync(Guid roomId, CancellationToken cancellationToken);
    Task<Result<(Stream Content, string FileName, string MimeType)>> OpenChatAttachmentAsync(Guid messageId, CancellationToken cancellationToken);
}
