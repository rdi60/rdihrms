import { listAttendanceRange } from './attendance';
import { listApprovedLeaveOverlapping } from './leave';
import { listDepartments } from './departments';
import { listRoster } from './directory';
import { eachDateInRange, formatTimeWithSeconds, toDateStr } from '../lib/dates';
import type { AttendanceDay, Profile } from '../types';

interface LeaveMark {
  code: string;
  duration: 'full' | 'half' | 'permission';
}

async function buildContext(startStr: string, endStr: string) {
  const [roster, departments, attendance, approvedLeave] = await Promise.all([
    listRoster(),
    listDepartments(),
    listAttendanceRange(startStr, endStr),
    listApprovedLeaveOverlapping(startStr, endStr),
  ]);

  const deptById = new Map(departments.map((d) => [d.id, d.name]));
  const attendanceByProfileDate = new Map<string, AttendanceDay>();
  for (const a of attendance) attendanceByProfileDate.set(`${a.profile_id}|${a.work_date}`, a);

  const leaveByProfileDate = new Map<string, LeaveMark>();
  for (const req of approvedLeave) {
    if (req.duration === 'permission') continue; // permission doesn't replace a whole day's punch
    for (const d of eachDateInRange(new Date(`${req.start_date}T00:00:00`), new Date(`${req.end_date}T00:00:00`))) {
      leaveByProfileDate.set(`${req.profile_id}|${toDateStr(d)}`, { code: req.leave_type_code, duration: req.duration });
    }
  }

  return { roster, deptById, attendanceByProfileDate, leaveByProfileDate };
}

function dayCell(
  profileId: string,
  dateStr: string,
  isSunday: boolean,
  attendanceByProfileDate: Map<string, AttendanceDay>,
  leaveByProfileDate: Map<string, LeaveMark>
): { in: string; out: string } {
  const a = attendanceByProfileDate.get(`${profileId}|${dateStr}`);
  const leave = leaveByProfileDate.get(`${profileId}|${dateStr}`);

  if (isSunday) return { in: 'SUN', out: 'SUN' };
  if (leave && leave.duration === 'full') return { in: leave.code, out: leave.code };
  if (leave && leave.duration === 'half') {
    if (a?.clock_in || a?.clock_out) {
      return { in: a?.clock_in ? formatTimeWithSeconds(a.clock_in) : leave.code, out: leave.code };
    }
    return { in: leave.code, out: leave.code };
  }
  if (a?.status === 'weekend') return { in: 'WO', out: 'WO' };
  if (a?.status === 'holiday') return { in: 'HOL', out: 'HOL' };
  if (a?.clock_in || a?.clock_out) {
    return { in: formatTimeWithSeconds(a.clock_in), out: formatTimeWithSeconds(a.clock_out) };
  }
  return { in: 'LOP', out: 'LOP' };
}

export interface PunchReportRow {
  employeeCode: string;
  fullName: string;
  department: string;
  shiftStart: string;
  shiftEnd: string;
  days: { in: string; out: string }[]; // index 0 = first day of the requested range
}

/** Builds a day-by-day punch grid for an arbitrary date range (1 to 31 days). */
export async function buildRangePunchReport(startStr: string, endStr: string): Promise<PunchReportRow[]> {
  const start = new Date(`${startStr}T00:00:00`);
  const end = new Date(`${endStr}T00:00:00`);
  const { roster, deptById, attendanceByProfileDate, leaveByProfileDate } = await buildContext(startStr, endStr);
  const dates = eachDateInRange(start, end);

  return roster.filter((p) => p.is_active).map((p: Profile) => ({
    employeeCode: p.employee_code,
    fullName: p.full_name,
    department: p.department_id ? deptById.get(p.department_id) ?? '' : '',
    shiftStart: p.shift_start,
    shiftEnd: p.shift_end,
    days: dates.map((d) =>
      dayCell(p.id, toDateStr(d), d.getDay() === 0, attendanceByProfileDate, leaveByProfileDate)
    ),
  }));
}

export async function buildMonthPunchReport(year: number, month: number /* 0-indexed */): Promise<PunchReportRow[]> {
  const start = toDateStr(new Date(year, month, 1));
  const end = toDateStr(new Date(year, month + 1, 0));
  return buildRangePunchReport(start, end);
}
