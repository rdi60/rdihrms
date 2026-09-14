import { listAttendanceRange } from './attendance';
import { listApprovedLeaveOverlapping, listLeaveTypes } from './leave';
import { listDepartments } from './departments';
import { listRoster } from './directory';
import { eachDateInRange, toDateStr } from '../lib/dates';

export interface PayrollRow {
  employeeCode: string;
  fullName: string;
  department: string;
  present: number;
  late: number;
  absent: number;
  holiday: number;
  weekend: number;
  leaveByType: Record<string, number>;
  leaveTotal: number;
  permissionHours: number;
}

function permissionHours(from: string | null, to: string | null): number {
  if (!from || !to) return 0;
  const [fh, fm] = from.split(':').map(Number);
  const [th, tm] = to.split(':').map(Number);
  return Math.max(0, (th * 60 + tm - (fh * 60 + fm)) / 60);
}

export async function buildPayrollReport(
  year: number,
  month: number // 0-indexed
): Promise<{ rows: PayrollRow[]; leaveTypeCodes: string[] }> {
  const start = new Date(year, month, 1);
  const end = new Date(year, month + 1, 0);
  const startStr = toDateStr(start);
  const endStr = toDateStr(end);

  const [roster, departments, attendance, leaveTypes, approvedLeave] = await Promise.all([
    listRoster(),
    listDepartments(),
    listAttendanceRange(startStr, endStr),
    listLeaveTypes(),
    listApprovedLeaveOverlapping(startStr, endStr),
  ]);

  const deptById = new Map(departments.map((d) => [d.id, d.name]));
  const leaveTypeCodes = leaveTypes.map((t) => t.code).filter((c) => c !== 'Permission');

  const byProfile = new Map<string, PayrollRow>();
  for (const p of roster) {
    byProfile.set(p.id, {
      employeeCode: p.employee_code,
      fullName: p.full_name,
      department: p.department_id ? deptById.get(p.department_id) ?? '' : '',
      present: 0, late: 0, absent: 0, holiday: 0, weekend: 0,
      leaveByType: Object.fromEntries(leaveTypeCodes.map((c) => [c, 0])),
      leaveTotal: 0,
      permissionHours: 0,
    });
  }

  for (const a of attendance) {
    const row = byProfile.get(a.profile_id);
    if (!row) continue;
    if (a.status === 'present') row.present++;
    else if (a.status === 'late') row.late++;
    else if (a.status === 'absent') row.absent++;
    else if (a.status === 'holiday') row.holiday++;
    else if (a.status === 'weekend') row.weekend++;
  }

  for (const req of approvedLeave) {
    const row = byProfile.get(req.profile_id);
    if (!row) continue;
    if (req.duration === 'permission') {
      row.permissionHours += permissionHours(req.permission_from, req.permission_to);
      continue;
    }
    const amount = req.duration === 'half' ? 0.5 : 1;
    for (const d of eachDateInRange(new Date(`${req.start_date}T00:00:00`), new Date(`${req.end_date}T00:00:00`))) {
      if (d < start || d > end) continue;
      row.leaveByType[req.leave_type_code] = (row.leaveByType[req.leave_type_code] ?? 0) + amount;
      row.leaveTotal += amount;
    }
  }

  const rows = Array.from(byProfile.values()).sort((a, b) => a.fullName.localeCompare(b.fullName));
  return { rows, leaveTypeCodes };
}
