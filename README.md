# Rajan Dental — Staff Attendance App

A staff attendance, leave, and team-management PWA for Rajan Dental, implemented from the
`Attendance App.dc.html` design mockup (see `chats/` and `project/` for the original
Claude Design handoff — kept here for reference).

- **`app/`** — the React + TypeScript + Vite PWA.
- **`supabase/`** — the Postgres schema, RLS policies, and storage setup for the backend
  (Supabase: Postgres + Auth + Storage).
- **`project/`, `chats/`** — the original design handoff bundle from Claude Design. Not part
  of the running app; kept for design reference.

## First-time setup

1. **Create a Supabase project** at [supabase.com](https://supabase.com).
2. **Run the schema**: in the Supabase SQL editor, run `supabase/migrations/0001_init.sql`,
   then optionally `supabase/seed.sql` for sample holidays and leave balances.
3. **Create staff accounts**: in the Supabase dashboard under Authentication → Users, invite
   each staff member by email. Pass their name/role/employee code as user metadata
   (`full_name`, `role`, `employee_code`) so the profile is created correctly — a database
   trigger creates the matching `profiles` row automatically. The first account you create
   should have `role: manager` so someone can approve leave and manage the roster; you can
   also just edit the `role` column directly in the `profiles` table afterwards.
4. **Configure the app**: copy `app/.env.example` to `app/.env` and fill in your Supabase
   project URL and anon key (Project Settings → API).
5. **Run it**:
   ```
   cd app
   npm install
   npm run dev
   ```

## What's implemented

All screens from the mockup: Home (clock in/out), History (calendar + day detail), Leave
(SL/CL/EL/Permission balances, full/half-day and permission requests, manager approvals),
Team (roster + attendance analytics, manager-only), Profile (Company: public holidays, work
anniversaries, birthdays, payslips; Settings; log out), and Notifications.

## Deliberate differences from the mockup

- **No self-serve role switch.** The mockup had a Staff/Manager toggle on the Profile screen
  to demo both experiences. In the real app, role is a database field a manager sets — letting
  staff flip their own role would be a privilege-escalation bug, so that control was removed.
- **Native date/time pickers** instead of free-text date fields, since submitted leave dates
  need to be real, parseable dates.
- **No location/GPS check on clock-in** — a plain tap, matching the mockup, per your call to
  keep v1 simple.
- Everything else (colors, type, layout, copy, icons) follows the mockup's "Modernist" design
  system as closely as a real, responsive, data-backed app allows.

## Known gaps / next steps

- Settings screen items (Notifications, Change password, Language, Help & support) are
  placeholders — the mockup didn't specify behavior for these.
- Payslip upload is manager-only via Supabase Storage; there's no in-app upload UI yet — add
  files to the `payslips` bucket at `<profile_id>/<period>.pdf` and insert a matching row in
  the `payslips` table.
- No push notifications — the in-app notification list is populated by database triggers
  (new leave request, leave decision) but there's no phone-level push yet.
