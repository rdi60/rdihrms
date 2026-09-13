import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  BellIcon, LockIcon, GlobeIcon, HelpIcon, CalendarIcon, AwardIcon, GiftIcon, DownloadIcon,
  ChevronRightIcon, LogOutIcon,
} from '../icons';

const COMPANY_ITEMS = [
  { to: '/profile/holidays', label: 'Public holidays', Icon: CalendarIcon },
  { to: '/profile/anniversaries', label: 'Work anniversaries', Icon: AwardIcon },
  { to: '/profile/birthdays', label: 'Birthdays', Icon: GiftIcon },
  { to: '/profile/payslips', label: 'Payslips', Icon: DownloadIcon },
];

const SETTINGS_ITEMS = [
  { label: 'Notifications', Icon: BellIcon },
  { label: 'Change password', Icon: LockIcon },
  { label: 'Language', Icon: GlobeIcon },
  { label: 'Help & support', Icon: HelpIcon },
];

export function Profile() {
  const { profile, signOut } = useAuth();
  if (!profile) return null;
  const initials = profile.full_name.split(' ').map((p) => p[0]).join('');

  return (
    <>
      <div style={{ paddingTop: 6 }}>
        <div className="kicker">Account</div>
        <h1 style={{ fontSize: 28 }}>Profile</h1>
      </div>
      <div className="hr" style={{ margin: '16px 0 20px' }} />

      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 20 }}>
        <div style={{ width: 56, height: 56, flex: 'none', background: 'var(--color-surface)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 18, color: 'var(--color-neutral-700)' }}>
          {initials}
        </div>
        <div>
          <div style={{ fontWeight: 800, fontSize: 18 }}>{profile.full_name}</div>
          <div style={{ fontSize: 13, color: 'var(--color-neutral-700)' }}>
            {profile.job_title ?? (profile.role === 'manager' ? 'Manager' : 'Staff')} · Employee #{profile.employee_code}
          </div>
        </div>
      </div>

      <div className="section-label" style={{ margin: '20px 0 8px' }}>Company</div>
      {COMPANY_ITEMS.map(({ to, label, Icon }) => (
        <Link key={to} to={to} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '13px 0', borderBottom: '1px solid var(--color-divider)', textDecoration: 'none', color: 'inherit' }}>
          <span style={{ fontSize: 16, color: 'var(--color-neutral-700)', display: 'flex' }}><Icon /></span>
          <span style={{ flex: 1, fontSize: 14, color: 'var(--color-text)' }}>{label}</span>
          <span style={{ fontSize: 14, color: 'var(--color-neutral-500)', display: 'flex' }}><ChevronRightIcon /></span>
        </Link>
      ))}

      <div className="section-label" style={{ margin: '20px 0 8px' }}>Settings</div>
      {SETTINGS_ITEMS.map(({ label, Icon }) => (
        <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '13px 0', borderBottom: '1px solid var(--color-divider)' }}>
          <span style={{ fontSize: 16, color: 'var(--color-neutral-700)', display: 'flex' }}><Icon /></span>
          <span style={{ flex: 1, fontSize: 14 }}>{label}</span>
          <span style={{ fontSize: 14, color: 'var(--color-neutral-500)', display: 'flex' }}><ChevronRightIcon /></span>
        </div>
      ))}

      <button
        onClick={signOut}
        className="btn btn-secondary"
        style={{ width: '100%', justifyContent: 'flex-start', gap: 8, color: 'var(--color-accent-700)', fontWeight: 700, padding: '12px 14px', marginTop: 20 }}
      >
        <span style={{ fontSize: 16, display: 'flex' }}><LogOutIcon /></span>Log out
      </button>
    </>
  );
}
