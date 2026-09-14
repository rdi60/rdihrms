import { supabase } from '../lib/supabase';
import { todayStr, toDateStr } from '../lib/dates';
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

export async function clockIn(profile: Profile): Promise<AttendanceDay> {
  const now = new Date();
  const [h, m] = profile.shift_start.split(':').map(Number);
  const shiftStart = new Date(now);
  shiftStart.setHours(h, m + 10, 0, 0); // 10 min grace period
  const status = now > shiftStart ? 'late' : 'present';

  const { data, error } = await supabase
    .from('attendance_days')
    .upsert(
      { profile_id: profile.id, work_date: todayStr(), clock_in: now.toISOString(), status },
      { onConflict: 'profile_id,work_date' }
    )
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function clockOut(profileId: string): Promise<AttendanceDay> {
  const { data, error } = await supabase
    .from('attendance_days')
    .update({ clock_out: new Date().toISOString() })
    .eq('profile_id', profileId)
    .eq('work_date', todayStr())
    .select()
    .single();
  if (error) throw error;
  return data;
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

export async function listTodayRoster(): Promise<
  { profile: Profile; today: AttendanceDay | null }[]
> {
  const { data: profiles, error } = await supabase.from('profiles').select('*').order('full_name');
  if (error) throw error;
  const { data: today } = await supabase
    .from('attendance_days')
    .select('*')
    .eq('work_date', todayStr());
  const byProfile = new Map((today ?? []).map((a) => [a.profile_id, a]));
  return (profiles ?? []).map((p) => ({ profile: p, today: byProfile.get(p.id) ?? null }));
}
