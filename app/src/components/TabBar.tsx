import { NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { HomeIcon, CalendarIcon, ClipboardIcon, UsersIcon, UserIcon } from '../icons';

const TABS = [
  { to: '/', label: 'Home', Icon: HomeIcon, end: true },
  { to: '/history', label: 'History', Icon: CalendarIcon },
  { to: '/leave', label: 'Leave', Icon: ClipboardIcon },
  { to: '/team', label: 'Team', Icon: UsersIcon, managerOnly: true },
  { to: '/profile', label: 'Profile', Icon: UserIcon },
];

export function TabBar() {
  const { profile } = useAuth();
  const isManager = profile?.role === 'manager' || profile?.role === 'admin';

  return (
    <div className="tab-bar">
      {TABS.filter((t) => !t.managerOnly || isManager).map(({ to, label, Icon, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          className="tab-btn"
          style={({ isActive }) => ({ color: isActive ? 'var(--color-accent-700)' : 'var(--color-neutral-700)' })}
        >
          <span style={{ fontSize: 19, display: 'flex' }}>
            <Icon />
          </span>
          <span>{label}</span>
        </NavLink>
      ))}
    </div>
  );
}
