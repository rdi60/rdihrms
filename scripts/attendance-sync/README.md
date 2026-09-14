# Attendance sync (eSSL SQL Server → Supabase)

Two scripts that connect the clinic's local eSSL biometric database
(`Employees` + `AttendanceLogs`) to the app's Supabase backend:

- **`Provision-Staff.ps1`** — one-time (or occasional) setup: creates an app
  login for every active staff member who doesn't have one yet.
- **`Sync-Attendance.ps1`** — the ongoing one: pushes punch records into the
  app so real clock-in/out data shows up instead of relying on manual
  clock-in.

Both run on the Windows computer that can already reach the SQL Server
database (the same one you use SQL Server Management Studio on). Nothing
needs to be installed — they only use what's already built into Windows
PowerShell.

## One-time setup

1. Copy `config.example.ps1` to `config.ps1` in this same folder.
2. Fill in `config.ps1`:
   - `$SqlServer` / `$SqlDatabase` — same values you use to connect in SSMS.
   - `$SqlUseWindowsAuth` — leave `$true` unless you normally log into that
     database with a separate SQL username/password.
   - `$SupabaseServiceRoleKey` — from the Supabase dashboard: Project
     Settings → API → **service_role** secret (not the anon/publishable key
     used in the app). This key can act on behalf of any staff member, so
     keep this file local to this machine — never commit it or put it on a
     shared drive.
3. If PowerShell refuses to run scripts at all with a message about
   execution policy, run this once first (only allows locally-authored
   scripts, doesn't lower security broadly):
   ```powershell
   Set-ExecutionPolicy -Scope CurrentUser RemoteSigned
   ```

## Creating staff logins (`Provision-Staff.ps1`)

Finds every employee in the SQL Server `Employees` table with `Status =
'Working'` whose `EmployeeCode` starts with `CDRF` or `R` (Rajan Dental's
two staff groups — adjust with `-CodePrefixes` if that changes), and who
doesn't already have a Supabase profile. For each one it creates a login
and the matching `profiles` row (name, role `staff`, employee code) —
matching is done by `employee_code`, so the sync script can find them
afterward.

Since most of these staff don't have email addresses on file, it generates
one (`<employeecode>@rajandental.app`) and a default password
(`Rajan@<EMPLOYEECODE>`) for each person. **The app doesn't have a
self-service "change password" feature yet**, so these are effectively
permanent until a manager resets one by hand in Supabase — something worth
knowing before handing them out widely.

Preview first, then run for real:

```powershell
.\Provision-Staff.ps1 -DryRun
.\Provision-Staff.ps1
```

This writes `provisioned-staff-credentials.csv` in this folder listing
every account it just created, with its email and password — **this file
has plaintext passwords in it.** Use it to hand out logins, then delete it.
It's gitignored so it won't get committed, but don't leave it sitting on a
shared drive either.

Safe to re-run later (e.g. after new staff join) — it only creates accounts
for people who don't already have one.

To promote someone to manager (able to approve leave, see the Team tab),
edit their `role` to `manager` directly in Supabase's Table Editor →
`profiles` afterward — this script always creates `staff`.

## Syncing attendance (`Sync-Attendance.ps1`)

By default it syncs the last 60 days. Preview first, then run for real:

```powershell
.\Sync-Attendance.ps1 -SinceDate (Get-Date '2026-01-01') -DryRun
.\Sync-Attendance.ps1 -SinceDate (Get-Date '2026-01-01')
```

Or just `.\Sync-Attendance.ps1` to use the default 60-day window.

What it does with the data:
- Matches `Employees.EmployeeCode` to the app's `profiles.employee_code`
  (this is why staff need to be provisioned first).
- Reads `AttendanceLogs.InTime` / `OutTime` (eSSL stores "no punch" as
  `1900-01-01 00:00:00` — the script treats that as no clock-in/out).
- Derives each day's status from `WeeklyOff` / `Holiday` / `IsOnLeave` /
  `Present` / `LateBy` flags rather than the free-text `Status` column.
- Upserts into `attendance_days` keyed by (staff member, date) — safe to
  re-run over the same date range; it overwrites rather than duplicates.
- Since this becomes the source of truth for days it covers, it will
  overwrite anything a staff member entered by manually tapping "Clock in"
  in the app for that same day.

Any `EmployeeCode` in `AttendanceLogs` with no matching profile gets
skipped, with a warning listing which codes — usually means someone new
hasn't been provisioned yet (re-run `Provision-Staff.ps1`), or their
`employee_code` in Supabase doesn't match.

## Re-running it regularly

Both are manual scripts — nothing is scheduled automatically. Run
`Sync-Attendance.ps1` whenever you want the app's attendance data refreshed
(e.g. once a day), and `Provision-Staff.ps1` whenever new staff join. If
you'd rather have the sync run automatically on a schedule, Windows Task
Scheduler can call `powershell.exe -File Sync-Attendance.ps1` on whatever
cadence you want — ask if you'd like help setting that up.
