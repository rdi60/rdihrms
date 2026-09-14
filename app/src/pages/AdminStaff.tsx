import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { setProfileActive, setProfileRole } from '../api/admin';
import { listRoster } from '../api/directory';
import { PlusIcon, SearchIcon } from '../icons';
import type { Profile } from '../types';

function roleTag(role: Profile['role']) {
  if (role === 'admin') return { bg: 'var(--color-accent-200)', color: 'var(--color-accent-700)', label: 'Admin' };
  if (role === 'manager') return { bg: 'var(--color-accent-100)', color: 'var(--color-accent-800)', label: 'Manager' };
  return { bg: '#eae7e7', color: 'var(--color-neutral-700)', label: 'Staff' };
}

export function AdminStaff() {
  const navigate = useNavigate();
  const { profile: me } = useAuth();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [query, setQuery] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = async () => {
    setProfiles(await listRoster());
  };

  useEffect(() => {
    load();
  }, []);

  const onToggleRole = async (p: Profile) => {
    setBusyId(p.id);
    try {
      await setProfileRole(p.id, p.role === 'manager' ? 'staff' : 'manager');
      await load();
    } finally {
      setBusyId(null);
    }
  };

  const onToggleActive = async (p: Profile) => {
    setBusyId(p.id);
    try {
      await setProfileActive(p.id, !p.is_active);
      await load();
    } finally {
      setBusyId(null);
    }
  };

  const filtered = profiles.filter((p) => p.full_name.toLowerCase().includes(query.trim().toLowerCase()));

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', paddingTop: 6 }}>
        <div>
          <div className="kicker">Admin</div>
          <h1 style={{ fontSize: 28 }}>Staff</h1>
        </div>
        <button className="icon-btn" onClick={() => navigate('/profile/staff/new')} style={{ gap: 5, color: 'var(--color-accent-700)', fontWeight: 800, fontSize: 13 }}>
          <span style={{ fontSize: 16, display: 'flex' }}><PlusIcon /></span>New
        </button>
      </div>
      <div className="hr" style={{ margin: '16px 0 18px' }} />

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, border: '1px solid var(--color-divider)', padding: '8px 10px', marginBottom: 14 }}>
        <span style={{ fontSize: 15, color: 'var(--color-neutral-700)', display: 'flex' }}><SearchIcon /></span>
        <input
          className="input"
          style={{ border: 'none', padding: 0, minHeight: 'auto' }}
          placeholder="Search staff"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      {filtered.map((p) => {
        const tag = roleTag(p.role);
        const isSelf = p.id === me?.id;
        const isAdmin = p.role === 'admin';
        return (
          <div key={p.id} style={{ padding: '13px 0', borderBottom: '1px solid var(--color-divider)', opacity: p.is_active ? 1 : 0.55 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: 14 }}>{p.full_name}</div>
                <div style={{ fontSize: 12, color: 'var(--color-neutral-700)' }}>{p.job_title ?? p.employee_code}</div>
              </div>
              <span className="tag" style={{ background: tag.bg, color: tag.color }}>{tag.label}</span>
              {!p.is_active && (
                <span className="tag" style={{ background: '#eae7e7', color: 'var(--color-neutral-700)' }}>Deactivated</span>
              )}
            </div>
            {!isAdmin && (
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  className="btn btn-secondary"
                  disabled={busyId === p.id}
                  style={{ flex: 1, fontSize: 12, padding: '7px 10px' }}
                  onClick={() => onToggleRole(p)}
                >
                  {p.role === 'manager' ? 'Make staff' : 'Make manager'}
                </button>
                <button
                  className="btn btn-secondary"
                  disabled={busyId === p.id || isSelf}
                  style={{ flex: 1, fontSize: 12, padding: '7px 10px', color: p.is_active ? 'var(--color-accent-700)' : undefined }}
                  onClick={() => onToggleActive(p)}
                >
                  {p.is_active ? 'Deactivate' : 'Reactivate'}
                </button>
              </div>
            )}
          </div>
        );
      })}
    </>
  );
}
