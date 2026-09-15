import { useEffect, useState } from 'react';
import { getAdminPermissions, listAdmins, listPromotableStaff, revokeAdmin, setAdminAccess } from '../api/adminAccess';
import { PageHeader } from '../components/PageHeader';
import { Avatar } from '../components/Avatar';
import { SearchIcon } from '../icons';
import type { AdminPermission, Profile } from '../types';

const PERMISSIONS: { key: AdminPermission; label: string; hint: string }[] = [
  { key: 'staff', label: 'Staff management', hint: 'Create/deactivate staff, edit profiles, roles & departments' },
  { key: 'leave_attendance', label: 'Leave & attendance', hint: 'Approve leave, edit balances, mark weekly-offs, regularize attendance' },
  { key: 'payroll_reports', label: 'Payroll & reports', hint: 'Payroll & punch reports, upload payslips' },
  { key: 'departments_holidays', label: 'Departments & holidays', hint: 'Manage departments, manager assignments, holiday calendar' },
];

export function AdminAccess() {
  const [admins, setAdmins] = useState<Profile[]>([]);
  const [adminPerms, setAdminPerms] = useState<Record<string, AdminPermission[]>>({});
  const [candidates, setCandidates] = useState<Profile[]>([]);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<Profile | null>(null);
  const [fullAccess, setFullAccess] = useState(false);
  const [permissions, setPermissions] = useState<Set<AdminPermission>>(new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    const [adminList, candidateList] = await Promise.all([listAdmins(), listPromotableStaff()]);
    setAdmins(adminList);
    setCandidates(candidateList);
    const scoped = adminList.filter((a) => !a.admin_full_access);
    const permEntries = await Promise.all(scoped.map(async (a) => [a.id, await getAdminPermissions(a.id)] as const));
    setAdminPerms(Object.fromEntries(permEntries));
  };

  useEffect(() => {
    load();
  }, []);

  const openForAdmin = (a: Profile) => {
    setSelected(a);
    setFullAccess(a.admin_full_access);
    setPermissions(new Set(adminPerms[a.id] ?? []));
    setError(null);
  };

  const openForCandidate = (c: Profile) => {
    setSelected(c);
    setFullAccess(false);
    setPermissions(new Set());
    setError(null);
  };

  const togglePermission = (key: AdminPermission) => {
    setPermissions((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const onSave = async () => {
    if (!selected) return;
    setBusy(true);
    setError(null);
    try {
      await setAdminAccess(selected.id, fullAccess, Array.from(permissions));
      setSelected(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save admin access.');
    } finally {
      setBusy(false);
    }
  };

  const onRevoke = async (a: Profile) => {
    setBusy(true);
    try {
      await revokeAdmin(a.id);
      if (selected?.id === a.id) setSelected(null);
      await load();
    } finally {
      setBusy(false);
    }
  };

  const filteredCandidates = candidates.filter((c) => c.full_name.toLowerCase().includes(query.trim().toLowerCase()));

  return (
    <>
      <PageHeader kicker="Super admin" title="Admin access" />
      <div style={{ fontSize: 12, color: 'var(--color-neutral-700)', marginBottom: 18 }}>
        Grant someone admin access with only the areas they need, or full access to everything.
      </div>

      <div className="section-label" style={{ margin: '0 0 10px' }}>Current admins</div>
      {admins.length === 0 && (
        <div className="card" style={{ padding: 14, marginBottom: 22, fontSize: 12, color: 'var(--color-neutral-500)' }}>
          No admins yet.
        </div>
      )}
      {admins.map((a) => {
        const scope = a.admin_full_access
          ? 'Full access'
          : (adminPerms[a.id] ?? []).length === 0
            ? 'No access granted'
            : (adminPerms[a.id] ?? []).map((p) => PERMISSIONS.find((x) => x.key === p)?.label ?? p).join(', ');
        return (
          <div key={a.id} className="card" style={{ padding: 14, marginBottom: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
              <Avatar profile={a} size={36} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 14 }}>{a.full_name}</div>
                <div style={{ fontSize: 12, color: 'var(--color-neutral-700)' }}>{scope}</div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-secondary" style={{ flex: 1, fontSize: 12, padding: '8px 10px' }} onClick={() => openForAdmin(a)} disabled={busy}>
                Edit access
              </button>
              <button
                className="btn btn-secondary"
                style={{ flex: 1, fontSize: 12, padding: '8px 10px', color: 'var(--status-absent-text)' }}
                onClick={() => onRevoke(a)}
                disabled={busy}
              >
                Revoke admin
              </button>
            </div>
          </div>
        );
      })}

      <div className="section-label" style={{ margin: '22px 0 10px' }}>Grant admin access</div>
      <div className="card" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', marginBottom: 14, boxShadow: 'none', border: '1px solid var(--color-divider)' }}>
        <span style={{ fontSize: 15, color: 'var(--color-neutral-700)', display: 'flex' }}><SearchIcon /></span>
        <input
          className="input"
          style={{ border: 'none', padding: 0, minHeight: 'auto' }}
          placeholder="Search staff or managers"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>
      {query.trim() && filteredCandidates.slice(0, 8).map((c) => (
        <button
          key={c.id}
          onClick={() => openForCandidate(c)}
          className="card"
          style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 12, marginBottom: 8, width: '100%', textAlign: 'left' }}
        >
          <Avatar profile={c} size={32} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: 13 }}>{c.full_name}</div>
            <div style={{ fontSize: 11, color: 'var(--color-neutral-700)' }}>{c.job_title ?? c.employee_code} · {c.role}</div>
          </div>
        </button>
      ))}

      {selected && (
        <div className="card" style={{ padding: 16, marginTop: 8, marginBottom: 22 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
            <Avatar profile={selected} size={36} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 800, fontSize: 15 }}>{selected.full_name}</div>
              <div style={{ fontSize: 12, color: 'var(--color-neutral-700)' }}>{selected.employee_code}</div>
            </div>
          </div>

          <label style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', borderBottom: '1px solid var(--color-divider)', cursor: 'pointer' }}>
            <input type="checkbox" checked={fullAccess} onChange={(e) => setFullAccess(e.target.checked)} />
            <div>
              <div style={{ fontWeight: 700, fontSize: 13 }}>Full access</div>
              <div style={{ fontSize: 11, color: 'var(--color-neutral-700)' }}>Every admin capability, same as your existing admins</div>
            </div>
          </label>

          {!fullAccess && PERMISSIONS.map((p) => (
            <label key={p.key} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 0', borderBottom: '1px solid var(--color-divider)', cursor: 'pointer' }}>
              <input type="checkbox" checked={permissions.has(p.key)} onChange={() => togglePermission(p.key)} style={{ marginTop: 2 }} />
              <div>
                <div style={{ fontWeight: 700, fontSize: 13 }}>{p.label}</div>
                <div style={{ fontSize: 11, color: 'var(--color-neutral-700)' }}>{p.hint}</div>
              </div>
            </label>
          ))}

          {error && <div style={{ fontSize: 12, color: 'var(--status-absent-text)', margin: '10px 0 0' }}>{error}</div>}

          <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
            <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setSelected(null)} disabled={busy}>
              Cancel
            </button>
            <button className="btn btn-primary" style={{ flex: 1 }} onClick={onSave} disabled={busy}>
              {busy ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
