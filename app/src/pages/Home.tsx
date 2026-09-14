import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { clockIn, clockOut, getTodayAttendance, listRecentActivity } from '../api/attendance';
import { hasUnreadNotifications } from '../api/notifications';
import { formatTime } from '../lib/dates';
import { BellIcon, ClockIcon, LogOutIcon, CheckCircleIcon } from '../icons';
import { Brandbar } from '../components/Logo';
import { Avatar } from '../components/Avatar';
import type { AttendanceDay } from '../types';

function roleLabel(role: string) {
  if (role === 'admin') return 'Admin';
  if (role === 'manager') return 'Manager';
  return 'Staff';
}

function roleTag(role: string) {
  if (role === 'admin') return { bg: 'var(--status-leave-bg)', color: 'var(--status-leave-text)' };
  if (role === 'manager') return { bg: 'var(--status-late-bg)', color: 'var(--status-late-text)' };
  return null;
}

export function Home() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [today, setToday] = useState<AttendanceDay | null>(null);
  const [recent, setRecent] = useState<AttendanceDay[]>([]);
  const [unread, setUnread] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!profile) return;
    const [t, r, u] = await Promise.all([
      getTodayAttendance(profile.id),
      listRecentActivity(profile.id),
      hasUnreadNotifications(profile.id),
    ]);
    setToday(t);
    setRecent(r);
    setUnread(u);
  }, [profile]);

  useEffect(() => {
    load();
  }, [load]);

  if (!profile) return null;

  const clockedIn = !!today?.clock_in && !today?.clock_out;
  const tag = roleTag(profile.role);

  const onToggleClock = async () => {
    setBusy(true);
    try {
      if (clockedIn) await clockOut(profile.id);
      else await clockIn(profile);
      await load();
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div style={{ position: 'relative', paddingTop: 14, marginBottom: 40 }}>
        <button
          className="icon-btn"
          onClick={() => navigate('/notifications')}
          style={{ position: 'absolute', top: 6, right: 0, fontSize: 20 }}
        >
          <BellIcon />
          {unread && (
            <span
              style={{
                position: 'absolute', top: 4, right: 4, width: 9, height: 9,
                background: 'var(--color-accent)', borderRadius: '50%', border: '2px solid var(--color-bg)',
              }}
            />
          )}
        </button>
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <Brandbar height={31} />
        </div>
      </div>

      <div className="card" style={{ display: 'flex', alignItems: 'center', gap: 14, padding: 18, marginBottom: 14 }}>
        <Avatar profile={profile} size={56} variant="gradient" />
        <div style={{ minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ fontWeight: 800, fontSize: 18 }}>{profile.full_name}</div>
            {tag && <span className="tag" style={{ background: tag.bg, color: tag.color }}>{roleLabel(profile.role)}</span>}
          </div>
          <div style={{ fontSize: 13, color: 'var(--color-neutral-700)' }}>
            {profile.job_title ?? roleLabel(profile.role)} · Employee #{profile.employee_code}
          </div>
        </div>
      </div>

      <div className="card" style={{ background: 'var(--color-accent-gradient)', boxShadow: 'var(--shadow-accent)', padding: 20, color: '#fff7f2' }}>
        <div style={{ fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: 700, opacity: 0.85, marginBottom: 6 }}>
          {clockedIn ? 'On the clock' : 'Not clocked in'}
        </div>
        <div style={{ fontSize: 19, fontWeight: 800, marginBottom: 16 }}>
          {clockedIn ? `Since ${formatTime(today?.clock_in ?? null)}` : 'Ready when you are'}
        </div>
        <button
          onClick={onToggleClock}
          disabled={busy}
          className="btn"
          style={{
            width: '100%', justifyContent: 'flex-start', gap: 10,
            background: '#fff', color: 'var(--color-accent-700)',
            padding: '13px 16px', fontSize: 15, boxShadow: 'none',
          }}
        >
          <span style={{ fontSize: 19, display: 'flex' }}>
            <ClockIcon />
          </span>
          {clockedIn ? 'Clock out' : 'Clock in'}
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 14 }}>
        <div className="card" style={{ padding: 15 }}>
          <div className="section-label" style={{ marginBottom: 6 }}>Scheduled shift</div>
          <div style={{ fontSize: 16, fontWeight: 700 }}>
            {profile.shift_start.slice(0, 5)}–{profile.shift_end.slice(0, 5)}
          </div>
        </div>
        <div className="card" style={{ padding: 15 }}>
          <div className="section-label" style={{ marginBottom: 6 }}>Weekly hours</div>
          <div style={{ fontSize: 16, fontWeight: 700 }}>{profile.weekly_hours}h</div>
        </div>
      </div>

      <div className="section-label" style={{ margin: '22px 0 10px' }}>Recent activity</div>
      {recent.length === 0 && <div style={{ fontSize: 13, color: 'var(--color-neutral-700)', padding: '11px 0' }}>No activity yet.</div>}
      {recent.map((a) => (
        <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '10px 0', borderBottom: '1px solid var(--color-divider)' }}>
          <span
            style={{
              fontSize: 15, color: 'var(--color-accent-700)', display: 'flex', flex: 'none',
              width: 32, height: 32, alignItems: 'center', justifyContent: 'center',
              background: 'var(--color-surface-tint)', borderRadius: 'var(--radius-sm)',
            }}
          >
            {a.clock_out ? <LogOutIcon /> : a.status === 'leave' ? <CheckCircleIcon /> : <ClockIcon />}
          </span>
          <span style={{ flex: 1, fontSize: 13.5, fontWeight: 600 }}>
            {a.status === 'leave' ? 'On leave' : a.clock_out ? 'Clocked out' : 'Clocked in'}
          </span>
          <span style={{ fontSize: 11.5, color: 'var(--color-neutral-500)' }}>
            {new Date(`${a.work_date}T00:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
          </span>
        </div>
      ))}
    </>
  );
}
