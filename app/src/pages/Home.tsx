import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { clockIn, clockOut, getTodayAttendance, listRecentActivity } from '../api/attendance';
import { hasUnreadNotifications } from '../api/notifications';
import { formatTime } from '../lib/dates';
import { BellIcon, ClockIcon, LogOutIcon, CheckCircleIcon } from '../icons';
import type { AttendanceDay } from '../types';

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
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', paddingTop: 6 }}>
        <div>
          <div className="kicker">Rajan Dental</div>
          <h1 style={{ fontSize: 30 }}>Attendance</h1>
        </div>
        <button className="icon-btn" onClick={() => navigate('/notifications')} style={{ position: 'relative', fontSize: 22 }}>
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
      </div>
      <div className="hr" style={{ margin: '16px 0 20px' }} />

      <div style={{ background: 'var(--color-surface)', padding: 20 }}>
        <div className="kicker" style={{ marginBottom: 6 }}>
          {clockedIn ? 'On the clock' : 'Not clocked in'}
        </div>
        <div style={{ fontSize: 20, fontWeight: 800, marginBottom: 16 }}>
          {clockedIn ? `Since ${formatTime(today?.clock_in ?? null)}` : 'Ready when you are'}
        </div>
        <button
          onClick={onToggleClock}
          disabled={busy}
          className="btn"
          style={{
            width: '100%', justifyContent: 'flex-start', gap: 10,
            background: clockedIn ? '#201e1d' : 'var(--color-accent)', color: 'var(--color-bg)',
            padding: '14px 16px', fontSize: 16,
          }}
        >
          <span style={{ fontSize: 20, display: 'flex' }}>
            <ClockIcon />
          </span>
          {clockedIn ? 'Clock out' : 'Clock in'}
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2, marginTop: 16, background: 'var(--color-divider)' }}>
        <div style={{ background: 'var(--color-bg)', padding: 16 }}>
          <div className="section-label" style={{ marginBottom: 6 }}>Scheduled shift</div>
          <div style={{ fontSize: 16, fontWeight: 600 }}>
            {profile.shift_start.slice(0, 5)}–{profile.shift_end.slice(0, 5)}
          </div>
        </div>
        <div style={{ background: 'var(--color-bg)', padding: 16 }}>
          <div className="section-label" style={{ marginBottom: 6 }}>Weekly hours</div>
          <div style={{ fontSize: 16, fontWeight: 600 }}>{profile.weekly_hours}h</div>
        </div>
      </div>

      <div className="section-label" style={{ margin: '24px 0 8px' }}>Recent activity</div>
      {recent.length === 0 && <div style={{ fontSize: 13, color: 'var(--color-neutral-700)', padding: '11px 0' }}>No activity yet.</div>}
      {recent.map((a) => (
        <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 0', borderBottom: '1px solid var(--color-divider)' }}>
          <span style={{ fontSize: 16, color: 'var(--color-neutral-700)', display: 'flex' }}>
            {a.clock_out ? <LogOutIcon /> : a.status === 'leave' ? <CheckCircleIcon /> : <ClockIcon />}
          </span>
          <span style={{ flex: 1, fontSize: 14 }}>
            {a.status === 'leave' ? 'On leave' : a.clock_out ? 'Clocked out' : 'Clocked in'}
          </span>
          <span style={{ fontSize: 12, color: 'var(--color-neutral-500)' }}>
            {new Date(`${a.work_date}T00:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
          </span>
        </div>
      ))}
    </>
  );
}
