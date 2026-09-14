import { supabase } from '../lib/supabase';
import type { Role } from '../types';

export async function setProfileRole(profileId: string, role: Role): Promise<void> {
  const { error } = await supabase.from('profiles').update({ role }).eq('id', profileId);
  if (error) throw error;
}

export async function setProfileActive(profileId: string, isActive: boolean): Promise<void> {
  const { error } = await supabase.from('profiles').update({ is_active: isActive }).eq('id', profileId);
  if (error) throw error;
}
