-- Departments (custom, user-defined) + manager assignment, and two-manager
-- approval for leave requests.

-- -----------------------------------------------------------------------
-- departments
-- -----------------------------------------------------------------------
create table departments (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  created_at timestamptz not null default now()
);

alter table departments enable row level security;

create policy "departments are readable by any signed-in staff member"
  on departments for select
  using (auth.role() = 'authenticated');

create policy "managers manage departments"
  on departments for all
  using (is_manager(auth.uid()))
  with check (is_manager(auth.uid()));

-- Each staff member belongs to at most one department.
alter table profiles add column department_id uuid references departments (id) on delete set null;

-- -----------------------------------------------------------------------
-- manager_departments — which department(s) a manager is responsible for.
-- A manager assigned to zero departments is treated as unscoped (sees
-- everyone) — see the app's Team query.
-- -----------------------------------------------------------------------
create table manager_departments (
  manager_id uuid not null references profiles (id) on delete cascade,
  department_id uuid not null references departments (id) on delete cascade,
  primary key (manager_id, department_id)
);

alter table manager_departments enable row level security;

create policy "managers can see department assignments"
  on manager_departments for select
  using (is_manager(auth.uid()));

create policy "managers manage department assignments"
  on manager_departments for all
  using (is_manager(auth.uid()))
  with check (is_manager(auth.uid()));

-- -----------------------------------------------------------------------
-- Two-manager approval for leave requests
-- -----------------------------------------------------------------------
alter table leave_requests add column first_approved_by uuid references profiles (id);
alter table leave_requests add column first_approved_at timestamptz;

-- Approving and rejecting now go through these functions instead of a
-- direct table update, so the "must be a different manager" rule (and the
-- manager-only check) is enforced on the server, not just in the UI.
create function approve_leave_request(request_id uuid)
returns leave_requests
language plpgsql
security definer
set search_path = public
as $$
declare
  req leave_requests;
begin
  if not is_manager(auth.uid()) then
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

create function reject_leave_request(request_id uuid)
returns leave_requests
language plpgsql
security definer
set search_path = public
as $$
declare
  req leave_requests;
begin
  if not is_manager(auth.uid()) then
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
