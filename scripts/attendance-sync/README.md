# Attendance sync (eSSL SQL Server → Supabase)

Pulls punch records from the clinic's local eSSL biometric database
(`Employees` + `AttendanceLogs`) and pushes them into the app's Supabase
`attendance_days` table, so real clock-in/out data shows up in the app
instead of relying on manual clock-in.

Runs on the Windows computer that can already reach the SQL Server database
(the same one you use SQL Server Management Studio on). Nothing needs to be
installed — it only uses what's already built into Windows PowerShell.

## One-time setup

1. Copy `config.example.ps1` to `config.ps1` in this same folder.
2. Fill in `config.ps1`:
   - `$SqlServer` / `$SqlDatabase` — same values you use to connect in SSMS.
   - `$SqlUseWindowsAuth` — leave `$true` unless you normally log into that
     database with a separate SQL username/password.
   - `$SupabaseServiceRoleKey` — from the Supabase dashboard: Project
     Settings → API → **service_role** secret (not the anon/publishable key
     used in the app). This key can write on behalf of any staff member, so
     keep this file local to this machine — never commit it or put it on a
     shared drive.
3. **Match employee codes.** For each staff member, their `employee_code` in
   the app's Supabase `profiles` table must exactly match their
   `EmployeeCode` in the SQL Server `Employees` table (case-insensitive,
   whitespace-trimmed). If a code doesn't match, the script will skip that
   person's rows and tell you which codes it couldn't match.

## Running it

Open **PowerShell** (not needed to run as Administrator) in this folder and run:

```powershell
.\Sync-Attendance.ps1
```

By default it syncs the last 60 days. To sync a different range:

```powershell
.\Sync-Attendance.ps1 -SinceDate (Get-Date '2026-01-01')
```

To see what it *would* do without actually writing anything (safe to try
first):

```powershell
.\Sync-Attendance.ps1 -SinceDate (Get-Date '2026-01-01') -DryRun
```

If PowerShell refuses to run the script at all with a message about
execution policy, run this once first (only allows locally-authored scripts,
doesn't lower security broadly):

```powershell
Set-ExecutionPolicy -Scope CurrentUser RemoteSigned
```

## What it does with the data

- Matches `Employees.EmployeeCode` to the app's `profiles.employee_code`.
- Reads `AttendanceLogs.InTime` / `OutTime` (eSSL stores "no punch" as
  `1900-01-01 00:00:00` — the script treats that as no clock-in/out).
- Derives each day's status from `WeeklyOff` / `Holiday` / `IsOnLeave` /
  `Present` / `LateBy` flags rather than the free-text `Status` column.
- Upserts into `attendance_days` keyed by (staff member, date) — safe to
  re-run over the same date range; it overwrites rather than duplicates.
- Since this becomes the source of truth for days it covers, it will
  overwrite anything a staff member entered by manually tapping "Clock in"
  in the app for that same day.

## Re-running it regularly

This is a manual script — nothing is scheduled automatically. Run it
whenever you want the app's attendance data refreshed from the biometric
devices (e.g. once a day, or whenever you remember to). If you'd rather have
it run automatically on a schedule, Windows Task Scheduler can call
`powershell.exe -File Sync-Attendance.ps1` on whatever cadence you want —
ask if you'd like help setting that up.
