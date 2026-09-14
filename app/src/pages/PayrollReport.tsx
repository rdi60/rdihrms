import { useEffect, useState } from 'react';
import { buildPayrollReport, type PayrollRow } from '../api/payroll';
import { BackHeader } from '../components/PageHeader';
import { downloadCsv } from '../lib/csv';
import { monthLabel } from '../lib/dates';

function monthValue(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function PayrollReport() {
  const [month, setMonth] = useState(monthValue(new Date()));
  const [rows, setRows] = useState<PayrollRow[]>([]);
  const [leaveTypeCodes, setLeaveTypeCodes] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [year, monthNum] = month.split('-').map(Number);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const { rows: r, leaveTypeCodes: codes } = await buildPayrollReport(year, monthNum - 1);
      setRows(r);
      setLeaveTypeCodes(codes);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not build the report.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [month]); // eslint-disable-line react-hooks/exhaustive-deps

  const onDownload = () => {
    const header = [
      'employee_code', 'full_name', 'department', 'present', 'late', 'absent', 'holiday', 'weekend',
      ...leaveTypeCodes, 'leave_total', 'permission_hours',
    ];
    const csvRows = rows.map((r) => [
      r.employeeCode, r.fullName, r.department, String(r.present), String(r.late), String(r.absent),
      String(r.holiday), String(r.weekend), ...leaveTypeCodes.map((c) => String(r.leaveByType[c] ?? 0)),
      String(r.leaveTotal), String(r.permissionHours),
    ]);
    downloadCsv(`attendance-payroll-${month}.csv`, [header, ...csvRows]);
  };

  return (
    <>
      <BackHeader title="Payroll report" />
      <div style={{ fontSize: 12, color: 'var(--color-neutral-700)', marginBottom: 14 }}>
        A per-employee attendance summary for the month — present/late/absent days, leave taken by type, and
        permission hours — to plug into your own payroll process.
      </div>

      <input
        className="input"
        type="month"
        value={month}
        onChange={(e) => setMonth(e.target.value)}
        style={{ marginBottom: 14 }}
      />

      <button className="btn btn-primary" style={{ width: '100%', padding: '11px 14px', marginBottom: 18 }} disabled={loading || rows.length === 0} onClick={onDownload}>
        Download CSV — {monthLabel(year, monthNum - 1)}
      </button>

      {error && (
        <div className="card" style={{ padding: '10px 12px', marginBottom: 14, background: 'var(--status-absent-bg)', color: 'var(--status-absent-text)', fontSize: 13, boxShadow: 'none' }}>
          {error}
        </div>
      )}

      {loading && <div style={{ padding: '24px 0', textAlign: 'center', color: 'var(--color-neutral-500)', fontSize: 13 }}>Building report...</div>}

      {!loading && rows.map((r) => (
        <div key={r.employeeCode} className="card" style={{ padding: '12px 14px', marginBottom: 8 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, marginBottom: 6 }}>
            <div style={{ fontWeight: 700, fontSize: 14 }}>{r.fullName}</div>
            <div style={{ fontSize: 11, color: 'var(--color-neutral-700)' }}>{r.employeeCode}</div>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, fontSize: 11 }}>
            <span className="tag" style={{ background: 'var(--status-present-bg)', color: 'var(--status-present-text)' }}>Present {r.present}</span>
            <span className="tag" style={{ background: 'var(--status-late-bg)', color: 'var(--status-late-text)' }}>Late {r.late}</span>
            <span className="tag" style={{ background: 'var(--status-absent-bg)', color: 'var(--status-absent-text)' }}>Absent {r.absent}</span>
            <span className="tag" style={{ background: 'var(--status-leave-bg)', color: 'var(--status-leave-text)' }}>Leave {r.leaveTotal}</span>
            {r.permissionHours > 0 && (
              <span className="tag" style={{ background: 'var(--status-permission-bg)', color: 'var(--status-permission-text)' }}>Permission {r.permissionHours}h</span>
            )}
          </div>
        </div>
      ))}
    </>
  );
}
