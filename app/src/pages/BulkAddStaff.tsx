import { useState, type ChangeEvent } from 'react';
import { createStaff } from '../api/admin';
import { listDepartments } from '../api/departments';
import { BackHeader } from '../components/PageHeader';
import { parseCsv, downloadCsv } from '../lib/csv';
import type { Department } from '../types';

interface Row {
  fullName: string;
  email: string;
  password: string;
  employeeCode: string;
  role: string;
  departmentName: string;
  error: string | null;
}

type RowResult = 'pending' | 'done' | 'failed';

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function BulkAddStaff() {
  const [rows, setRows] = useState<Row[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [results, setResults] = useState<Record<number, { status: RowResult; message?: string }>>({});
  const [uploading, setUploading] = useState(false);

  const onFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const text = await file.text();
    const depts = await listDepartments();
    setDepartments(depts);

    const parsed = parseCsv(text).slice(1); // first row is the header
    const built: Row[] = parsed.map(([fullName, email, password, employeeCode, role, departmentName]) => {
      let error: string | null = null;
      const normalizedRole = (role || 'staff').toLowerCase();
      if (!fullName || !email || !password || !employeeCode) error = 'Missing a required value';
      else if (password.length < 6) error = 'Password must be at least 6 characters';
      else if (normalizedRole !== 'staff' && normalizedRole !== 'manager') error = 'Role must be "staff" or "manager"';
      else if (departmentName && !depts.some((d) => d.name.toLowerCase() === departmentName.toLowerCase())) {
        error = `Unknown department "${departmentName}"`;
      }
      return { fullName, email, password, employeeCode, role: normalizedRole, departmentName: departmentName ?? '', error };
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
        const dept = r.departmentName ? departments.find((d) => d.name.toLowerCase() === r.departmentName.toLowerCase()) : null;
        await createStaff({
          fullName: r.fullName, email: r.email, password: r.password, employeeCode: r.employeeCode,
          role: r.role as 'staff' | 'manager', departmentId: dept?.id ?? null,
        });
        setResults((prev) => ({ ...prev, [i]: { status: 'done' } }));
      } catch (err) {
        setResults((prev) => ({ ...prev, [i]: { status: 'failed', message: err instanceof Error ? err.message : 'Failed' } }));
      }
      await sleep(200); // be gentle on the auth admin API
    }
    setUploading(false);
  };

  const validCount = rows.filter((r) => !r.error).length;
  const invalidCount = rows.length - validCount;

  return (
    <>
      <BackHeader title="Bulk add staff" />
      <div style={{ fontSize: 12, color: 'var(--color-neutral-700)', marginBottom: 14 }}>
        Upload a CSV with columns <b>full_name, email, password, employee_code, role, department</b> (role is "staff" or
        "manager"; department is optional and must match an existing department name).
      </div>
      <button
        className="btn btn-secondary"
        style={{ marginBottom: 14, fontSize: 12 }}
        onClick={() => downloadCsv('staff-template.csv', [
          ['full_name', 'email', 'password', 'employee_code', 'role', 'department'],
          ['Jane Doe', 'jane@rajandental.app', 'Rajan@JANE', 'R2001', 'staff', ''],
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
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 700 }}>{r.fullName || '(no name)'}</div>
                    <div style={{ fontSize: 11, color: 'var(--color-neutral-700)' }}>{r.email} · {r.employeeCode} · {r.role}</div>
                  </div>
                  {result && (
                    <span
                      className="tag"
                      style={{
                        flex: 'none',
                        background: result.status === 'done' ? 'var(--status-present-bg)' : result.status === 'failed' ? 'var(--status-absent-bg)' : 'var(--status-late-bg)',
                        color: result.status === 'done' ? 'var(--status-present-text)' : result.status === 'failed' ? 'var(--status-absent-text)' : 'var(--status-late-text)',
                      }}
                    >
                      {result.status === 'pending' ? 'Creating...' : result.status === 'done' ? 'Created' : 'Failed'}
                    </span>
                  )}
                </div>
                {r.error && <div style={{ fontSize: 11, color: 'var(--status-absent-text)', marginTop: 4 }}>{r.error}</div>}
                {result?.message && <div style={{ fontSize: 11, color: 'var(--status-absent-text)', marginTop: 4 }}>{result.message}</div>}
              </div>
            );
          })}
          <button className="btn btn-primary" style={{ width: '100%', padding: '11px 14px', marginTop: 10 }} disabled={uploading || validCount === 0} onClick={onUpload}>
            {uploading ? 'Creating...' : `Create ${validCount} staff account${validCount === 1 ? '' : 's'}`}
          </button>
        </>
      )}
    </>
  );
}
