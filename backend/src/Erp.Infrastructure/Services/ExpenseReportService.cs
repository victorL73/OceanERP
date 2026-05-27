using Erp.Application.Common;
using Erp.Application.ExpenseReports;
using Erp.Domain.Auth;
using Erp.Domain.FutureModules;
using Erp.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Erp.Infrastructure.Services;

public sealed class ExpenseReportService(ErpDbContext db, ICurrentUserService currentUser) : IExpenseReportService
{
    private static readonly HashSet<string> AllowedStatuses = new(StringComparer.OrdinalIgnoreCase)
    {
        "Sent",
        "Approved",
        "Refused",
        "Reimbursed"
    };

    public async Task<IReadOnlyList<ExpenseReportDto>> ListAsync(CancellationToken cancellationToken)
    {
        var reports = await db.ExpenseReports
            .AsNoTracking()
            .OrderByDescending(x => x.SubmittedAt)
            .ToListAsync(cancellationToken);

        return await MapAsync(reports, cancellationToken);
    }

    public async Task<Result<ExpenseReportDto>> GetAsync(Guid id, CancellationToken cancellationToken)
    {
        var report = await db.ExpenseReports
            .AsNoTracking()
            .FirstOrDefaultAsync(x => x.Id == id, cancellationToken);

        if (report is null)
        {
            return Result<ExpenseReportDto>.Failure("Note de frais introuvable.");
        }

        var mapped = await MapAsync(new[] { report }, cancellationToken);
        return Result<ExpenseReportDto>.Success(mapped[0]);
    }

    public async Task<Result<ExpenseReportDto>> CreateAsync(CreateExpenseReportRequest request, CancellationToken cancellationToken)
    {
        var userResult = await ResolveCurrentUserAsync(cancellationToken);
        if (!userResult.Succeeded)
        {
            return Result<ExpenseReportDto>.Failure(userResult.Error!);
        }

        var validation = ValidateLines(request.Lines);
        if (!validation.Succeeded)
        {
            return Result<ExpenseReportDto>.Failure(validation.Error!);
        }

        var user = userResult.Value!;
        var report = new ExpenseReport
        {
            Id = Guid.NewGuid(),
            Number = await NextNumberAsync(cancellationToken),
            EmployeeId = user.Id,
            EmployeeName = DisplayName(user),
            Title = Clean(request.Title, "Note de frais", 240),
            ExpenseDate = request.ExpenseDate,
            Status = "Sent",
            Comment = TrimOrNull(request.Comment),
            SubmittedAt = DateTimeOffset.UtcNow
        };

        db.ExpenseReports.Add(report);
        foreach (var lineRequest in request.Lines)
        {
            db.ExpenseReportLines.Add(BuildLine(report.Id, lineRequest));
        }

        db.ExpenseReportStatusHistories.Add(new ExpenseReportStatusHistory
        {
            Id = Guid.NewGuid(),
            ExpenseReportId = report.Id,
            Status = report.Status,
            Comment = report.Comment,
            ChangedByUserId = user.Id,
            ChangedAt = DateTimeOffset.UtcNow
        });

        await db.SaveChangesAsync(cancellationToken);
        return await GetAsync(report.Id, cancellationToken);
    }

    public async Task<Result<ExpenseReportDto>> UpdateAsync(Guid id, UpdateExpenseReportRequest request, CancellationToken cancellationToken)
    {
        var report = await db.ExpenseReports.FirstOrDefaultAsync(x => x.Id == id, cancellationToken);
        if (report is null)
        {
            return Result<ExpenseReportDto>.Failure("Note de frais introuvable.");
        }

        if (report.Status.Equals("Reimbursed", StringComparison.OrdinalIgnoreCase))
        {
            return Result<ExpenseReportDto>.Failure("Une note remboursee ne peut plus etre modifiee.");
        }

        var validation = ValidateLines(request.Lines);
        if (!validation.Succeeded)
        {
            return Result<ExpenseReportDto>.Failure(validation.Error!);
        }

        report.Title = Clean(request.Title, "Note de frais", 240);
        report.ExpenseDate = request.ExpenseDate;
        report.Comment = TrimOrNull(request.Comment);

        var oldLines = await db.ExpenseReportLines
            .Where(x => x.ExpenseReportId == id)
            .ToListAsync(cancellationToken);
        db.ExpenseReportLines.RemoveRange(oldLines);

        foreach (var lineRequest in request.Lines)
        {
            db.ExpenseReportLines.Add(BuildLine(id, lineRequest));
        }

        await db.SaveChangesAsync(cancellationToken);
        return await GetAsync(id, cancellationToken);
    }

