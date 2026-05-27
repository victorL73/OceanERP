using Erp.Application.Common;

namespace Erp.Application.ExpenseReports;

public sealed record ExpenseReportDto(
    Guid Id,
    string Number,
    Guid EmployeeId,
    string EmployeeName,
    string Title,
    DateOnly ExpenseDate,
    string Status,
    string? Comment,
    decimal TotalAmount,
    decimal VatAmount,
    DateTimeOffset SubmittedAt,
    DateTimeOffset? ApprovedAt,
    DateTimeOffset? RefusedAt,
    DateTimeOffset? ReimbursedAt,
    IReadOnlyList<ExpenseReportLineDto> Lines,
    IReadOnlyList<ExpenseReportAttachmentDto> Attachments,
    IReadOnlyList<ExpenseReportStatusHistoryDto> History);

public sealed record ExpenseReportLineDto(
    Guid Id,
    string Label,
    string Category,
    decimal Amount,
    decimal VatRate,
    DateOnly ExpenseDate,
    string? ReceiptFileName);

public sealed record ExpenseReportStatusHistoryDto(
    Guid Id,
    string Status,
    string? Comment,
    string? ChangedBy,
    DateTimeOffset ChangedAt);

public sealed record ExpenseReportAttachmentDto(
    Guid Id,
    string FileName,
    string ContentType,
    long SizeBytes,
    Guid? UploadedByUserId,
    string? UploadedBy,
    DateTimeOffset UploadedAt);

public sealed record ExpenseReportAttachmentUpload(
    string FileName,
    string ContentType,
    long SizeBytes,
    Stream Content);

public sealed record ExpenseReportAttachmentDownload(
    string FileName,
    string ContentType,
    Stream Content);

public sealed record CreateExpenseReportRequest(
    string Title,
    DateOnly ExpenseDate,
    string? Comment,
    IReadOnlyList<CreateExpenseReportLineRequest> Lines);

public sealed record CreateExpenseReportLineRequest(
    string Label,
    string Category,
    decimal Amount,
    decimal VatRate,
    DateOnly ExpenseDate,
    string? ReceiptFileName);

public sealed record UpdateExpenseReportRequest(
    string Title,
    DateOnly ExpenseDate,
    string? Comment,
    IReadOnlyList<CreateExpenseReportLineRequest> Lines);

public sealed record ChangeExpenseReportStatusRequest(string Status, string? Comment);

public interface IExpenseReportService
{
    Task<IReadOnlyList<ExpenseReportDto>> ListAsync(CancellationToken cancellationToken);

    Task<Result<ExpenseReportDto>> GetAsync(Guid id, CancellationToken cancellationToken);

    Task<Result<ExpenseReportDto>> CreateAsync(CreateExpenseReportRequest request, CancellationToken cancellationToken);

    Task<Result<ExpenseReportDto>> UpdateAsync(Guid id, UpdateExpenseReportRequest request, CancellationToken cancellationToken);

    Task<Result<ExpenseReportDto>> ChangeStatusAsync(Guid id, ChangeExpenseReportStatusRequest request, CancellationToken cancellationToken);

    Task<Result<IReadOnlyList<ExpenseReportAttachmentDto>>> AddAttachmentsAsync(Guid id, IReadOnlyList<ExpenseReportAttachmentUpload> files, CancellationToken cancellationToken);

    Task<Result<IReadOnlyList<ExpenseReportAttachmentDto>>> ListAttachmentsAsync(Guid id, CancellationToken cancellationToken);

    Task<Result<ExpenseReportAttachmentDownload>> OpenAttachmentAsync(Guid id, Guid attachmentId, CancellationToken cancellationToken);

    Task<Result> DeleteAttachmentAsync(Guid id, Guid attachmentId, CancellationToken cancellationToken);
}
