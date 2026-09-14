import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { createStaff } from '../api/admin';
import { listDepartments } from '../api/departments';
import { BackHeader } from '../components/PageHeader';
import type { Department } from '../types';

export function AddStaff() {
  const navigate = useNavigate();
  const [departments, setDepartments] = useState<Department[]>([]);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [employeeCode, setEmployeeCode] = useState('');
  const [role, setRole] = useState<'staff' | 'manager'>('staff');
  const [departmentId, setDepartmentId] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    listDepartments().then(setDepartments);
  }, []);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!fullName.trim() || !email.trim() || !password || !employeeCode.trim()) {
      setError('Fill in all required fields.');
      return;
    }
    setBusy(true);
    try {
      await createStaff({
        fullName: fullName.trim(),
        email: email.trim(),
        password,
        employeeCode: employeeCode.trim(),
        role,
        departmentId: departmentId || null,
      });
      navigate('/profile/staff');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create the account.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <BackHeader title="Add staff" />
      <form onSubmit={onSubmit}>
        <label style={{ display: 'block', fontSize: 11, color: 'var(--color-neutral-700)', marginBottom: 5 }}>Full name</label>
        <input className="input" value={fullName} onChange={(e) => setFullName(e.target.value)} style={{ marginBottom: 14 }} />

        <label style={{ display: 'block', fontSize: 11, color: 'var(--color-neutral-700)', marginBottom: 5 }}>Email</label>
        <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} style={{ marginBottom: 14 }} />

        <label style={{ display: 'block', fontSize: 11, color: 'var(--color-neutral-700)', marginBottom: 5 }}>Temporary password</label>
        <input className="input" type="text" value={password} onChange={(e) => setPassword(e.target.value)} style={{ marginBottom: 14 }} />

        <label style={{ display: 'block', fontSize: 11, color: 'var(--color-neutral-700)', marginBottom: 5 }}>Employee code</label>
        <input className="input" value={employeeCode} onChange={(e) => setEmployeeCode(e.target.value)} style={{ marginBottom: 14 }} />

        <label style={{ display: 'block', fontSize: 11, color: 'var(--color-neutral-700)', marginBottom: 5 }}>Role</label>
        <div className="seg" style={{ marginBottom: 14 }}>
          <button type="button" className="seg-opt" data-active={role === 'staff'} onClick={() => setRole('staff')}>Staff</button>
          <button type="button" className="seg-opt" data-active={role === 'manager'} onClick={() => setRole('manager')}>Manager</button>
        </div>

        <label style={{ display: 'block', fontSize: 11, color: 'var(--color-neutral-700)', marginBottom: 5 }}>Department (optional)</label>
        <select className="input" value={departmentId} onChange={(e) => setDepartmentId(e.target.value)} style={{ marginBottom: 18 }}>
          <option value="">No department</option>
          {departments.map((d) => (
            <option key={d.id} value={d.id}>{d.name}</option>
          ))}
        </select>

        {error && <div style={{ fontSize: 13, color: 'var(--color-accent-700)', marginBottom: 14 }}>{error}</div>}

        <button className="btn btn-primary" type="submit" disabled={busy} style={{ width: '100%', padding: '11px 14px' }}>
          {busy ? 'Creating...' : 'Create account'}
        </button>
      </form>
    </>
  );
}
