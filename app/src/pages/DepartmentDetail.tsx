import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  assignManagerToDepartment,
  listDepartmentManagerIds,
  listDepartments,
  listManagers,
  removeManagerFromDepartment,
  setProfileDepartment,
} from '../api/departments';
import { listRoster } from '../api/directory';
import { BackHeader } from '../components/PageHeader';
import { XIcon } from '../icons';
import type { Department, Profile } from '../types';

export function DepartmentDetail() {
  const { id } = useParams<{ id: string }>();
  const [department, setDepartment] = useState<Department | null>(null);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [managers, setManagers] = useState<Profile[]>([]);
  const [assignedManagerIds, setAssignedManagerIds] = useState<string[]>([]);
  const [query, setQuery] = useState('');
  const [pickManagerId, setPickManagerId] = useState('');

  const load = async () => {
    if (!id) return;
    const [depts, roster, mgrs, mgrIds] = await Promise.all([
      listDepartments(),
      listRoster(),
      listManagers(),
      listDepartmentManagerIds(id),
    ]);
    setDepartment(depts.find((d) => d.id === id) ?? null);
    setProfiles(roster);
    setManagers(mgrs);
    setAssignedManagerIds(mgrIds);
  };

  useEffect(() => {
    load();
  }, [id]);

  if (!id) return null;

  const assignedManagers = managers.filter((m) => assignedManagerIds.includes(m.id));
  const availableManagers = managers.filter((m) => !assignedManagerIds.includes(m.id));

  const onAddManager = async () => {
    if (!pickManagerId) return;
    await assignManagerToDepartment(pickManagerId, id);
    setPickManagerId('');
    await load();
  };

  const onRemoveManager = async (managerId: string) => {
    await removeManagerFromDepartment(managerId, id);
    await load();
  };

  const onToggleStaff = async (profile: Profile) => {
    await setProfileDepartment(profile.id, profile.department_id === id ? null : id);
    await load();
  };

  const filteredStaff = profiles.filter((p) => p.full_name.toLowerCase().includes(query.trim().toLowerCase()));

  return (
    <>
      <BackHeader title={department?.name ?? 'Department'} />

      <div className="section-label" style={{ marginBottom: 10 }}>Managers</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
        {assignedManagers.map((m) => (
          <span key={m.id} className="tag" style={{ background: 'var(--color-accent-100)', color: 'var(--color-accent-800)', gap: 6, alignItems: 'center', display: 'inline-flex' }}>
            {m.full_name}
            <button onClick={() => onRemoveManager(m.id)} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', display: 'flex', color: 'inherit' }}>
              <XIcon />
            </button>
          </span>
        ))}
        {assignedManagers.length === 0 && (
          <span style={{ fontSize: 13, color: 'var(--color-neutral-500)' }}>No manager assigned yet.</span>
        )}
      </div>
      {availableManagers.length > 0 && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
          <select className="input" value={pickManagerId} onChange={(e) => setPickManagerId(e.target.value)} style={{ flex: 1 }}>
            <option value="">Add a manager...</option>
            {availableManagers.map((m) => (
              <option key={m.id} value={m.id}>{m.full_name}</option>
            ))}
          </select>
          <button className="btn btn-secondary" onClick={onAddManager} disabled={!pickManagerId}>Add</button>
        </div>
      )}

      <div className="section-label" style={{ margin: '20px 0 10px' }}>Staff</div>
      <input
        className="input"
        placeholder="Search staff"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        style={{ marginBottom: 12 }}
      />
      {filteredStaff.map((p) => {
        const inThisDept = p.department_id === id;
        return (
          <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 0', borderBottom: '1px solid var(--color-divider)' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 600 }}>{p.full_name}</div>
              <div style={{ fontSize: 12, color: 'var(--color-neutral-700)' }}>{p.job_title ?? p.employee_code}</div>
            </div>
            <button
              className="btn"
              style={
                inThisDept
                  ? { background: 'var(--color-accent)', color: 'var(--color-bg)', fontSize: 12, padding: '6px 12px' }
                  : { border: '1px solid var(--color-divider)', fontSize: 12, padding: '6px 12px' }
              }
              onClick={() => onToggleStaff(p)}
            >
              {inThisDept ? 'In department' : 'Add'}
            </button>
          </div>
        );
      })}
    </>
  );
}
