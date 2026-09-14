<#
.SYNOPSIS
  Syncs punch records from the local eSSL/biometric SQL Server database
  (Employees + AttendanceLogs) into the Rajan Dental attendance app's
  Supabase `attendance_days` table.

.PARAMETER SinceDate
  Only sync AttendanceLogs rows on or after this date. Defaults to 60 days
  ago. Safe to re-run with an overlapping range — existing rows for the same
  staff member + date are overwritten, not duplicated.

.PARAMETER DryRun
  Read and compute everything, print what would be sent, but don't actually
  write to Supabase. Use this the first time to sanity-check the mapping.

.EXAMPLE
  .\Sync-Attendance.ps1
  .\Sync-Attendance.ps1 -SinceDate (Get-Date '2026-01-01') -DryRun
#>
param(
  [datetime]$SinceDate = (Get-Date).AddDays(-60),
  [switch]$DryRun
)

$ErrorActionPreference = 'Stop'

$configPath = Join-Path $PSScriptRoot 'config.ps1'
if (-not (Test-Path $configPath)) {
  Write-Error "config.ps1 not found next to this script. Copy config.example.ps1 to config.ps1 and fill in your values."
  exit 1
}
. $configPath

foreach ($required in 'SqlServer', 'SqlDatabase', 'SupabaseUrl', 'SupabaseServiceRoleKey') {
  if (-not (Get-Variable -Name $required -ErrorAction SilentlyContinue) -or [string]::IsNullOrWhiteSpace((Get-Variable -Name $required).Value)) {
    Write-Error "config.ps1 is missing a value for `$$required."
    exit 1
  }
}

# ── SQL Server: read punch records ─────────────────────────────────────────

if ($SqlUseWindowsAuth) {
  $connString = "Server=$SqlServer;Database=$SqlDatabase;Integrated Security=True;TrustServerCertificate=True;"
} else {
  $connString = "Server=$SqlServer;Database=$SqlDatabase;User Id=$SqlUser;Password=$SqlPassword;TrustServerCertificate=True;"
}

$query = @"
SELECT
  e.EmployeeCode,
  a.AttendanceDate,
  a.InTime,
  a.OutTime,
  a.LateBy,
  a.IsOnLeave,
  a.WeeklyOff,
  a.Holiday,
  a.Present
FROM AttendanceLogs a
JOIN Employees e ON e.EmployeeId = a.EmployeeId
WHERE a.AttendanceDate >= @SinceDate
"@

Write-Host "Connecting to SQL Server ($SqlServer / $SqlDatabase)..."
$connection = New-Object System.Data.SqlClient.SqlConnection $connString
$connection.Open()
$command = $connection.CreateCommand()
$command.CommandText = $query
$null = $command.Parameters.AddWithValue('@SinceDate', $SinceDate.Date)
$reader = $command.ExecuteReader()

$rows = New-Object System.Collections.Generic.List[object]
while ($reader.Read()) {
  $rows.Add([pscustomobject]@{
    EmployeeCode    = $reader['EmployeeCode']
    AttendanceDate  = $reader['AttendanceDate']
    InTime          = $reader['InTime']
    OutTime         = $reader['OutTime']
    LateBy          = if ($reader['LateBy'] -eq [DBNull]::Value) { 0 } else { [int]$reader['LateBy'] }
    IsOnLeave       = if ($reader['IsOnLeave'] -eq [DBNull]::Value) { 0 } else { [int]$reader['IsOnLeave'] }
    WeeklyOff       = if ($reader['WeeklyOff'] -eq [DBNull]::Value) { 0 } else { [int]$reader['WeeklyOff'] }
    Holiday         = if ($reader['Holiday'] -eq [DBNull]::Value) { 0 } else { [int]$reader['Holiday'] }
    Present         = if ($reader['Present'] -eq [DBNull]::Value) { 0 } else { [double]$reader['Present'] }
  })
}
$reader.Close()
$connection.Close()
Write-Host "Read $($rows.Count) attendance rows from SQL Server."

# ── Helpers ─────────────────────────────────────────────────────────────────

