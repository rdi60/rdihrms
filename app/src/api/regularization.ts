import { supabase } from '../lib/supabase';
import type { RegularizationRequest } from '../types';

export async function listMyRegularizationRequests(profileId: string): Promise<RegularizationRequest[]> {
  const { data, error } = await supabase
    .from('regularization_requests')
    .select('*')
    .eq('profile_id', profileId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function listPendingRegularizationApprovals(): Promise<RegularizationRequest[]> {
  const { data, error } = await supabase
    .from('regularization_requests')
    .select('*, profiles!regularization_requests_profile_id_fkey(full_name)')
    .eq('status', 'pending')
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export interface NewRegularizationRequest {
  profileId: string;
  workDate: string;
  requestedClockIn: string | null;
  requestedClockOut: string | null;
  reason: string;
}

export async function submitRegularizationRequest(req: NewRegularizationRequest): Promise<void> {
  const { error } = await supabase.from('regularization_requests').insert({
    profile_id: req.profileId,
    work_date: req.workDate,
    requested_clock_in: req.requestedClockIn,
    requested_clock_out: req.requestedClockOut,
    reason: req.reason,
  });
  if (error) throw error;
}

export async function approveRegularizationRequest(id: string): Promise<void> {
  const { error } = await supabase
    .from('regularization_requests')
    .update({ status: 'approved', decided_by: (await supabase.auth.getUser()).data.user?.id, decided_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw error;
}

export async function rejectRegularizationRequest(id: string): Promise<void> {
  const { error } = await supabase
    .from('regularization_requests')
    .update({ status: 'rejected', decided_by: (await supabase.auth.getUser()).data.user?.id, decided_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw error;
}
