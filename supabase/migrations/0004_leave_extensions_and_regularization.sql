-- Adds three new leave types (Restricted Holiday, Compensatory Off, On
-- Duty), an admin-only RPC for assigning per-employee leave balances, and
-- a new regularization_requests flow so staff can ask a manager to fix a
-- missing punch. Also fixes new-leave-request notifications to reach
-- admins as well as managers (they were only ever sent to role='manager').

insert into leave_types (code, label, unit) values
  ('RH', 'Restricted Holiday', 'day'),
  ('CO', 'Compensatory Off', 'day'),
  ('OD', 'On Duty', 'day')
on conflict (code) do nothing;

-- ---------------------------------------------------------------------
-- Admin-only leave balance assignment. Goes through an RPC (rather than
-- a raw table upsert from the client) so "used" is never clobbered when
-- an admin edits someone's total.
-- ---------------------------------------------------------------------
create function set_leave_balance_total(p_profile_id uuid, p_leave_type_code text, p_year int, p_total numeric)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not is_admin(auth.uid()) then
    raise exception 'Only admins can set leave balances.';
  end if;

  insert into leave_balances (profile_id, leave_type_code, year, total, used)
  values (p_profile_id, p_leave_type_code, p_year, p_total, 0)
  on conflict (profile_id, leave_type_code, year)
  do update set total = excluded.total;
end;
$$;

-- ---------------------------------------------------------------------
-- New leave requests should notify admins too, not just managers.
-- ---------------------------------------------------------------------
create or replace function notify_managers_of_leave_request()
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
  where p.role in ('manager', 'admin');
  return new;
end;
$$;

-- ─────────────────────────────────────────────────────────────
-- regularization_requests — staff ask a manager to fix a missing punch
-- ─────────────────────────────────────────────────────────────
create table regularization_requests (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles (id) on delete cascade,
  work_date date not null,
  requested_clock_in time,
  requested_clock_out time,
  reason text not null default '',
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  decided_by uuid references profiles (id),
  decided_at timestamptz,
  created_at timestamptz not null default now()
);

alter table regularization_requests enable row level security;

create policy "staff see their own regularization requests, managers see everyone's"
  on regularization_requests for select
  using (profile_id = auth.uid() or is_manager_or_admin(auth.uid()));

create policy "staff can file their own regularization requests"
  on regularization_requests for insert
  with check (profile_id = auth.uid() and status = 'pending' and is_account_active(auth.uid()));

-- Single-approval is enough here (unlike leave's dual-approval rule) — a
-- missing-punch fix is lower stakes, so any one manager/admin can decide it.
create policy "managers can decide regularization requests"
  on regularization_requests for update
  using (is_manager_or_admin(auth.uid()))
  with check (is_manager_or_admin(auth.uid()));

-- When approved, write the corrected punch time(s) onto attendance_days.
create function apply_regularization_decision()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  shift_start_time time;
  clock_in_ts timestamptz;
  clock_out_ts timestamptz;
  new_status text;
begin
  if new.status = 'approved' and old.status <> 'approved' then
    select p.shift_start into shift_start_time from profiles p where p.id = new.profile_id;

    clock_in_ts := case when new.requested_clock_in is not null
      then (new.work_date + new.requested_clock_in) at time zone 'Asia/Kolkata' else null end;
    clock_out_ts := case when new.requested_clock_out is not null
      then (new.work_date + new.requested_clock_out) at time zone 'Asia/Kolkata' else null end;

    new_status := case
      when new.requested_clock_in is not null and shift_start_time is not null
        and new.requested_clock_in > shift_start_time + interval '10 minutes'
      then 'late'
      else 'present'
    end;

    insert into attendance_days (profile_id, work_date, clock_in, clock_out, status)
    values (new.profile_id, new.work_date, clock_in_ts, clock_out_ts, new_status)
    on conflict (profile_id, work_date) do update set
      clock_in = coalesce(excluded.clock_in, attendance_days.clock_in),
      clock_out = coalesce(excluded.clock_out, attendance_days.clock_out),
      status = excluded.status;
  end if;
  return new;
end;
$$;

create trigger on_regularization_decision
  after update on regularization_requests
  for each row execute function apply_regularization_decision();

create function notify_managers_of_regularization_request()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into notifications (profile_id, title, body, kind)
  select
    p.id,
    'Punch fix request',
    (select full_name from profiles where id = new.profile_id) || ' requested a punch fix for ' || to_char(new.work_date, 'Mon DD'),
    'clock'
  from profiles p
  where p.role in ('manager', 'admin');
  return new;
end;
$$;

create trigger on_regularization_request_created
  after insert on regularization_requests
  for each row execute function notify_managers_of_regularization_request();

create function notify_requester_of_regularization_decision()
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
      case when new.status = 'approved' then 'Punch fix approved' else 'Punch fix rejected' end,
      'Your punch fix request for ' || to_char(new.work_date, 'Mon DD') || ' was ' || new.status,
      case when new.status = 'approved' then 'checkCircle' else 'alertTriangle' end
    );
  end if;
  return new;
end;
$$;

create trigger on_regularization_decision_notify
  after update on regularization_requests
  for each row execute function notify_requester_of_regularization_decision();
