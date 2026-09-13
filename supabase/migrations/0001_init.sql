-- Rajan Dental Staff Attendance App — initial schema
-- Run via `supabase db push` (Supabase CLI) or paste into the SQL editor of your
-- Supabase project. Requires the pgcrypto extension for gen_random_uuid().

create extension if not exists pgcrypto;

-- ─────────────────────────────────────────────────────────────
-- profiles — one row per staff member, keyed to auth.users
-- ─────────────────────────────────────────────────────────────
create table profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  employee_code text not null unique,
  full_name text not null,
  role text not null default 'staff' check (role in ('staff', 'manager')),
  job_title text,
  date_of_birth date,
  join_date date,
  shift_start time not null default '09:00',
  shift_end time not null default '17:00',
  weekly_hours numeric not null default 40,
  created_at timestamptz not null default now()
);

-- Security-definer helper so RLS policies can check "is this uid a manager"
-- without recursively hitting the profiles RLS policy being evaluated.
create function is_manager(uid uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (select 1 from profiles where id = uid and role = 'manager');
$$;

-- Auto-create a profile row when a new auth user is created. The employee
-- code / full name / role can be passed in via signUp's `options.data`, or
-- an admin can edit the row afterwards.
create function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into profiles (id, employee_code, full_name, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'employee_code', substr(new.id::text, 1, 8)),
    coalesce(new.raw_user_meta_data ->> 'full_name', new.email),
    coalesce(new.raw_user_meta_data ->> 'role', 'staff')
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

alter table profiles enable row level security;

create policy "profiles are readable by any signed-in staff member"
  on profiles for select
  using (auth.role() = 'authenticated');

create policy "a user can update their own profile"
  on profiles for update
  using (id = auth.uid())
  with check (id = auth.uid());

create policy "managers can update any profile"
  on profiles for update
  using (is_manager(auth.uid()));

-- ─────────────────────────────────────────────────────────────
-- attendance_days — one row per staff member per calendar day
-- ─────────────────────────────────────────────────────────────
create table attendance_days (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles (id) on delete cascade,
  work_date date not null,
  clock_in timestamptz,
  clock_out timestamptz,
  status text not null default 'present'
    check (status in ('present', 'late', 'absent', 'leave', 'holiday', 'weekend')),
  unique (profile_id, work_date)
);

alter table attendance_days enable row level security;

create policy "staff can see their own attendance, managers see everyone's"
  on attendance_days for select
  using (profile_id = auth.uid() or is_manager(auth.uid()));

create policy "staff can clock themselves in/out"
  on attendance_days for insert
  with check (profile_id = auth.uid());

create policy "staff can update their own open attendance row"
  on attendance_days for update
  using (profile_id = auth.uid())
  with check (profile_id = auth.uid());

-- ─────────────────────────────────────────────────────────────
-- leave_types / leave_balances / leave_requests
-- ─────────────────────────────────────────────────────────────
create table leave_types (
  code text primary key,
  label text not null,
  unit text not null default 'day' check (unit in ('day', 'hour'))
);
insert into leave_types (code, label, unit) values
  ('SL', 'Sick', 'day'),
  ('CL', 'Casual', 'day'),
  ('EL', 'Earned', 'day'),
  ('Permission', 'Permission', 'hour');

alter table leave_types enable row level security;
create policy "leave types are readable by any signed-in staff member"
  on leave_types for select
  using (auth.role() = 'authenticated');

create table leave_balances (
  profile_id uuid not null references profiles (id) on delete cascade,
  leave_type_code text not null references leave_types (code),
  year int not null,
  total numeric not null,
  used numeric not null default 0,
  primary key (profile_id, leave_type_code, year)
);

alter table leave_balances enable row level security;
create policy "staff see their own balances, managers see everyone's"
  on leave_balances for select
  using (profile_id = auth.uid() or is_manager(auth.uid()));
create policy "managers can adjust leave balances"
  on leave_balances for all
  using (is_manager(auth.uid()))
  with check (is_manager(auth.uid()));

create table leave_requests (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles (id) on delete cascade,
  leave_type_code text not null references leave_types (code),
  duration text not null default 'full' check (duration in ('full', 'half', 'permission')),
  half_session text check (half_session in ('morning', 'afternoon')),
  start_date date not null,
  end_date date not null,
  permission_from time,
  permission_to time,
  reason text not null default '',
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  decided_by uuid references profiles (id),
  decided_at timestamptz,
  created_at timestamptz not null default now()
);

alter table leave_requests enable row level security;

create policy "staff see their own requests, managers see everyone's"
  on leave_requests for select
  using (profile_id = auth.uid() or is_manager(auth.uid()));

create policy "staff can file their own leave requests"
  on leave_requests for insert
  with check (profile_id = auth.uid() and status = 'pending');

create policy "staff can withdraw their own pending requests"
  on leave_requests for update
  using (profile_id = auth.uid() and status = 'pending')
  with check (profile_id = auth.uid());

create policy "managers can approve or reject any request"
  on leave_requests for update
  using (is_manager(auth.uid()))
  with check (is_manager(auth.uid()));

-- When a request is approved, add the used amount to the matching balance.
create function apply_leave_decision()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  amount numeric;
  request_year int;
begin
  if new.status = 'approved' and old.status <> 'approved' then
    request_year := extract(year from new.start_date);
    if new.duration = 'permission' then
      amount := greatest(extract(epoch from (new.permission_to - new.permission_from)) / 3600.0, 0);
    elsif new.duration = 'half' then
      amount := 0.5;
    else
      amount := (new.end_date - new.start_date) + 1;
    end if;

    insert into leave_balances (profile_id, leave_type_code, year, total, used)
    values (new.profile_id, new.leave_type_code, request_year, 0, amount)
    on conflict (profile_id, leave_type_code, year)
    do update set used = leave_balances.used + excluded.used;

    insert into attendance_days (profile_id, work_date, status)
    select new.profile_id, d::date, 'leave'
    from generate_series(new.start_date, new.end_date, interval '1 day') as d
    on conflict (profile_id, work_date) do update set status = 'leave';
  end if;
  return new;
end;
$$;

create trigger on_leave_decision
  after update on leave_requests
  for each row execute function apply_leave_decision();

-- ─────────────────────────────────────────────────────────────
-- holidays
-- ─────────────────────────────────────────────────────────────
create table holidays (
  id uuid primary key default gen_random_uuid(),
  holiday_date date not null unique,
  name text not null
);

alter table holidays enable row level security;
create policy "holidays are readable by any signed-in staff member"
  on holidays for select
  using (auth.role() = 'authenticated');
create policy "managers manage holidays"
  on holidays for all
  using (is_manager(auth.uid()))
  with check (is_manager(auth.uid()));

-- ─────────────────────────────────────────────────────────────
-- payslips — metadata row + a file in the `payslips` storage bucket
-- ─────────────────────────────────────────────────────────────
create table payslips (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles (id) on delete cascade,
  period_label text not null,
  net_pay numeric not null,
  file_path text not null,
  created_at timestamptz not null default now()
);

alter table payslips enable row level security;
create policy "staff see their own payslips, managers see everyone's"
  on payslips for select
  using (profile_id = auth.uid() or is_manager(auth.uid()));
create policy "managers upload payslips"
  on payslips for insert
  with check (is_manager(auth.uid()));

insert into storage.buckets (id, name, public) values ('payslips', 'payslips', false)
  on conflict (id) do nothing;

create policy "staff read their own payslip file, managers read all"
  on storage.objects for select
  using (
    bucket_id = 'payslips'
    and (is_manager(auth.uid()) or (storage.foldername(name))[1] = auth.uid()::text)
  );
create policy "managers upload payslip files"
  on storage.objects for insert
  with check (bucket_id = 'payslips' and is_manager(auth.uid()));

-- ─────────────────────────────────────────────────────────────
-- notifications — one row per recipient
-- ─────────────────────────────────────────────────────────────
create table notifications (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles (id) on delete cascade,
  title text not null,
  body text not null,
  kind text not null default 'info',
  created_at timestamptz not null default now(),
  read_at timestamptz
);

alter table notifications enable row level security;
create policy "a user sees only their own notifications"
  on notifications for select
  using (profile_id = auth.uid());
create policy "a user can mark their own notifications read"
  on notifications for update
  using (profile_id = auth.uid())
  with check (profile_id = auth.uid());

-- Notify a manager whenever staff file a new leave request.
create function notify_managers_of_leave_request()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into notifications (profile_id, title, body, kind)
  select
    p.id,
    'New leave request',
    (select full_name from profiles where id = new.profile_id) || ' requested ' || new.leave_type_code
      || ' leave, ' || to_char(new.start_date, 'Mon DD') || '–' || to_char(new.end_date, 'Mon DD'),
    'clipboard'
  from profiles p
  where p.role = 'manager';
  return new;
end;
$$;

create trigger on_leave_request_created
  after insert on leave_requests
  for each row execute function notify_managers_of_leave_request();

-- Notify the requester when their leave request is approved/rejected.
create function notify_requester_of_leave_decision()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status in ('approved', 'rejected') and old.status = 'pending' then
    insert into notifications (profile_id, title, body, kind)
    values (
      new.profile_id,
      case when new.status = 'approved' then 'Leave approved' else 'Leave rejected' end,
      'Your ' || new.leave_type_code || ' leave request for '
        || to_char(new.start_date, 'Mon DD') || '–' || to_char(new.end_date, 'Mon DD')
        || ' was ' || new.status,
      case when new.status = 'approved' then 'checkCircle' else 'alertTriangle' end
    );
  end if;
  return new;
end;
$$;

create trigger on_leave_decision_notify
  after update on leave_requests
  for each row execute function notify_requester_of_leave_decision();
