-- Lets a manager/admin mark a staff member's weekly off (WO) for a given
-- date, or remove a mistaken mark. Goes through RPCs (not a raw table
-- policy) so a manager can only ever set/clear the 'weekend' status —
-- never write arbitrary clock_in/clock_out data for someone else.

create function mark_weekly_off(p_profile_id uuid, p_work_date date)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not is_manager_or_admin(auth.uid()) then
    raise exception 'Only managers can mark a weekly off.';
  end if;

  insert into attendance_days (profile_id, work_date, status)
  values (p_profile_id, p_work_date, 'weekend')
  on conflict (profile_id, work_date) do update set status = 'weekend';
end;
$$;

create function clear_weekly_off(p_profile_id uuid, p_work_date date)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not is_manager_or_admin(auth.uid()) then
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
