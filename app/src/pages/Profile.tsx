import type { ReactElement } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Avatar } from '../components/Avatar';
import {
  BellIcon, LockIcon, GlobeIcon, HelpIcon, CalendarIcon, AwardIcon, GiftIcon, DownloadIcon,
  ChevronRightIcon, LogOutIcon, UsersIcon, UserIcon,
} from '../icons';

const CHANGE_PASSWORD_ITEM = { to: '/profile/change-password', label: 'Change password', Icon: LockIcon };

const COMPANY_ITEMS = [
  { to: '/profile/holidays', label: 'Public holidays', Icon: CalendarIcon },
  { to: '/profile/anniversaries', label: 'Work anniversaries', Icon: AwardIcon },
  { to: '/profile/birthdays', label: 'Birthdays', Icon: GiftIcon },
  { to: '/profile/payslips', label: 'Payslips', Icon: DownloadIcon },
];

const ADMIN_ITEMS = [
  { to: '/profile/departments', label: 'Departments', Icon: UsersIcon },
  { to: '/profile/staff', label: 'Staff', Icon: UsersIcon },
  { to: '/profile/holidays/bulk', label: 'Bulk upload holidays', Icon: CalendarIcon },
  { to: '/profile/staff-dates/bulk', label: 'Bulk upload birthdays & anniversaries', Icon: GiftIcon },
  { to: '/profile/staff-photos/bulk', label: 'Bulk upload staff photos', Icon: UserIcon },
];

function roleLabel(role: string) {
  if (role === 'admin') return 'Admin';
  if (role === 'manager') return 'Manager';
  return 'Staff';
}

const SETTINGS_ITEMS = [
  { label: 'Notifications', Icon: BellIcon },
  { label: 'Language', Icon: GlobeIcon },
  { label: 'Help & support', Icon: HelpIcon },
];

function RowLink({ to, label, Icon, last }: { to: string; label: string; Icon: () => ReactElement; last?: boolean }) {
  return (
    <Link
      to={to}
      style={{
        width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '13px 16px',
        borderBottom: last ? 'none' : '1px solid var(--color-divider)', color: 'inherit',
      }}
    >
      <span style={{ fontSize: 16, color: 'var(--color-accent-700)', display: 'flex' }}><Icon /></span>
      <span style={{ flex: 1, fontSize: 14, fontWeight: 600 }}>{label}</span>
      <span style={{ fontSize: 14, color: 'var(--color-neutral-500)', display: 'flex' }}><ChevronRightIcon /></span>
    </Link>
  );
}

export function Profile() {
  const { profile, signOut } = useAuth();
  if (!profile) return null;

  return (
    <>
      <div style={{ paddingTop: 6 }}>
        <div className="kicker">Account</div>
        <h1 style={{ fontSize: 28 }}>Profile</h1>
      </div>
      <div className="hr" style={{ margin: '16px 0 20px' }} />

      <div className="card" style={{ display: 'flex', alignItems: 'center', gap: 14, padding: 18, marginBottom: 22 }}>
        <Avatar profile={profile} size={56} variant="gradient" />
        <div>
          <div style={{ fontWeight: 800, fontSize: 18 }}>{profile.full_name}</div>
          <div style={{ fontSize: 13, color: 'var(--color-neutral-700)' }}>
            {profile.job_title ?? roleLabel(profile.role)} · Employee #{profile.employee_code}
          </div>
        </div>
      </div>

      <div className="section-label" style={{ margin: '0 0 10px' }}>Company</div>
      <div className="card" style={{ marginBottom: 22 }}>
        {COMPANY_ITEMS.map(({ to, label, Icon }, i) => (
          <RowLink key={to} to={to} label={label} Icon={Icon} last={i === COMPANY_ITEMS.length - 1} />
        ))}
      </div>

      {profile.role === 'admin' && (
        <>
          <div className="section-label" style={{ margin: '0 0 10px' }}>Admin</div>
          <div className="card" style={{ marginBottom: 22 }}>
            {ADMIN_ITEMS.map(({ to, label, Icon }, i) => (
              <RowLink key={to} to={to} label={label} Icon={Icon} last={i === ADMIN_ITEMS.length - 1} />
            ))}
          </div>
        </>
      )}

      <div className="section-label" style={{ margin: '0 0 10px' }}>Settings</div>
      <div className="card" style={{ marginBottom: 22 }}>
        <RowLink to={CHANGE_PASSWORD_ITEM.to} label={CHANGE_PASSWORD_ITEM.label} Icon={CHANGE_PASSWORD_ITEM.Icon} />
        {SETTINGS_ITEMS.map(({ label, Icon }, i) => (
          <div
            key={label}
            style={{
              display: 'flex', alignItems: 'center', gap: 12, padding: '13px 16px',
              borderBottom: i === SETTINGS_ITEMS.length - 1 ? 'none' : '1px solid var(--color-divider)',
            }}
          >
            <span style={{ fontSize: 16, color: 'var(--color-accent-700)', display: 'flex' }}><Icon /></span>
            <span style={{ flex: 1, fontSize: 14, fontWeight: 600 }}>{label}</span>
            <span style={{ fontSize: 14, color: 'var(--color-neutral-500)', display: 'flex' }}><ChevronRightIcon /></span>
          </div>
        ))}
      </div>

      <button
        onClick={signOut}
        className="btn btn-secondary"
        style={{ width: '100%', justifyContent: 'flex-start', gap: 8, color: 'var(--color-accent-700)', fontWeight: 700, padding: '13px 16px' }}
      >
        <span style={{ fontSize: 16, display: 'flex' }}><LogOutIcon /></span>Log out
      </button>
    </>
  );
}
