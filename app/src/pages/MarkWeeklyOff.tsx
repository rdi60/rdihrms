import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { clearWeeklyOff, listAttendanceRange, markWeeklyOff } from '../api/attendance';
import { listRoster } from '../api/directory';
import { listMyManagedDepartmentIds } from '../api/departments';
import { BackHeader } from '../components/PageHeader';
import { toDateStr } from '../lib/dates';
import type { AttendanceDay, Profile } from '../types';

export function MarkWeeklyOff() {
  const { profile } = useAuth();
  const [date, setDate] = useState(toDateStr(new Date()));
  const [roster, setRoster] = useState<Profile[]>([]);
  const [scopedDeptIds, setScopedDeptIds] = useState<string[]>([]);
  const [dayRecords, setDayRecords] = useState<AttendanceDay[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!profile) return;
    listRoster().then(setRoster);
    listMyManagedDepartmentIds(profile.id).then(setScopedDeptIds);
  }, [profile]);

  const loadDay = () => listAttendanceRange(date, date).then(setDayRecords);

  useEffect(() => {
    loadDay();
    setSelected(new Set());
  }, [date]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!profile) return null;

  // Admins aren't assigned to a department and see everyone. A manager
  // assigned to no department has no team yet, and should see nobody —
  // not fall back to everyone.
  const isUnscopedAdmin = profile.role === 'admin' && scopedDeptIds.length === 0;
  const scopedRoster = (isUnscopedAdmin
    ? roster
    : roster.filter((p) => p.department_id && scopedDeptIds.includes(p.department_id))
  ).filter((p) => p.is_active);

  const statusByProfile = new Map(dayRecords.map((r) => [r.profile_id, r]));

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const onMark = async () => {
    setBusy(true);
    setError(null);
    try {
      for (const id of selected) await markWeeklyOff(id, date);
      setSelected(new Set());
      await loadDay();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not mark weekly off.');
    } finally {
      setBusy(false);
    }
  };

  const onRemove = async (id: string) => {
    setBusy(true);
    setError(null);
    try {
      await clearWeeklyOff(id, date);
      await loadDay();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not remove the weekly off mark.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <BackHeader title="Mark weekly off" />
      <div style={{ fontSize: 12, color: 'var(--color-neutral-700)', marginBottom: 14 }}>
        Select staff and a date to mark as their weekly off (WO). Shows up as WO in Team calendar, History, and
        reports for that day.
      </div>
      <input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} style={{ marginBottom: 14 }} />

      {error && (
        <div className="card" style={{ padding: '10px 12px', marginBottom: 14, background: 'var(--status-absent-bg)', color: 'var(--status-absent-text)', fontSize: 13, boxShadow: 'none' }}>
          {error}
        </div>
      )}

      {scopedRoster.map((p) => {
        const rec = statusByProfile.get(p.id);
        const isWO = rec?.status === 'weekend';
        const isSelected = selected.has(p.id);
        return (
          <div key={p.id} className="card" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', marginBottom: 8 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 700, fontSize: 14 }}>{p.full_name}</div>
              <div style={{ fontSize: 11, color: 'var(--color-neutral-700)' }}>
                {p.employee_code}{rec ? ` · ${isWO ? 'WO' : rec.status}` : ''}
              </div>
            </div>
            {isWO ? (
              <button className="btn btn-secondary" style={{ fontSize: 12, padding: '7px 12px' }} disabled={busy} onClick={() => onRemove(p.id)}>
                Remove WO
              </button>
            ) : (
              <button
                className={isSelected ? 'btn' : 'btn btn-secondary'}
                style={isSelected
                  ? { fontSize: 12, padding: '7px 12px', background: 'var(--color-accent-gradient)', color: '#fff7f2' }
                  : { fontSize: 12, padding: '7px 12px' }}
                disabled={busy}
                onClick={() => toggle(p.id)}
              >
                {isSelected ? 'Selected' : 'Select'}
              </button>
            )}
          </div>
        );
      })}

      <button className="btn btn-primary" style={{ width: '100%', padding: '11px 14px', marginTop: 10 }} disabled={busy || selected.size === 0} onClick={onMark}>
        {busy ? 'Marking...' : `Mark ${selected.size} as WO`}
      </button>
    </>
  );
}
