import { supabase } from '../lib/supabase';
import type { AppNotification } from '../types';

export async function listNotifications(profileId: string): Promise<AppNotification[]> {
  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .eq('profile_id', profileId)
    .order('created_at', { ascending: false })
    .limit(50);
  if (error) throw error;
  return data ?? [];
}

export async function hasUnreadNotifications(profileId: string): Promise<boolean> {
  const { count, error } = await supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('profile_id', profileId)
    .is('read_at', null);
  if (error) throw error;
  return (count ?? 0) > 0;
}

export async function markAllRead(profileId: string): Promise<void> {
  const { error } = await supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('profile_id', profileId)
    .is('read_at', null);
  if (error) throw error;
}
