namespace Erp.Application.Documents;

public sealed record DriveFolderDto(Guid Id, Guid? ParentFolderId, string Name, bool IsTrashed, DateTimeOffset CreatedAt);
public sealed record DriveItemDto(Guid Id, Guid? FolderId, string Name, string MimeType, long Size, int CurrentVersion, bool IsTrashed, DateTimeOffset CreatedAt);
public sealed record DriveUploadResult(DriveItemDto Item, string Sha256);
public sealed record CreateFolderRequest(Guid? ParentFolderId, string Name);
public sealed record RenameDriveItemRequest(string Name);

