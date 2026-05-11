# PostgreSQL backup skripti — har kun Task Scheduler orqali ishlatiladi
# Task Scheduler sozlash: schtasks /create /tn "ERP Backup" /tr "powershell -File C:\Projects\ERP_System\scripts\backup.ps1" /sc daily /st 02:00

param(
    [string]$DbName   = "erp_db",
    [string]$DbUser   = "postgres",
    [string]$DbHost   = "localhost",
    [int]   $DbPort   = 5432,
    [int]   $KeepDays = 14,
    [string]$BackupDir = "$PSScriptRoot\backups"
)

$env:PGPASSWORD = "postgres"  # .env dan o'qish yoki bu yerda o'zgartiring

if (-not (Test-Path $BackupDir)) {
    New-Item -ItemType Directory -Path $BackupDir | Out-Null
}

$date    = Get-Date -Format "yyyy-MM-dd_HH-mm"
$outFile = "$BackupDir\erp_backup_$date.sql"

Write-Host "Backup boshlanmoqda: $outFile"

& pg_dump -h $DbHost -p $DbPort -U $DbUser -d $DbName -f $outFile

if ($LASTEXITCODE -eq 0) {
    Write-Host "Backup muvaffaqiyatli: $outFile"
} else {
    Write-Error "pg_dump xatosi! Exit code: $LASTEXITCODE"
    exit 1
}

# 14 kundan eski backuplarni o'chirish
$cutoff = (Get-Date).AddDays(-$KeepDays)
Get-ChildItem "$BackupDir\erp_backup_*.sql" |
    Where-Object { $_.LastWriteTime -lt $cutoff } |
    ForEach-Object { Remove-Item $_.FullName; Write-Host "O'chirildi: $($_.Name)" }

Write-Host "Backup tugadi."
