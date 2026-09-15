import { supabase } from '../lib/supabase';
import type { AdminPermission, Profile } from '../types';

export async function listAdmins(): Promise<Profile[]> {
  const { data, error } = await supabase.from('profiles').select('*').eq('role', 'admin');
  if (error) throw error;
  return data ?? [];
}

export async function listPromotableStaff(): Promise<Profile[]> {
  const { data, error } = await supabase.from('profiles').select('*').in('role', ['staff', 'manager']).eq('is_active', true);
  if (error) throw error;
  return data ?? [];
}

export async function getAdminPermissions(profileId: string): Promise<AdminPermission[]> {
  const { data, error } = await supabase.from('admin_permissions').select('permission').eq('profile_id', profileId);
  if (error) throw error;
  return (data ?? []).map((p) => p.permission as AdminPermission);
}

export async function setAdminAccess(profileId: string, fullAccess: boolean, permissions: AdminPermission[]): Promise<void> {
  const { error } = await supabase.rpc('set_admin_access', {
    p_profile_id: profileId,
    p_full_access: fullAccess,
    p_permissions: permissions,
  });
  if (error) throw error;
}

export async function revokeAdmin(profileId: string): Promise<void> {
  const { error } = await supabase.rpc('revoke_admin', { p_profile_id: profileId });
  if (error) throw error;
}
