import { useState, type ChangeEvent } from 'react';
import { listLeaveTypes, setLeaveBalanceTotal } from '../api/leave';
import { listRoster } from '../api/directory';
import { BackHeader } from '../components/PageHeader';
import { parseCsv, downloadCsv } from '../lib/csv';
import type { Profile } from '../types';

interface Row {
  employeeCode: string;
  leaveTypeCode: string;
  total: string;
  error: string | null;
}

type RowResult = 'pending' | 'done' | 'failed';

export function BulkLeaveBalances() {
  const [rows, setRows] = useState<Row[]>([]);
  const [rosterLookup, setRosterLookup] = useState<Map<string, Profile>>(new Map());
  const [results, setResults] = useState<Record<number, { status: RowResult; message?: string }>>({});
  const [uploading, setUploading] = useState(false);
  const year = new Date().getFullYear();

  const onFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const text = await file.text();
    const [roster, leaveTypes] = await Promise.all([listRoster(), listLeaveTypes()]);
    const codeToProfile = new Map(roster.map((p) => [p.employee_code.toLowerCase(), p]));
    const validTypes = new Set<string>(leaveTypes.map((t) => t.code));

    const parsed = parseCsv(text).slice(1); // first row is the header
    const built: Row[] = parsed.map(([employeeCode, leaveTypeCode, total]) => {
      let error: string | null = null;
      if (!employeeCode || !leaveTypeCode || !total) error = 'Missing a value';
      else if (!codeToProfile.has(employeeCode.toLowerCase())) error = `Unknown employee code "${employeeCode}"`;
      else if (!validTypes.has(leaveTypeCode)) error = `Unknown leave type "${leaveTypeCode}"`;
      else if (Number.isNaN(Number(total)) || Number(total) < 0) error = 'Total must be a positive number';
      return { employeeCode, leaveTypeCode, total, error };
    });
    setRows(built);
    setResults({});
    setRosterLookup(codeToProfile);
  };

  const onUpload = async () => {
    setUploading(true);
    const validRows = rows.map((r, i) => ({ r, i })).filter(({ r }) => !r.error);
    for (const { r, i } of validRows) {
      setResults((prev) => ({ ...prev, [i]: { status: 'pending' } }));
      try {
        const profile = rosterLookup.get(r.employeeCode.toLowerCase());
        if (!profile) throw new Error('Employee not found');
        await setLeaveBalanceTotal(profile.id, r.leaveTypeCode, Number(r.total), year);
        setResults((prev) => ({ ...prev, [i]: { status: 'done' } }));
      } catch (err) {
        setResults((prev) => ({ ...prev, [i]: { status: 'failed', message: err instanceof Error ? err.message : 'Failed' } }));
      }
    }
    setUploading(false);
  };

  const validCount = rows.filter((r) => !r.error).length;
  const invalidCount = rows.length - validCount;

  return (
    <>
      <BackHeader title="Bulk leave balances" />
      <div style={{ fontSize: 12, color: 'var(--color-neutral-700)', marginBottom: 14 }}>
        Upload a CSV with columns <b>employee_code, leave_type_code, total</b> — one row per balance to set for {year}.
      </div>
      <button
        className="btn btn-secondary"
        style={{ marginBottom: 14, fontSize: 12 }}
        onClick={() => downloadCsv('leave-balances-template.csv', [
          ['employee_code', 'leave_type_code', 'total'],
          ['R1001', 'SL', '12'],
          ['R1001', 'CL', '12'],
        ])}
      >
        Download example CSV
      </button>

      <label className="btn btn-primary" style={{ display: 'block', textAlign: 'center', marginBottom: 18, cursor: 'pointer' }}>
        Choose CSV file
        <input type="file" accept=".csv" onChange={onFile} style={{ display: 'none' }} />
      </label>

      {rows.length > 0 && (
        <>
          <div className="section-label" style={{ marginBottom: 10 }}>
            {validCount} ready{invalidCount > 0 ? `, ${invalidCount} with errors (won't be uploaded)` : ''}
          </div>
          {rows.map((r, i) => {
            const result = results[i];
            return (
              <div key={i} className="card" style={{ padding: '10px 14px', marginBottom: 8, opacity: r.error ? 0.55 : 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                  <div style={{ fontSize: 13, fontWeight: 700 }}>{r.employeeCode} · {r.leaveTypeCode} · {r.total}</div>
                  {result && (
                    <span
                      className="tag"
                      style={{
                        background: result.status === 'done' ? 'var(--status-present-bg)' : result.status === 'failed' ? 'var(--status-absent-bg)' : 'var(--status-late-bg)',
                        color: result.status === 'done' ? 'var(--status-present-text)' : result.status === 'failed' ? 'var(--status-absent-text)' : 'var(--status-late-text)',
                      }}
                    >
                      {result.status === 'pending' ? 'Saving...' : result.status === 'done' ? 'Saved' : 'Failed'}
                    </span>
                  )}
                </div>
                {r.error && <div style={{ fontSize: 11, color: 'var(--status-absent-text)', marginTop: 4 }}>{r.error}</div>}
                {result?.message && <div style={{ fontSize: 11, color: 'var(--status-absent-text)', marginTop: 4 }}>{result.message}</div>}
              </div>
            );
          })}
          <button className="btn btn-primary" style={{ width: '100%', padding: '11px 14px', marginTop: 10 }} disabled={uploading || validCount === 0} onClick={onUpload}>
            {uploading ? 'Uploading...' : `Upload ${validCount} row${validCount === 1 ? '' : 's'}`}
          </button>
        </>
      )}
    </>
  );
}