# eSSL stores "no punch" as 1900-01-01 00:00:00, and encodes a real punch's
# time-of-day on that same placeholder date — so a real punch is any value
# other than exactly midnight on 1900-01-01. We take its time-of-day and
# apply it to the real AttendanceDate, in India Standard Time (+05:30).
function Get-ClockTimestamp {
  param([datetime]$AttendanceDate, [string]$TimeStr)
  if ([string]::IsNullOrWhiteSpace($TimeStr)) { return $null }
  $t = [datetime]::Parse($TimeStr)
  if ($t.Year -le 1900 -and $t.Hour -eq 0 -and $t.Minute -eq 0 -and $t.Second -eq 0) { return $null }
  $combined = [datetime]::new($AttendanceDate.Year, $AttendanceDate.Month, $AttendanceDate.Day, $t.Hour, $t.Minute, $t.Second)
  $dto = [System.DateTimeOffset]::new($combined, [System.TimeSpan]::FromHours(5.5))
  return $dto.ToString('o')
}

function Get-DayStatus {
  param([int]$WeeklyOff, [int]$Holiday, [int]$IsOnLeave, [double]$Present, [int]$LateBy)
  if ($WeeklyOff -eq 1) { return 'weekend' }
  if ($Holiday -eq 1) { return 'holiday' }
  if ($IsOnLeave -eq 1) { return 'leave' }
  if ($Present -gt 0) {
    if ($LateBy -gt 0) { return 'late' }
    return 'present'
  }
  return 'absent'
}

# ── Supabase: map employee codes to profile ids ─────────────────────────────

$headers = @{
  apikey        = $SupabaseServiceRoleKey
  Authorization = "Bearer $SupabaseServiceRoleKey"
  'Content-Type' = 'application/json'
}

Write-Host "Fetching staff profiles from Supabase..."
$profiles = Invoke-RestMethod -Uri "$SupabaseUrl/rest/v1/profiles?select=id,employee_code" -Headers $headers -Method Get

$codeToId = @{}
foreach ($p in $profiles) {
  $codeToId[$p.employee_code.Trim().ToUpperInvariant()] = $p.id
}
Write-Host "Loaded $($codeToId.Count) staff profiles."

# ── Build the upsert payload ────────────────────────────────────────────────

$payload = New-Object System.Collections.Generic.List[object]
$unmatchedCodes = @{}

foreach ($row in $rows) {
  $code = if ($row.EmployeeCode) { $row.EmployeeCode.Trim().ToUpperInvariant() } else { '' }
  if (-not $codeToId.ContainsKey($code)) {
    $unmatchedCodes[$row.EmployeeCode] = ($unmatchedCodes[$row.EmployeeCode] + 1)
    continue
  }

  $status = Get-DayStatus -WeeklyOff $row.WeeklyOff -Holiday $row.Holiday -IsOnLeave $row.IsOnLeave -Present $row.Present -LateBy $row.LateBy

  $payload.Add(@{
    profile_id = $codeToId[$code]
    work_date  = $row.AttendanceDate.ToString('yyyy-MM-dd')
    clock_in   = Get-ClockTimestamp -AttendanceDate $row.AttendanceDate -TimeStr $row.InTime
    clock_out  = Get-ClockTimestamp -AttendanceDate $row.AttendanceDate -TimeStr $row.OutTime
    status     = $status
  })
}

Write-Host "Matched $($payload.Count) rows to a staff profile."
if ($unmatchedCodes.Count -gt 0) {
  Write-Warning "These EmployeeCode values from AttendanceLogs have no matching profiles.employee_code in Supabase (skipped):"
  foreach ($k in $unmatchedCodes.Keys) {
    Write-Warning "  '$k' — $($unmatchedCodes[$k]) row(s)"
  }
  Write-Warning "Fix these by setting the matching profile's employee_code in Supabase's Table Editor, then re-run."
}

if ($DryRun) {
  Write-Host "`n--dry run-- would send $($payload.Count) rows. First 5:"
  $payload | Select-Object -First 5 | ConvertTo-Json -Depth 5 | Write-Host
  exit 0
}

if ($payload.Count -eq 0) {
  Write-Host "Nothing to sync."
  exit 0
}

# ── Push to Supabase in batches ─────────────────────────────────────────────

$upsertHeaders = $headers.Clone()
$upsertHeaders['Prefer'] = 'resolution=merge-duplicates,return=minimal'

$batchSize = 200
$total = $payload.Count
for ($i = 0; $i -lt $total; $i += $batchSize) {
  $batch = $payload.GetRange($i, [Math]::Min($batchSize, $total - $i))
  $body = $batch | ConvertTo-Json -Depth 5
  Invoke-RestMethod -Uri "$SupabaseUrl/rest/v1/attendance_days?on_conflict=profile_id,work_date" -Headers $upsertHeaders -Method Post -Body $body | Out-Null
  Write-Host "Synced $([Math]::Min($i + $batchSize, $total)) / $total"
}

Write-Host "Done."
