import { useEffect, useState } from 'react';
import { buildMonthPunchReport, buildRangePunchReport, type PunchReportRow } from '../api/punchReport';
import { BackHeader } from '../components/PageHeader';
import { downloadCsv } from '../lib/csv';
import { addDays, monthLabel, toDateStr } from '../lib/dates';

const MAX_RANGE_DAYS = 31;

function monthValue(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function daySpan(startStr: string, endStr: string): number {
  const start = new Date(`${startStr}T00:00:00`);
  const end = new Date(`${endStr}T00:00:00`);
  return Math.round((end.getTime() - start.getTime()) / 86400000) + 1;
}

function toCsv(rows: PunchReportRow[], dayCount: number, filename: string) {
  const dayHeaders: string[] = [];
  for (let d = 1; d <= dayCount; d++) dayHeaders.push(`D${d} In`, `D${d} Out`);
  const header = ['E.Code', 'Name', 'Dept', 'Std In', 'Std Out', ...dayHeaders];
  const csvRows = rows.map((r) => [
    r.employeeCode, r.fullName, r.department, r.shiftStart, r.shiftEnd,
    ...r.days.flatMap((d) => [d.in, d.out]),
  ]);
  downloadCsv(filename, [header, ...csvRows]);
}

export function PunchReport() {
  const [view, setView] = useState<'range' | 'month'>('range');
  const [startDate, setStartDate] = useState(toDateStr(new Date()));
  const [endDate, setEndDate] = useState(toDateStr(new Date()));
  const [month, setMonth] = useState(monthValue(new Date()));
  const [rows, setRows] = useState<PunchReportRow[]>([]);
  const [dayCount, setDayCount] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rangeError, setRangeError] = useState<string | null>(null);

  const [year, monthNum] = month.split('-').map(Number);
  const span = daySpan(startDate, endDate);

  useEffect(() => {
    if (view === 'range') {
      if (span < 1 || span > MAX_RANGE_DAYS) {
        setRangeError(`Choose a range of 1 to ${MAX_RANGE_DAYS} days (currently ${span}).`);
        setRows([]);
        return;
      }
      setRangeError(null);
      setLoading(true);
      setError(null);
      setDayCount(span);
      buildRangePunchReport(startDate, endDate)
        .then(setRows)
        .catch((err) => setError(err instanceof Error ? err.message : 'Could not build the report.'))
        .finally(() => setLoading(false));
    } else {
      const daysInMonth = new Date(year, monthNum, 0).getDate();
      setDayCount(daysInMonth);
      setLoading(true);
      setError(null);
      buildMonthPunchReport(year, monthNum - 1)
        .then(setRows)
        .catch((err) => setError(err instanceof Error ? err.message : 'Could not build the report.'))
        .finally(() => setLoading(false));
    }
  }, [view, startDate, endDate, month]); // eslint-disable-line react-hooks/exhaustive-deps

  const onDownloadRange = () => toCsv(rows, dayCount, `punch-report-${startDate}_to_${endDate}.csv`);
  const onDownloadMonth = () => toCsv(rows, dayCount, `punch-report-${month}.csv`);

  return (
    <>
      <BackHeader title="Punch report" />
      <div style={{ fontSize: 12, color: 'var(--color-neutral-700)', marginBottom: 14 }}>
        Every staff member's clock in/out, second-level precision — a custom date range of your choosing, or a full
        calendar month — same header layout as a biometric punch report.
      </div>

      <div className="seg" style={{ marginBottom: 14 }}>
        <button className="seg-opt" data-active={view === 'range'} onClick={() => setView('range')}>Custom range</button>
        <button className="seg-opt" data-active={view === 'month'} onClick={() => setView('month')}>Month-wise</button>
      </div>

      {view === 'range' && (
        <>
          <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', fontSize: 11, color: 'var(--color-neutral-700)', marginBottom: 5 }}>From</label>
              <input className="input" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', fontSize: 11, color: 'var(--color-neutral-700)', marginBottom: 5 }}>To</label>
              <input className="input" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
            {[7, 15, 31].map((n) => (
              <button
                key={n}
                className="btn btn-secondary"
                style={{ fontSize: 11, padding: '6px 10px' }}
                onClick={() => setEndDate(toDateStr(addDays(new Date(`${startDate}T00:00:00`), n - 1)))}
              >
                {n} days from start
              </button>
            ))}
          </div>
          {rangeError && (
            <div className="card" style={{ padding: '10px 12px', marginBottom: 14, background: 'var(--status-late-bg)', color: 'var(--status-late-text)', fontSize: 13, boxShadow: 'none' }}>
              {rangeError}
            </div>
          )}
          <button className="btn btn-primary" style={{ width: '100%', padding: '11px 14px', marginBottom: 18 }} disabled={loading || rows.length === 0 || !!rangeError} onClick={onDownloadRange}>
            Download CSV — {span} day{span === 1 ? '' : 's'}
          </button>
        </>
      )}

      {view === 'month' && (
        <>
          <input className="input" type="month" value={month} onChange={(e) => setMonth(e.target.value)} style={{ marginBottom: 14 }} />
          <button className="btn btn-primary" style={{ width: '100%', padding: '11px 14px', marginBottom: 18 }} disabled={loading || rows.length === 0} onClick={onDownloadMonth}>
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

      {!loading && !rangeError && dayCount === 1 && rows.map((r) => (
        <div key={r.employeeCode} className="card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', marginBottom: 8, gap: 10 }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: 14 }}>{r.fullName}</div>
            <div style={{ fontSize: 11, color: 'var(--color-neutral-700)' }}>{r.employeeCode} · {r.department}</div>
          </div>
          <div style={{ fontSize: 12, fontWeight: 700, textAlign: 'right', flex: 'none' }}>
            {r.days[0]?.in}{r.days[0] && r.days[0].in !== r.days[0].out ? ` – ${r.days[0].out}` : ''}
          </div>
        </div>
      ))}

      {!loading && !rangeError && dayCount > 1 && rows.length > 0 && (
        <div style={{ padding: '24px 0', textAlign: 'center', color: 'var(--color-neutral-500)', fontSize: 13 }}>
          {rows.length} staff × {dayCount} days ready — download the CSV above to view the full grid in Excel.
        </div>
      )}
    </>
  );
}
