import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { listLeaveBalances, listLeaveTypes, setLeaveBalanceTotal } from '../api/leave';
import { listRoster } from '../api/directory';
import { BackHeader } from '../components/PageHeader';
import type { LeaveBalance, LeaveType, Profile } from '../types';

export function StaffLeaveBalances() {
  const { id } = useParams<{ id: string }>();
  const [staff, setStaff] = useState<Profile | null>(null);
  const [leaveTypes, setLeaveTypes] = useState<LeaveType[]>([]);
  const [balances, setBalances] = useState<LeaveBalance[]>([]);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [savingCode, setSavingCode] = useState<string | null>(null);
  const [savedCode, setSavedCode] = useState<string | null>(null);
  const year = new Date().getFullYear();

  const load = async () => {
    if (!id) return;
    const [roster, types, bals] = await Promise.all([listRoster(), listLeaveTypes(), listLeaveBalances(id)]);
    setStaff(roster.find((p) => p.id === id) ?? null);
    setLeaveTypes(types);
    setBalances(bals);
    setDrafts(Object.fromEntries(types.map((t) => [t.code, String(bals.find((b) => b.leave_type_code === t.code)?.total ?? 0)])));
  };

  useEffect(() => {
    load();
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!id) return null;

  const onSave = async (code: string) => {
    const total = Number(drafts[code]);
    if (Number.isNaN(total) || total < 0) return;
    setSavingCode(code);
    setSavedCode(null);
    try {
      await setLeaveBalanceTotal(id, code, total, year);
      await load();
      setSavedCode(code);
      setTimeout(() => setSavedCode((c) => (c === code ? null : c)), 1500);
    } finally {
      setSavingCode(null);
    }
  };

  return (
    <>
      <BackHeader title={staff ? `${staff.full_name}'s balances` : 'Leave balances'} />
      <div style={{ fontSize: 12, color: 'var(--color-neutral-700)', marginBottom: 18 }}>
        Set each leave type's total for {year}. Used amounts are tracked automatically as requests get approved.
      </div>

      {leaveTypes.map((t) => {
        const used = balances.find((b) => b.leave_type_code === t.code)?.used ?? 0;
        const suffix = t.unit === 'hour' ? ' hrs' : ' days';
        return (
          <div key={t.code} className="card" style={{ padding: 14, marginBottom: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <div style={{ fontWeight: 700, fontSize: 14 }}>{t.label}</div>
              <span style={{ fontSize: 11, color: 'var(--color-neutral-700)' }}>{used}{suffix} used</span>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                className="input"
                type="number"
                min={0}
                step="0.5"
                value={drafts[t.code] ?? ''}
                onChange={(e) => setDrafts((d) => ({ ...d, [t.code]: e.target.value }))}
                style={{ flex: 1 }}
              />
              <button
                className="btn btn-secondary"
                disabled={savingCode === t.code}
                style={{ padding: '9px 16px', fontSize: 12, color: savedCode === t.code ? 'var(--status-present-text)' : undefined }}
                onClick={() => onSave(t.code)}
              >
                {savingCode === t.code ? 'Saving...' : savedCode === t.code ? 'Saved' : 'Save'}
              </button>
            </div>
          </div>
        );
      })}
    </>
  );
}
