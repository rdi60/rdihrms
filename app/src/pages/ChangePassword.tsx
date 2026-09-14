import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { BackHeader } from '../components/PageHeader';

export function ChangePassword() {
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [busy, setBusy] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (error) {
      setError(error.message);
      return;
    }
    setSuccess(true);
    setTimeout(() => navigate('/profile'), 1200);
  };

  return (
    <>
      <BackHeader title="Change password" />
      {success ? (
        <div style={{ padding: '24px 0', textAlign: 'center', color: 'var(--color-accent-700)', fontSize: 14, fontWeight: 600 }}>
          Password updated.
        </div>
      ) : (
        <form onSubmit={onSubmit}>
          <label style={{ display: 'block', fontSize: 11, color: 'var(--color-neutral-700)', marginBottom: 5 }}>
            New password
          </label>
          <input
            className="input"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={{ marginBottom: 14 }}
          />
          <label style={{ display: 'block', fontSize: 11, color: 'var(--color-neutral-700)', marginBottom: 5 }}>
            Confirm new password
          </label>
          <input
            className="input"
            type="password"
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            style={{ marginBottom: 18 }}
          />
          {error && (
            <div style={{ fontSize: 13, color: 'var(--color-accent-700)', marginBottom: 14 }}>{error}</div>
          )}
          <button className="btn btn-primary" type="submit" disabled={busy} style={{ width: '100%', padding: '11px 14px' }}>
            {busy ? 'Updating...' : 'Update password'}
          </button>
        </form>
      )}
    </>
  );
}
