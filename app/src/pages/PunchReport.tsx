import { useEffect, useState } from 'react';
import { buildDatePunchReport, buildMonthPunchReport, type DatePunchRow, type MonthPunchRow } from '../api/punchReport';
import { BackHeader } from '../components/PageHeader';
import { downloadCsv } from '../lib/csv';
import { formatDayLabel, monthLabel, toDateStr } from '../lib/dates';

function monthValue(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function PunchReport() {
  const [view, setView] = useState<'date' | 'month'>('date');
  const [date, setDate] = useState(toDateStr(new Date()));
  const [month, setMonth] = useState(monthValue(new Date()));
  const [dateRows, setDateRows] = useState<DatePunchRow[]>([]);
  const [monthRows, setMonthRows] = useState<MonthPunchRow[]>([]);
  const [monthDayCount, setMonthDayCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [year, monthNum] = month.split('-').map(Number);

  useEffect(() => {
    setLoading(true);
    setError(null);
    if (view === 'date') {
      buildDatePunchReport(date)
        .then(setDateRows)
        .catch((err) => setError(err instanceof Error ? err.message : 'Could not build the report.'))
        .finally(() => setLoading(false));
    } else {
      const daysInMonth = new Date(year, monthNum, 0).getDate();
      setMonthDayCount(daysInMonth);
      buildMonthPunchReport(year, monthNum - 1)
        .then(setMonthRows)
        .catch((err) => setError(err instanceof Error ? err.message : 'Could not build the report.'))
        .finally(() => setLoading(false));
    }
  }, [view, date, month]); // eslint-disable-line react-hooks/exhaustive-deps

  const onDownloadDate = () => {
    const header = ['E.Code', 'Name', 'Dept', 'Std In', 'Std Out', 'In', 'Out'];
    const rows = dateRows.map((r) => [r.employeeCode, r.fullName, r.department, r.shiftStart, r.shiftEnd, r.in, r.out]);
    downloadCsv(`punch-report-${date}.csv`, [header, ...rows]);
  };

  const onDownloadMonth = () => {
    const dayHeaders: string[] = [];
    for (let d = 1; d <= monthDayCount; d++) dayHeaders.push(`D${d} In`, `D${d} Out`);
    const header = ['E.Code', 'Name', 'Dept', 'Std In', 'Std Out', ...dayHeaders];
    const rows = monthRows.map((r) => [
      r.employeeCode, r.fullName, r.department, r.shiftStart, r.shiftEnd,
      ...r.days.flatMap((d) => [d.in, d.out]),
    ]);
    downloadCsv(`punch-report-${month}.csv`, [header, ...rows]);
  };

  return (
    <>
      <BackHeader title="Punch report" />
      <div style={{ fontSize: 12, color: 'var(--color-neutral-700)', marginBottom: 14 }}>
        Every staff member's clock in/out for a single day, or a full month laid out day-by-day — same shape as a
        biometric punch report, built from this app's own attendance and leave records.
      </div>

      <div className="seg" style={{ marginBottom: 14 }}>
        <button className="seg-opt" data-active={view === 'date'} onClick={() => setView('date')}>Date-wise</button>
        <button className="seg-opt" data-active={view === 'month'} onClick={() => setView('month')}>Month-wise</button>
      </div>

      {view === 'date' && (
        <>
          <input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} style={{ marginBottom: 14 }} />
          <button className="btn btn-primary" style={{ width: '100%', padding: '11px 14px', marginBottom: 18 }} disabled={loading || dateRows.length === 0} onClick={onDownloadDate}>
            Download CSV — {formatDayLabel(date)}
          </button>
        </>
      )}

      {view === 'month' && (
        <>
          <input className="input" type="month" value={month} onChange={(e) => setMonth(e.target.value)} style={{ marginBottom: 14 }} />
          <button className="btn btn-primary" style={{ width: '100%', padding: '11px 14px', marginBottom: 18 }} disabled={loading || monthRows.length === 0} onClick={onDownloadMonth}>
            Download CSV — {monthLabel(year, monthNum - 1)}
          </button>
        </>
      )}

      {error && (
        <div className="card" style={{ padding: '10px 12px', marginBottom: 14, background: 'var(--status-absent-bg)', color: 'var(--status-absent-text)', fontSize: 13, boxShadow: 'none' }}>
          {error}
        </div>
      )}

      {loading && <div style={{ padding: '24px 0', textAlign: 'center', color: 'var(--color-neutral-500)', fontSize: 13 }}>Building report...</div>}

      {!loading && view === 'date' && dateRows.map((r) => (
        <div key={r.employeeCode} className="card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', marginBottom: 8, gap: 10 }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: 14 }}>{r.fullName}</div>
            <div style={{ fontSize: 11, color: 'var(--color-neutral-700)' }}>{r.employeeCode} · {r.department}</div>
          </div>
          <div style={{ fontSize: 12, fontWeight: 700, textAlign: 'right', flex: 'none' }}>
            {r.in}{r.in !== r.out ? ` – ${r.out}` : ''}
          </div>
        </div>
      ))}

      {!loading && view === 'month' && monthRows.length > 0 && (
        <div style={{ padding: '24px 0', textAlign: 'center', color: 'var(--color-neutral-500)', fontSize: 13 }}>
          {monthRows.length} staff × {monthDayCount} days ready — download the CSV above to view the full grid in Excel.
        </div>
      )}
    </>
  );
}
