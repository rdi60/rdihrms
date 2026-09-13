import { supabase } from '../lib/supabase';
import type { Holiday, Payslip, Profile } from '../types';

export async function listUpcomingHolidays(): Promise<Holiday[]> {
  const today = new Date().toISOString().slice(0, 10);
  const { data, error } = await supabase
    .from('holidays')
    .select('*')
    .gte('holiday_date', today)
    .order('holiday_date')
    .limit(12);
  if (error) throw error;
  return data ?? [];
}

export interface UpcomingPerson {
  name: string;
  date: string; // MM-DD of the anniversary this year/next
  years?: number;
}

/** Anniversaries and birthdays are derived from profile dates, not a separate table. */
export async function listUpcomingPeopleDates(
  field: 'join_date' | 'date_of_birth',
  withinDays = 90
): Promise<UpcomingPerson[]> {
  const { data, error } = await supabase.from('profiles').select('full_name, join_date, date_of_birth');
  if (error) throw error;

  const now = new Date();
  const results: (UpcomingPerson & { sortKey: number })[] = [];

  for (const p of data ?? []) {
    const raw = field === 'join_date' ? p.join_date : p.date_of_birth;
    if (!raw) continue;
    const original = new Date(`${raw}T00:00:00`);
    let next = new Date(now.getFullYear(), original.getMonth(), original.getDate());
    if (next < now) next = new Date(now.getFullYear() + 1, original.getMonth(), original.getDate());
    const daysAway = (next.getTime() - now.getTime()) / 86400000;
    if (daysAway > withinDays) continue;
    results.push({
      name: p.full_name,
      date: next.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
      years: field === 'join_date' ? next.getFullYear() - original.getFullYear() : undefined,
      sortKey: next.getTime(),
    });
  }
  return results.sort((a, b) => a.sortKey - b.sortKey);
}

export async function listMyPayslips(profileId: string): Promise<Payslip[]> {
  const { data, error } = await supabase
    .from('payslips')
    .select('*')
    .eq('profile_id', profileId)
    .order('period_label', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function getPayslipDownloadUrl(filePath: string): Promise<string> {
  const { data, error } = await supabase.storage.from('payslips').createSignedUrl(filePath, 60);
  if (error) throw error;
  return data.signedUrl;
}

export async function listRoster(): Promise<Profile[]> {
  const { data, error } = await supabase.from('profiles').select('*').order('full_name');
  if (error) throw error;
  return data ?? [];
}
