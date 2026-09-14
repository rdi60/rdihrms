import { useState, type ChangeEvent } from 'react';
import { upsertHoliday } from '../api/directory';
import { BackHeader } from '../components/PageHeader';
import { parseCsv, downloadCsv } from '../lib/csv';

interface Row {
  date: string;
  name: string;
  error: string | null;
}

type RowResult = 'pending' | 'done' | 'failed';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function BulkHolidays() {
  const [rows, setRows] = useState<Row[]>([]);
  const [results, setResults] = useState<Record<number, { status: RowResult; message?: string }>>({});
  const [uploading, setUploading] = useState(false);

  const onFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const text = await file.text();
    const parsed = parseCsv(text).slice(1); // first row is the header
    const built: Row[] = parsed.map(([date, name]) => {
      let error: string | null = null;
      if (!date || !name) error = 'Missing a value';
      else if (!DATE_RE.test(date)) error = 'Date must be YYYY-MM-DD';
      return { date, name, error };
    });
    setRows(built);
    setResults({});
  };

  const onUpload = async () => {
    setUploading(true);
    const validRows = rows.map((r, i) => ({ r, i })).filter(({ r }) => !r.error);
    for (const { r, i } of validRows) {
      setResults((prev) => ({ ...prev, [i]: { status: 'pending' } }));
      try {
        await upsertHoliday(r.date, r.name);
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
      <BackHeader title="Bulk public holidays" />
      <div style={{ fontSize: 12, color: 'var(--color-neutral-700)', marginBottom: 14 }}>
        Upload a CSV with columns <b>date, name</b> (date as YYYY-MM-DD). Uploading a date that already exists updates its name.
      </div>
      <button
        className="btn btn-secondary"
        style={{ marginBottom: 14, fontSize: 12 }}
        onClick={() => downloadCsv('holidays-template.csv', [
          ['date', 'name'],
          ['2026-10-02', 'Gandhi Jayanti'],
          ['2026-10-21', 'Diwali'],
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
                  <div style={{ fontSize: 13, fontWeight: 700 }}>{r.date} · {r.name}</div>
                  {result && (
                    <span
                      className="tag"
                      style={{
                        flex: 'none',
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
            {uploading ? 'Uploading...' : `Upload ${validCount} holiday${validCount === 1 ? '' : 's'}`}
          </button>
        </>
      )}
    </>
  );
}
