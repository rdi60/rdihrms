-- Adds a super_admin tier and an optional "scoped admin" permission
-- model, so the clinic owner (super admin) can promote someone — e.g.
-- an HR manager — to admin with only SOME admin capabilities rather
-- than all of them.
--
-- Every EXISTING admin account keeps full, unrestricted access:
-- admin_full_access defaults to true, and has_permission() below treats
-- full-access admins as passing every check, so nothing already granted
-- to today's admins changes. Only accounts a super admin explicitly
-- scopes down going forward are restricted.
--
-- After running this, make yourself the super admin (run once, manually):
--   update profiles set role = 'super_admin' where id =
--     (select id from auth.users where email = 'info@rajandental.com');

alter table profiles drop constraint profiles_role_check;
alter table profiles add constraint profiles_role_check check (role in ('staff', 'manager', 'admin', 'super_admin'));

alter table profiles add column admin_full_access boolean not null default true;

create table admin_permissions (
  profile_id uuid not null references profiles (id) on delete cascade,
  permission text not null check (permission in ('staff', 'leave_attendance', 'payroll_reports', 'departments_holidays')),
  primary key (profile_id, permission)
);

alter table admin_permissions enable row level security;

create function is_super_admin(uid uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (select 1 from profiles where id = uid and role = 'super_admin');
$$;

create policy "super admins manage admin permissions"
  on admin_permissions for all
  using (is_super_admin(auth.uid()))
  with check (is_super_admin(auth.uid()));

create policy "an admin can see their own permissions"
  on admin_permissions for select
  using (profile_id = auth.uid());

-- Widened so a super admin automatically passes every existing
-- admin-only check with no other changes required.
create or replace function is_admin(uid uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (select 1 from profiles where id = uid and role in ('admin', 'super_admin'));
$$;

create or replace function is_manager_or_admin(uid uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (select 1 from profiles where id = uid and role in ('manager', 'admin', 'super_admin'));
$$;

create function has_permission(uid uuid, perm text)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select
    is_super_admin(uid)
    or exists (
      select 1 from profiles
      where id = uid and role = 'admin'
        and (
          admin_full_access
          or exists (select 1 from admin_permissions ap where ap.profile_id = uid and ap.permission = perm)
        )
    );
$$;

-- Grants or edits an existing staff/manager account's admin access in one
-- call. Full access = every existing admin power; a false full-access
-- flag scopes them to exactly the given permission list.
create function set_admin_access(p_profile_id uuid, p_full_access boolean, p_permissions text[])
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not is_super_admin(auth.uid()) then
    raise exception 'Only the super admin can change admin access.';
  end if;
  if p_profile_id = auth.uid() then
    raise exception 'You cannot change your own admin access.';
  end if;

  update profiles set role = 'admin', admin_full_access = p_full_access where id = p_profile_id;

  delete from admin_permissions where profile_id = p_profile_id;
  if not p_full_access and p_permissions is not null then
    insert into admin_permissions (profile_id, permission)
    select p_profile_id, unnest(p_permissions);
  end if;
end;
$$;

create function revoke_admin(p_profile_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not is_super_admin(auth.uid()) then
    raise exception 'Only the super admin can revoke admin access.';
  end if;
  if p_profile_id = auth.uid() then
    raise exception 'You cannot revoke your own admin access.';
  end if;

  update profiles set role = 'staff', admin_full_access = true where id = p_profile_id;
  delete from admin_permissions where profile_id = p_profile_id;
end;
$$;

-- ── Re-point the 4 domains at has_permission() instead of a blanket
-- is_admin() check, so a scoped admin is only granted what they were
-- actually given. ──────────────────────────────────────────────────────

-- Staff management

-- The self-edit lock trigger from the earlier hardening pass (0008)
-- exempted any admin from the lock entirely. Now that "admin" can mean a
-- deliberately scoped-down account, that exemption would let a scoped
-- admin flip their own admin_full_access back to true — a
-- self-escalation path. Only a super admin bypasses the lock now, and
-- admin_full_access is pinned like every other protected column.
create or replace function lock_profile_self_update()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if is_super_admin(auth.uid()) then
    return new;
  end if;

  new.employee_code := old.employee_code;
  new.full_name := old.full_name;
  new.role := old.role;
  new.job_title := old.job_title;
  new.date_of_birth := old.date_of_birth;
  new.join_date := old.join_date;
  new.shift_start := old.shift_start;
  new.shift_end := old.shift_end;
  new.weekly_hours := old.weekly_hours;
  new.department_id := old.department_id;
  new.is_active := old.is_active;
  new.admin_full_access := old.admin_full_access;
  return new;
end;
$$;

drop policy "admins can update any profile" on profiles;
create policy "admins can update any profile"
  on profiles for update
  using (has_permission(auth.uid(), 'staff'));

drop policy "admins upload avatar files" on storage.objects;
create policy "admins upload avatar files"
  on storage.objects for insert
  with check (bucket_id = 'avatars' and has_permission(auth.uid(), 'staff'));

drop policy "admins update avatar files" on storage.objects;
create policy "admins update avatar files"
  on storage.objects for update
  using (bucket_id = 'avatars' and has_permission(auth.uid(), 'staff'));

-- Leave & attendance
drop policy "admins can adjust leave balances" on leave_balances;
create policy "admins can adjust leave balances"
  on leave_balances for all
  using (has_permission(auth.uid(), 'leave_attendance'))
  with check (has_permission(auth.uid(), 'leave_attendance'));

drop policy "managers can decide regularization requests" on regularization_requests;
create policy "managers can decide regularization requests"
  on regularization_requests for update
  using (is_manager(auth.uid()) or has_permission(auth.uid(), 'leave_attendance'))
  with check (is_manager(auth.uid()) or has_permission(auth.uid(), 'leave_attendance'));

create or replace function set_leave_balance_total(p_profile_id uuid, p_leave_type_code text, p_year int, p_total numeric)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not has_permission(auth.uid(), 'leave_attendance') then
    raise exception 'Only admins with leave & attendance access can set leave balances.';
  end if;

  insert into leave_balances (profile_id, leave_type_code, year, total, used)
  values (p_profile_id, p_leave_type_code, p_year, p_total, 0)
  on conflict (profile_id, leave_type_code, year)
  do update set total = excluded.total;
end;
$$;

create or replace function approve_leave_request(request_id uuid)
returns leave_requests
language plpgsql
security definer
set search_path = public
as $$
declare
  req leave_requests;
begin
  if not (is_manager(auth.uid()) or has_permission(auth.uid(), 'leave_attendance')) then
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
  if not (is_manager(auth.uid()) or has_permission(auth.uid(), 'leave_attendance')) then
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

create or replace function mark_weekly_off(p_profile_id uuid, p_work_date date)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not (is_manager(auth.uid()) or has_permission(auth.uid(), 'leave_attendance')) then
    raise exception 'Only managers can mark a weekly off.';
  end if;

  insert into attendance_days (profile_id, work_date, status)
  values (p_profile_id, p_work_date, 'weekend')
  on conflict (profile_id, work_date) do update set status = 'weekend';
end;
$$;

create or replace function clear_weekly_off(p_profile_id uuid, p_work_date date)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not (is_manager(auth.uid()) or has_permission(auth.uid(), 'leave_attendance')) then
    raise exception 'Only managers can change a weekly off mark.';
  end if;

  delete from attendance_days
  where profile_id = p_profile_id
    and work_date = p_work_date
    and status = 'weekend'
    and clock_in is null
    and clock_out is null;
end;
$$;

-- Payroll & reports
drop policy "admins upload payslips" on payslips;
create policy "admins upload payslips"
  on payslips for insert
  with check (has_permission(auth.uid(), 'payroll_reports'));

drop policy "staff read their own payslip file, admins read all" on storage.objects;
create policy "staff read their own payslip file, admins read all"
  on storage.objects for select
  using (
    bucket_id = 'payslips'
    and (has_permission(auth.uid(), 'payroll_reports') or (storage.foldername(name))[1] = auth.uid()::text)
  );

drop policy "admins upload payslip files" on storage.objects;
create policy "admins upload payslip files"
  on storage.objects for insert
  with check (bucket_id = 'payslips' and has_permission(auth.uid(), 'payroll_reports'));

-- Departments & holidays
drop policy "admins manage holidays" on holidays;
create policy "admins manage holidays"
  on holidays for all
  using (has_permission(auth.uid(), 'departments_holidays'))
  with check (has_permission(auth.uid(), 'departments_holidays'));

drop policy "admins manage departments" on departments;
create policy "admins manage departments"
  on departments for all
  using (has_permission(auth.uid(), 'departments_holidays'))
  with check (has_permission(auth.uid(), 'departments_holidays'));

drop policy "a manager sees their own department assignments, admins see all" on manager_departments;
create policy "a manager sees their own department assignments, admins see all"
  on manager_departments for select
  using (manager_id = auth.uid() or has_permission(auth.uid(), 'departments_holidays'));

drop policy "admins manage department assignments" on manager_departments;
create policy "admins manage department assignments"
  on manager_departments for all
  using (has_permission(auth.uid(), 'departments_holidays'))
  with check (has_permission(auth.uid(), 'departments_holidays'));