    public async Task<Result<ExpenseReportDto>> ChangeStatusAsync(Guid id, ChangeExpenseReportStatusRequest request, CancellationToken cancellationToken)
    {
        var status = NormalizeStatus(request.Status);
        if (!AllowedStatuses.Contains(status))
        {
            return Result<ExpenseReportDto>.Failure("Statut de note de frais invalide.");
        }

        var report = await db.ExpenseReports.FirstOrDefaultAsync(x => x.Id == id, cancellationToken);
        if (report is null)
        {
            return Result<ExpenseReportDto>.Failure("Note de frais introuvable.");
        }

        var userId = currentUser.UserId;
        var now = DateTimeOffset.UtcNow;
        report.Status = status;

        if (status == "Sent")
        {
            report.ApprovedAt = null;
            report.ApprovedByUserId = null;
            report.RefusedAt = null;
            report.RefusedByUserId = null;
            report.ReimbursedAt = null;
            report.ReimbursedByUserId = null;
        }
        else if (status == "Approved")
        {
            report.ApprovedAt = now;
            report.ApprovedByUserId = userId;
            report.RefusedAt = null;
            report.RefusedByUserId = null;
        }
        else if (status == "Refused")
        {
            report.RefusedAt = now;
            report.RefusedByUserId = userId;
        }
        else if (status == "Reimbursed")
        {
            report.ReimbursedAt = now;
            report.ReimbursedByUserId = userId;
        }

        db.ExpenseReportStatusHistories.Add(new ExpenseReportStatusHistory
        {
            Id = Guid.NewGuid(),
            ExpenseReportId = id,
            Status = status,
            Comment = TrimOrNull(request.Comment),
            ChangedByUserId = userId,
            ChangedAt = now
        });

        await db.SaveChangesAsync(cancellationToken);
        return await GetAsync(id, cancellationToken);
    }

    private async Task<Result<User>> ResolveCurrentUserAsync(CancellationToken cancellationToken)
    {
        if (currentUser.UserId is null)
        {
            return Result<User>.Failure("Utilisateur courant introuvable.");
        }

        var user = await db.Users.AsNoTracking().FirstOrDefaultAsync(x => x.Id == currentUser.UserId.Value, cancellationToken);
        return user is null
            ? Result<User>.Failure("Utilisateur courant introuvable.")
            : Result<User>.Success(user);
    }

    private async Task<string> NextNumberAsync(CancellationToken cancellationToken)
    {
        var year = DateTimeOffset.UtcNow.Year;
        var prefix = $"NF-{year}-";
        var count = await db.ExpenseReports.CountAsync(x => x.Number.StartsWith(prefix), cancellationToken);
        return $"{prefix}{count + 1:0000}";
    }

    private static Result ValidateLines(IReadOnlyList<CreateExpenseReportLineRequest>? lines)
    {
        if (lines is null || lines.Count == 0)
        {
            return Result.Failure("Au moins une ligne de frais est obligatoire.");
        }

        foreach (var line in lines)
        {
            if (string.IsNullOrWhiteSpace(line.Label))
            {
                return Result.Failure("Chaque ligne doit avoir un libelle.");
            }

            if (line.Amount <= 0m)
            {
                return Result.Failure("Chaque ligne doit avoir un montant superieur a zero.");
            }

            if (line.VatRate < 0m || line.VatRate > 100m)
            {
                return Result.Failure("La TVA doit etre comprise entre 0 et 100%.");
            }
        }

        return Result.Success();
    }

