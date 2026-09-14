import { supabase } from '../lib/supabase';
import type { Role } from '../types';

export interface NewStaffInput {
  email: string;
  password: string;
  fullName: string;
  employeeCode: string;
  role: 'staff' | 'manager';
  departmentId: string | null;
}

export async function createStaff(input: NewStaffInput): Promise<void> {
  const { data: sessionData } = await supabase.auth.getSession();
  const accessToken = sessionData.session?.access_token;
  if (!accessToken) throw new Error('Not signed in.');

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
  const res = await fetch(`${supabaseUrl}/functions/v1/admin-create-staff`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
      apikey: anonKey,
    },
    body: JSON.stringify({
      email: input.email,
      password: input.password,
      full_name: input.fullName,
      employee_code: input.employeeCode,
      role: input.role,
      department_id: input.departmentId,
    }),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `Could not create the account (${res.status}).`);
  }
}

export async function setProfileRole(profileId: string, role: Role): Promise<void> {
  const { error } = await supabase.from('profiles').update({ role }).eq('id', profileId);
  if (error) throw error;
}

export async function setProfileActive(profileId: string, isActive: boolean): Promise<void> {
  const { error } = await supabase.from('profiles').update({ is_active: isActive }).eq('id', profileId);
  if (error) throw error;
}

export function getAvatarUrl(path: string | null): string | null {
  if (!path) return null;
  return supabase.storage.from('avatars').getPublicUrl(path).data.publicUrl;
}

export async function uploadStaffPhoto(profileId: string, file: File): Promise<void> {
  const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
  // Unique filename per upload so the public URL changes too — otherwise a
  // re-upload keeps the exact same URL and browsers keep showing the old
  // cached image even though the file underneath has changed.
  const path = `${profileId}_${Date.now()}.${ext}`;
  const { error: uploadError } = await supabase.storage
    .from('avatars')
    .upload(path, file, { contentType: file.type || 'image/jpeg' });
  if (uploadError) throw uploadError;
  const { error } = await supabase.from('profiles').update({ avatar_path: path }).eq('id', profileId);
  if (error) throw error;
}

export async function updateProfileDates(
  profileId: string,
  dates: { dateOfBirth?: string; joinDate?: string }
): Promise<void> {
  const patch: Record<string, string> = {};
  if (dates.dateOfBirth) patch.date_of_birth = dates.dateOfBirth;
  if (dates.joinDate) patch.join_date = dates.joinDate;
  if (Object.keys(patch).length === 0) return;
  const { error } = await supabase.from('profiles').update(patch).eq('id', profileId);
  if (error) throw error;
}
