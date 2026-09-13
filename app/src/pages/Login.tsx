import { useState, type FormEvent } from 'react';
import { useAuth } from '../context/AuthContext';

export function Login() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const message = await signIn(email, password);
    setBusy(false);
    if (message) setError(message);
  };

  return (
    <div className="app-viewport" style={{ alignItems: 'center' }}>
      <div style={{ width: '100%', maxWidth: 360, padding: '0 20px' }}>
        <div className="kicker">Rajan Dental</div>
        <h1 style={{ fontSize: 30, marginBottom: 24 }}>Sign in</h1>
        <form onSubmit={onSubmit}>
          <label style={{ display: 'block', fontSize: 11, color: 'var(--color-neutral-700)', marginBottom: 5 }}>
            Email
          </label>
          <input
            className="input"
            type="email"
            required
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={{ marginBottom: 14 }}
          />
          <label style={{ display: 'block', fontSize: 11, color: 'var(--color-neutral-700)', marginBottom: 5 }}>
            Password
          </label>
          <input
            className="input"
            type="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={{ marginBottom: 18 }}
          />
          {error && (
            <div style={{ fontSize: 13, color: 'var(--color-accent-700)', marginBottom: 14 }}>{error}</div>
          )}
          <button className="btn btn-primary" type="submit" disabled={busy} style={{ width: '100%', padding: '11px 14px' }}>
            {busy ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
        <p style={{ fontSize: 12, color: 'var(--color-neutral-700)', marginTop: 18 }}>
          Don't have an account yet? Ask your manager to invite you.
        </p>
      </div>
    </div>
  );
}
