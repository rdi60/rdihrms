import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { createDepartment, listDepartments, listManagers } from '../api/departments';
import { listRoster } from '../api/directory';
import { supabase } from '../lib/supabase';
import { ChevronRightIcon, PlusIcon } from '../icons';
import type { Department, Profile } from '../types';

export function Departments() {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [managers, setManagers] = useState<Profile[]>([]);
  const [managerDeptIds, setManagerDeptIds] = useState<Record<string, string[]>>({});
  const [newName, setNewName] = useState('');
  const [showForm, setShowForm] = useState(false);

  const load = async () => {
    const [depts, roster, mgrs, assignments] = await Promise.all([
      listDepartments(),
      listRoster(),
      listManagers(),
      supabase.from('manager_departments').select('manager_id, department_id'),
    ]);
    setDepartments(depts);
    setProfiles(roster);
    setManagers(mgrs);
    const byManager: Record<string, string[]> = {};
    for (const row of assignments.data ?? []) {
      (byManager[row.department_id] ??= []).push(row.manager_id);
    }
    setManagerDeptIds(byManager);
  };

  useEffect(() => {
    load();
  }, []);

  const onCreate = async (e: FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    await createDepartment(newName.trim());
    setNewName('');
    setShowForm(false);
    await load();
  };

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', paddingTop: 6 }}>
        <div>
          <div className="kicker">Manager</div>
          <h1 style={{ fontSize: 28 }}>Departments</h1>
        </div>
        <button className="icon-btn" onClick={() => setShowForm((v) => !v)} style={{ gap: 5, color: 'var(--color-accent-700)', fontWeight: 800, fontSize: 13 }}>
          <span style={{ fontSize: 16, display: 'flex' }}><PlusIcon /></span>New
        </button>
      </div>
      <div className="hr" style={{ margin: '16px 0 18px' }} />

      {showForm && (
        <form onSubmit={onCreate} style={{ display: 'flex', gap: 10, marginBottom: 18 }}>
          <input
            className="input"
            placeholder="Department name"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            style={{ flex: 1 }}
            autoFocus
          />
          <button className="btn btn-primary" type="submit">Create</button>
        </form>
      )}

      {departments.length > 0 && (
        <div className="card">
          {departments.map((d, i) => {
            const staffCount = profiles.filter((p) => p.department_id === d.id).length;
            const mgrNames = (managerDeptIds[d.id] ?? [])
              .map((id) => managers.find((m) => m.id === id)?.full_name)
              .filter(Boolean)
              .join(', ');
            return (
              <Link
                key={d.id}
                to={`/profile/departments/${d.id}`}
                style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '13px 16px', borderBottom: i === departments.length - 1 ? 'none' : '1px solid var(--color-divider)' }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>{d.name}</div>
                  <div style={{ fontSize: 12, color: 'var(--color-neutral-700)' }}>
                    {staffCount} staff{mgrNames ? ` · ${mgrNames}` : ' · no manager assigned'}
                  </div>
                </div>
                <span style={{ fontSize: 14, color: 'var(--color-neutral-500)', display: 'flex' }}><ChevronRightIcon /></span>
              </Link>
            );
          })}
        </div>
      )}
      {departments.length === 0 && !showForm && (
        <div style={{ padding: '24px 0', textAlign: 'center', color: 'var(--color-neutral-500)', fontSize: 13 }}>
          No departments yet — create one to start assigning staff and managers.
        </div>
      )}
    </>
  );
}
