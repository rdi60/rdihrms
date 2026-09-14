import { useState, type ChangeEvent } from 'react';
import { uploadStaffPhoto } from '../api/admin';
import { listRoster } from '../api/directory';
import { BackHeader } from '../components/PageHeader';
import type { Profile } from '../types';

interface Row {
  file: File;
  previewUrl: string;
  employeeCode: string;
  profile: Profile | null;
}

type RowResult = 'pending' | 'done' | 'failed';

export function BulkStaffPhotos() {
  const [rows, setRows] = useState<Row[]>([]);
  const [results, setResults] = useState<Record<number, { status: RowResult; message?: string }>>({});
  const [uploading, setUploading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const onFiles = async (e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = '';
    if (files.length === 0) return;
    setLoadError(null);
    try {
      const roster = await listRoster();
      const codeToProfile = new Map(roster.map((p) => [p.employee_code.toLowerCase(), p]));

      const built: Row[] = files.map((file) => {
        const employeeCode = file.name.replace(/\.[^/.]+$/, '').trim();
        return {
          file,
          previewUrl: URL.createObjectURL(file),
          employeeCode,
          profile: codeToProfile.get(employeeCode.toLowerCase()) ?? null,
        };
      });
      setRows(built);
      setResults({});
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Could not load the staff list.');
    }
  };

  const onUpload = async () => {
    setUploading(true);
    const validRows = rows.map((r, i) => ({ r, i })).filter(({ r }) => r.profile);
    for (const { r, i } of validRows) {
      setResults((prev) => ({ ...prev, [i]: { status: 'pending' } }));
      try {
        await uploadStaffPhoto(r.profile!.id, r.file);
        setResults((prev) => ({ ...prev, [i]: { status: 'done' } }));
      } catch (err) {
        setResults((prev) => ({ ...prev, [i]: { status: 'failed', message: err instanceof Error ? err.message : 'Failed' } }));
      }
    }
    setUploading(false);
  };

  const validCount = rows.filter((r) => r.profile).length;
  const invalidCount = rows.length - validCount;

  return (
    <>
      <BackHeader title="Bulk staff photos" />
      <div style={{ fontSize: 12, color: 'var(--color-neutral-700)', marginBottom: 14 }}>
        Select multiple photos at once. Each file must be named after the staff member's <b>employee code</b>
        (e.g. <b>R1001.jpg</b>) so it can be matched to the right profile.
      </div>

      <label className="btn btn-primary" style={{ display: 'block', textAlign: 'center', marginBottom: 18, cursor: 'pointer' }}>
        Choose photos
        <input type="file" accept="image/*" multiple onChange={onFiles} style={{ display: 'none' }} />
      </label>

      {loadError && (
        <div className="card" style={{ padding: '10px 12px', marginBottom: 14, background: 'var(--status-absent-bg)', color: 'var(--status-absent-text)', fontSize: 13, boxShadow: 'none' }}>
          {loadError}
        </div>
      )}

      {rows.length > 0 && (
        <>
          <div className="section-label" style={{ marginBottom: 10 }}>
            {validCount} matched{invalidCount > 0 ? `, ${invalidCount} unmatched (won't be uploaded)` : ''}
          </div>
          {rows.map((r, i) => {
            const result = results[i];
            return (
              <div key={i} className="card" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', marginBottom: 8, opacity: r.profile ? 1 : 0.55 }}>
                <img src={r.previewUrl} alt="" style={{ width: 40, height: 40, borderRadius: 'var(--radius-sm)', objectFit: 'cover', flex: 'none' }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 700 }}>{r.profile?.full_name ?? r.employeeCode}</div>
                  <div style={{ fontSize: 11, color: 'var(--color-neutral-700)' }}>
                    {r.profile ? r.employeeCode : `No staff member with code "${r.employeeCode}"`}
                  </div>
                  {result?.message && <div style={{ fontSize: 11, color: 'var(--status-absent-text)', marginTop: 2 }}>{result.message}</div>}
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
                    {result.status === 'pending' ? 'Uploading...' : result.status === 'done' ? 'Uploaded' : 'Failed'}
                  </span>
                )}
              </div>
            );
          })}
          <button className="btn btn-primary" style={{ width: '100%', padding: '11px 14px', marginTop: 10 }} disabled={uploading || validCount === 0} onClick={onUpload}>
            {uploading ? 'Uploading...' : `Upload ${validCount} photo${validCount === 1 ? '' : 's'}`}
          </button>
        </>
      )}
    </>
  );
}
