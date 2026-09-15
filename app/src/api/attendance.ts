import { supabase } from '../lib/supabase';
import { todayStr, toDateStr } from '../lib/dates';
import { compareEmployeeCode } from '../lib/sort';
import type { AttendanceDay, Profile } from '../types';

export async function getTodayAttendance(profileId: string): Promise<AttendanceDay | null> {
  const { data } = await supabase
    .from('attendance_days')
    .select('*')
    .eq('profile_id', profileId)
    .eq('work_date', todayStr())
    .maybeSingle();
  return data;
}

// Both clock_in/clock_out are server-side RPCs: the timestamp and the
// late/present status are computed from auth.uid() and now() in the
// database, not trusted from the client.
export async function clockIn(): Promise<AttendanceDay> {
  const { data, error } = await supabase.rpc('clock_in').single();
  if (error) throw error;
  return data as AttendanceDay;
}

export async function clockOut(): Promise<AttendanceDay> {
  const { data, error } = await supabase.rpc('clock_out').single();
  if (error) throw error;
  return data as AttendanceDay;
}

export async function listMonthAttendance(
  profileId: string,
  year: number,
  month: number // 0-indexed
): Promise<AttendanceDay[]> {
  const start = toDateStr(new Date(year, month, 1));
  const end = toDateStr(new Date(year, month + 1, 0));
  const { data, error } = await supabase
    .from('attendance_days')
    .select('*')
    .eq('profile_id', profileId)
    .gte('work_date', start)
    .lte('work_date', end);
  if (error) throw error;
  return data ?? [];
}

export async function listRecentActivity(profileId: string, limit = 5) {
  const { data, error } = await supabase
    .from('attendance_days')
    .select('*')
    .eq('profile_id', profileId)
    .order('work_date', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data ?? [];
}

export async function listAttendanceRange(start: string, end: string): Promise<AttendanceDay[]> {
  const { data, error } = await supabase
    .from('attendance_days')
    .select('*')
    .gte('work_date', start)
    .lte('work_date', end);
  if (error) throw error;
  return data ?? [];
}

export async function markWeeklyOff(profileId: string, workDate: string): Promise<void> {
  const { error } = await supabase.rpc('mark_weekly_off', { p_profile_id: profileId, p_work_date: workDate });
  if (error) throw error;
}

export async function clearWeeklyOff(profileId: string, workDate: string): Promise<void> {
  const { error } = await supabase.rpc('clear_weekly_off', { p_profile_id: profileId, p_work_date: workDate });
  if (error) throw error;
}

export async function listTodayRoster(): Promise<
  { profile: Profile; today: AttendanceDay | null }[]
> {
  const { data: profiles, error } = await supabase.from('profiles').select('*');
  if (error) throw error;
  const { data: today } = await supabase
    .from('attendance_days')
    .select('*')
    .eq('work_date', todayStr());
  const byProfile = new Map((today ?? []).map((a) => [a.profile_id, a]));
  return (profiles ?? [])
    .sort((a, b) => compareEmployeeCode(a.employee_code, b.employee_code))
    .map((p) => ({ profile: p, today: byProfile.get(p.id) ?? null }));
}
