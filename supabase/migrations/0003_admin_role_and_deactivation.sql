-- Introduces an 'admin' role (department/staff management, deactivation)
-- and narrows 'manager' to Team visibility + leave approve/decline only.
-- Also adds account deactivation and closes a gap where a manager could
-- bypass the two-approval rule via a direct table update.

alter table profiles drop constraint profiles_role_check;
alter table profiles add constraint profiles_role_check check (role in ('staff', 'manager', 'admin'));

alter table profiles add column is_active boolean not null default true;

create function is_admin(uid uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (select 1 from profiles where id = uid and role = 'admin');
$$;

create function is_manager_or_admin(uid uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (select 1 from profiles where id = uid and role in ('manager', 'admin'));
$$;

create function is_account_active(uid uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select coalesce((select is_active from profiles where id = uid), false);
$$;

-- ---------------------------------------------------------------------
-- profiles: managing other people's records (role, department, active
-- state) is now admin-only, not any manager.
-- ---------------------------------------------------------------------
drop policy "managers can update any profile" on profiles;
create policy "admins can update any profile"
  on profiles for update
  using (is_admin(auth.uid()));

-- ---------------------------------------------------------------------
-- attendance_days: Team visibility stays with managers too; staff can
-- only clock themselves in/out while their account is active.
-- ---------------------------------------------------------------------
drop policy "staff can see their own attendance, managers see everyone's" on attendance_days;
create policy "staff can see their own attendance, managers see everyone's"
  on attendance_days for select
  using (profile_id = auth.uid() or is_manager_or_admin(auth.uid()));

drop policy "staff can clock themselves in/out" on attendance_days;
create policy "staff can clock themselves in/out"
  on attendance_days for insert
  with check (profile_id = auth.uid() and is_account_active(auth.uid()));

drop policy "staff can update their own open attendance row" on attendance_days;
create policy "staff can update their own open attendance row"
  on attendance_days for update
  using (profile_id = auth.uid() and is_account_active(auth.uid()))
  with check (profile_id = auth.uid());

-- ---------------------------------------------------------------------
-- leave_balances: viewing stays with managers, adjusting is admin-only
-- (not part of "approve/decline").
-- ---------------------------------------------------------------------
drop policy "staff see their own balances, managers see everyone's" on leave_balances;
create policy "staff see their own balances, managers see everyone's"
  on leave_balances for select
  using (profile_id = auth.uid() or is_manager_or_admin(auth.uid()));

drop policy "managers can adjust leave balances" on leave_balances;
create policy "admins can adjust leave balances"
  on leave_balances for all
  using (is_admin(auth.uid()))
  with check (is_admin(auth.uid()));

-- ---------------------------------------------------------------------
-- leave_requests: seeing pending approvals stays with managers; filing a
-- request requires an active account; the direct-update policy that let
-- a manager set status in one step (bypassing the two-approval rule) is
-- removed — approving/rejecting now only happens through the
-- approve_leave_request / reject_leave_request functions below.
-- ---------------------------------------------------------------------
drop policy "staff see their own requests, managers see everyone's" on leave_requests;
create policy "staff see their own requests, managers see everyone's"
  on leave_requests for select
  using (profile_id = auth.uid() or is_manager_or_admin(auth.uid()));

drop policy "staff can file their own leave requests" on leave_requests;
create policy "staff can file their own leave requests"
  on leave_requests for insert
  with check (profile_id = auth.uid() and status = 'pending' and is_account_active(auth.uid()));

drop policy "managers can approve or reject any request" on leave_requests;

create or replace function approve_leave_request(request_id uuid)
returns leave_requests
language plpgsql
security definer
set search_path = public
as $$
declare
  req leave_requests;
begin
  if not is_manager_or_admin(auth.uid()) then
    raise exception 'Only managers can approve leave requests.';
  end if;

  select * into req from leave_requests where id = request_id for update;
  if req is null then
    raise exception 'Leave request not found.';
  end if;
  if req.status <> 'pending' then
    raise exception 'This request is already %.', req.status;
  end if;

  if req.first_approved_by is null then
    update leave_requests
      set first_approved_by = auth.uid(), first_approved_at = now()
      where id = request_id
      returning * into req;
  elsif req.first_approved_by = auth.uid() then
    raise exception 'You already gave the first approval on this request — a different manager needs to give the second.';
  else
    update leave_requests
      set status = 'approved', decided_by = auth.uid(), decided_at = now()
      where id = request_id
      returning * into req;
  end if;

  return req;
end;
$$;

create or replace function reject_leave_request(request_id uuid)
returns leave_requests
language plpgsql
security definer
set search_path = public
as $$
declare
  req leave_requests;
begin
  if not is_manager_or_admin(auth.uid()) then
    raise exception 'Only managers can reject leave requests.';
  end if;

  select * into req from leave_requests where id = request_id for update;
  if req is null then
    raise exception 'Leave request not found.';
  end if;
  if req.status <> 'pending' then
    raise exception 'This request is already %.', req.status;
  end if;

  update leave_requests
    set status = 'rejected', decided_by = auth.uid(), decided_at = now()
    where id = request_id
    returning * into req;

  return req;
end;
$$;

-- ---------------------------------------------------------------------
-- holidays / payslips: content management is admin-only now.
-- ---------------------------------------------------------------------
drop policy "managers manage holidays" on holidays;
create policy "admins manage holidays"
  on holidays for all
  using (is_admin(auth.uid()))
  with check (is_admin(auth.uid()));

drop policy "managers upload payslips" on payslips;
create policy "admins upload payslips"
  on payslips for insert
  with check (is_admin(auth.uid()));

drop policy "staff read their own payslip file, managers read all" on storage.objects;
create policy "staff read their own payslip file, admins read all"
  on storage.objects for select
  using (
    bucket_id = 'payslips'
    and (is_admin(auth.uid()) or (storage.foldername(name))[1] = auth.uid()::text)
  );

drop policy "managers upload payslip files" on storage.objects;
create policy "admins upload payslip files"
  on storage.objects for insert
  with check (bucket_id = 'payslips' and is_admin(auth.uid()));

-- ---------------------------------------------------------------------
-- departments / manager_departments: admin-only to manage. A manager can
-- still read their own assignment (so the Team screen can scope itself);
-- only admins can see/manage everyone's.
-- ---------------------------------------------------------------------
drop policy "managers manage departments" on departments;
create policy "admins manage departments"
  on departments for all
  using (is_admin(auth.uid()))
  with check (is_admin(auth.uid()));

drop policy "managers can see department assignments" on manager_departments;
create policy "a manager sees their own department assignments, admins see all"
  on manager_departments for select
  using (manager_id = auth.uid() or is_admin(auth.uid()));

drop policy "managers manage department assignments" on manager_departments;
create policy "admins manage department assignments"
  on manager_departments for all
  using (is_admin(auth.uid()))
  with check (is_admin(auth.uid()));

-- ---------------------------------------------------------------------
-- Make yourself admin (run once, manually): find your account's row in
-- Supabase's Table Editor -> profiles, and set role = 'admin'.
-- ---------------------------------------------------------------------
