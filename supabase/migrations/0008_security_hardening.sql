-- Fixes from a full security audit (2026-09):
--
-- 1. "a user can update their own profile" only checked id = auth.uid(),
--    not which columns changed — any staff member could open dev tools
--    and set their own role to 'admin', or flip is_active back to true
--    right after being deactivated. A trigger now pins every column
--    except avatar_path back to its previous value on a self-update,
--    unless the caller is an admin.
-- 2. Clock-in/out was a direct client-side table insert/update guarded
--    only by an ownership check — a staff member could set any
--    status/timestamp for any date, including marking themselves
--    "present" for a day they never came in. Replaced with
--    clock_in()/clock_out() RPCs that compute the timestamp and
--    late/present status server-side from auth.uid() and now(); the old
--    open insert/update policies are dropped.
-- 3. The avatars storage bucket had no file-type or size limit.

-- ── 1. Lock down self profile updates to avatar_path only ──────────────
create function lock_profile_self_update()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if is_admin(auth.uid()) then
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
  return new;
end;
$$;

create trigger lock_profile_self_update_trigger
  before update on profiles
  for each row execute function lock_profile_self_update();

-- ── 2. Move clock-in/out server-side ────────────────────────────────────
drop policy "staff can clock themselves in/out" on attendance_days;
drop policy "staff can update their own open attendance row" on attendance_days;

create function clock_in()
returns attendance_days
language plpgsql
security definer
set search_path = public
as $$
declare
  me profiles;
  v_work_date date := (now() at time zone 'Asia/Kolkata')::date;
  shift_start_ts timestamptz;
  computed_status text;
  result attendance_days;
begin
  select * into me from profiles where id = auth.uid();
  if me is null or not me.is_active then
    raise exception 'Not an active staff account.';
  end if;

  shift_start_ts := (v_work_date + me.shift_start) at time zone 'Asia/Kolkata';
  computed_status := case when now() > shift_start_ts + interval '10 minutes'
    then 'late' else 'present' end;

  insert into attendance_days (profile_id, work_date, clock_in, status)
  values (auth.uid(), v_work_date, now(), computed_status)
  on conflict (profile_id, work_date) do update
    set clock_in = excluded.clock_in, status = excluded.status
  returning * into result;

  return result;
end;
$$;

create function clock_out()
returns attendance_days
language plpgsql
security definer
set search_path = public
as $$
declare
  v_work_date date := (now() at time zone 'Asia/Kolkata')::date;
  result attendance_days;
begin
  update attendance_days
  set clock_out = now()
  where profile_id = auth.uid() and attendance_days.work_date = v_work_date
  returning * into result;

  if result is null then
    raise exception 'No clock-in found for today.';
  end if;

  return result;
end;
$$;

-- ── 3. Limit avatar uploads to images, 5 MB max ─────────────────────────
update storage.buckets
set allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
    file_size_limit = 5242880
where id = 'avatars';
