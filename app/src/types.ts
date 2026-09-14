export type Role = 'staff' | 'manager' | 'admin';

export interface Profile {
  id: string;
  employee_code: string;
  full_name: string;
  role: Role;
  job_title: string | null;
  date_of_birth: string | null; // YYYY-MM-DD
  join_date: string | null; // YYYY-MM-DD
  shift_start: string; // HH:MM:SS
  shift_end: string; // HH:MM:SS
  weekly_hours: number;
  department_id: string | null;
  is_active: boolean;
  avatar_path: string | null;
}

export interface Department {
  id: string;
  name: string;
  created_at: string;
}

export type AttendanceStatus = 'present' | 'late' | 'absent' | 'leave' | 'holiday' | 'weekend';

export interface AttendanceDay {
  id: string;
  profile_id: string;
  work_date: string;
  clock_in: string | null;
  clock_out: string | null;
  status: AttendanceStatus;
}

export type LeaveTypeCode = 'SL' | 'CL' | 'EL' | 'Permission' | 'RH' | 'CO' | 'OD';
export type LeaveDuration = 'full' | 'half' | 'permission';
export type LeaveStatus = 'pending' | 'approved' | 'rejected';

export interface LeaveType {
  code: LeaveTypeCode;
  label: string;
  unit: 'day' | 'hour';
}

export interface LeaveBalance {
  leave_type_code: LeaveTypeCode;
  total: number;
  used: number;
}

export interface LeaveRequest {
  id: string;
  profile_id: string;
  leave_type_code: LeaveTypeCode;
  duration: LeaveDuration;
  half_session: 'morning' | 'afternoon' | null;
  start_date: string;
  end_date: string;
  permission_from: string | null;
  permission_to: string | null;
  reason: string;
  status: LeaveStatus;
  created_at: string;
  first_approved_by: string | null;
  first_approved_at: string | null;
  profiles?: Pick<Profile, 'full_name'>;
}

export interface Holiday {
  id: string;
  holiday_date: string;
  name: string;
}

export interface Payslip {
  id: string;
  profile_id: string;
  period_label: string;
  net_pay: number;
  file_path: string;
}

export type RegularizationStatus = 'pending' | 'approved' | 'rejected';

export interface RegularizationRequest {
  id: string;
  profile_id: string;
  work_date: string;
  requested_clock_in: string | null;
  requested_clock_out: string | null;
  reason: string;
  status: RegularizationStatus;
  created_at: string;
  profiles?: Pick<Profile, 'full_name'>;
}

export interface AppNotification {
  id: string;
  profile_id: string;
  title: string;
  body: string;
  kind: string;
  created_at: string;
  read_at: string | null;
}
