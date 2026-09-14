import { supabase } from '../lib/supabase';
import type { LeaveBalance, LeaveRequest, LeaveTypeCode, LeaveDuration } from '../types';

export async function listLeaveBalances(profileId: string): Promise<LeaveBalance[]> {
  const year = new Date().getFullYear();
  const { data, error } = await supabase
    .from('leave_balances')
    .select('leave_type_code, total, used')
    .eq('profile_id', profileId)
    .eq('year', year);
  if (error) throw error;
  return data ?? [];
}

export async function listMyLeaveRequests(profileId: string): Promise<LeaveRequest[]> {
  const { data, error } = await supabase
    .from('leave_requests')
    .select('*')
    .eq('profile_id', profileId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function listPendingApprovals(): Promise<LeaveRequest[]> {
  const { data, error } = await supabase
    .from('leave_requests')
    .select('*, profiles!leave_requests_profile_id_fkey(full_name)')
    .eq('status', 'pending')
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export interface NewLeaveRequest {
  profileId: string;
  leaveType: LeaveTypeCode;
  duration: LeaveDuration;
  halfSession: 'morning' | 'afternoon' | null;
  startDate: string;
  endDate: string;
  permissionFrom: string | null;
  permissionTo: string | null;
  reason: string;
}

export async function submitLeaveRequest(req: NewLeaveRequest): Promise<void> {
  const { error } = await supabase.from('leave_requests').insert({
    profile_id: req.profileId,
    leave_type_code: req.leaveType,
    duration: req.duration,
    half_session: req.halfSession,
    start_date: req.startDate,
    end_date: req.endDate,
    permission_from: req.permissionFrom,
    permission_to: req.permissionTo,
    reason: req.reason,
  });
  if (error) throw error;
}

export async function approveLeaveRequest(id: string): Promise<LeaveRequest> {
  const { data, error } = await supabase.rpc('approve_leave_request', { request_id: id });
  if (error) throw error;
  return data;
}

export async function rejectLeaveRequest(id: string): Promise<LeaveRequest> {
  const { data, error } = await supabase.rpc('reject_leave_request', { request_id: id });
  if (error) throw error;
  return data;
}
