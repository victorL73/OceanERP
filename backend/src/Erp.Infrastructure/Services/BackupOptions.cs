namespace Erp.Infrastructure.Services;

public sealed class BackupOptions
{
    public string BackupsDirectory { get; set; } = "/opt/oceanerp/backups";
    public string ScriptDirectory { get; set; } = "/opt/oceanerp/deploy/ubuntu";
    public string BackupScript { get; set; } = "backup.sh";
    public string RestoreScript { get; set; } = "restore.sh";
    public int CommandTimeoutSeconds { get; set; } = 900;
    public bool ScheduleEnabled { get; set; }
    public int ScheduleIntervalHours { get; set; } = 24;
    public string ScheduleTimeLocal { get; set; } = "02:00";
    public int RetentionDays { get; set; } = 14;
}