    private async Task<IReadOnlyList<ExpenseReportDto>> MapAsync(IReadOnlyList<ExpenseReport> reports, CancellationToken cancellationToken)
    {
        if (reports.Count == 0)
        {
            return Array.Empty<ExpenseReportDto>();
        }

        var ids = reports.Select(x => x.Id).ToList();
        var lines = await db.ExpenseReportLines
            .AsNoTracking()
            .Where(x => ids.Contains(x.ExpenseReportId))
            .OrderBy(x => x.ExpenseDate)
            .ThenBy(x => x.Label)
            .ToListAsync(cancellationToken);
        var history = await db.ExpenseReportStatusHistories
            .AsNoTracking()
            .Where(x => ids.Contains(x.ExpenseReportId))
            .OrderByDescending(x => x.ChangedAt)
            .ToListAsync(cancellationToken);
        var userIds = history
            .Where(x => x.ChangedByUserId.HasValue)
            .Select(x => x.ChangedByUserId!.Value)
            .Distinct()
            .ToList();
        var users = await db.Users
            .AsNoTracking()
            .Where(x => userIds.Contains(x.Id))
            .ToDictionaryAsync(x => x.Id, DisplayName, cancellationToken);

        return reports.Select(report =>
        {
            var reportLines = lines.Where(x => x.ExpenseReportId == report.Id).ToList();
            var gross = reportLines.Sum(x => x.Amount);
            var vat = reportLines.Sum(x => VatFromGross(x.Amount, x.VatRate));
            var reportHistory = history.Where(x => x.ExpenseReportId == report.Id).ToList();

            return new ExpenseReportDto(
                report.Id,
                report.Number,
                report.EmployeeId,
                report.EmployeeName,
                report.Title,
                report.ExpenseDate,
                report.Status,
                report.Comment,
                Math.Round(gross, 2, MidpointRounding.AwayFromZero),
                Math.Round(vat, 2, MidpointRounding.AwayFromZero),
                report.SubmittedAt,
                report.ApprovedAt,
                report.RefusedAt,
                report.ReimbursedAt,
                reportLines.Select(line => new ExpenseReportLineDto(
                    line.Id,
                    line.Label,
                    line.Category,
                    line.Amount,
                    line.VatRate,
                    line.ExpenseDate,
                    line.ReceiptFileName)).ToList(),
                reportHistory.Select(item => new ExpenseReportStatusHistoryDto(
                    item.Id,
                    item.Status,
                    item.Comment,
                    item.ChangedByUserId.HasValue && users.TryGetValue(item.ChangedByUserId.Value, out var userName) ? userName : null,
                    item.ChangedAt)).ToList());
        }).ToList();
    }

    private static ExpenseReportLine BuildLine(Guid reportId, CreateExpenseReportLineRequest request)
    {
        return new ExpenseReportLine
        {
            Id = Guid.NewGuid(),
            ExpenseReportId = reportId,
            Label = Clean(request.Label, "Frais", 240),
            Category = Clean(request.Category, "General", 120),
            Amount = Math.Round(request.Amount, 2, MidpointRounding.AwayFromZero),
            VatRate = Math.Round(request.VatRate, 2, MidpointRounding.AwayFromZero),
            ExpenseDate = request.ExpenseDate,
            ReceiptFileName = TrimOrNull(request.ReceiptFileName)
        };
    }

    private static string NormalizeStatus(string status)
    {
        var normalized = (status ?? string.Empty).Trim();
        return normalized.ToLowerInvariant() switch
        {
            "envoye" or "envoyee" or "sent" => "Sent",
            "approuve" or "approuvee" or "approved" => "Approved",
            "refuse" or "refusee" or "refused" => "Refused",
            "rembourse" or "remboursee" or "reimbursed" => "Reimbursed",
            _ => normalized
        };
    }

    private static decimal VatFromGross(decimal gross, decimal vatRate)
    {
        return gross <= 0m || vatRate <= 0m
            ? 0m
            : Math.Round(gross * vatRate / (100m + vatRate), 2, MidpointRounding.AwayFromZero);
    }

    private static string DisplayName(User user) => string.IsNullOrWhiteSpace(user.DisplayName) ? user.Email : user.DisplayName;

    private static string Clean(string? value, string fallback, int maxLength)
    {
        var cleaned = string.IsNullOrWhiteSpace(value) ? fallback : value.Trim();
        return cleaned.Length <= maxLength ? cleaned : cleaned[..maxLength];
    }

    private static string? TrimOrNull(string? value)
    {
        return string.IsNullOrWhiteSpace(value) ? null : value.Trim();
    }
}
