import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { listNotifications, markAllRead } from '../api/notifications';
import { BackHeader } from '../components/PageHeader';
import { NOTIF_ICONS, ClockIcon } from '../icons';
import type { AppNotification } from '../types';

function timeAgo(iso: string, now: number): string {
  const diffMs = now - new Date(iso).getTime();
  const hours = Math.floor(diffMs / 3600000);
  if (hours < 1) return 'Just now';
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return days === 1 ? 'Yesterday' : `${days}d ago`;
}

function NotificationGroup({ label, list, now }: { label: string; list: AppNotification[]; now: number }) {
  return (
    <>
      <div className="section-label" style={{ margin: '20px 0 8px' }}>{label}</div>
      {list.map((n) => {
        const Icon = NOTIF_ICONS[n.kind] ?? ClockIcon;
        return (
          <div key={n.id} className="card" style={{ display: 'flex', gap: 12, padding: 14, marginBottom: 10 }}>
            <div style={{ width: 36, height: 36, flex: 'none', background: 'var(--color-surface-tint)', borderRadius: 'var(--radius-sm)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-accent-700)', fontSize: 16 }}>
              <Icon />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 2 }}>{n.title}</div>
              <div style={{ fontSize: 13, color: 'var(--color-neutral-700)', lineHeight: 1.4 }}>{n.body}</div>
              <div style={{ fontSize: 11, color: 'var(--color-neutral-500)', marginTop: 4 }}>{timeAgo(n.created_at, now)}</div>
            </div>
          </div>
        );
      })}
    </>
  );
}

export function Notifications() {
  const { profile } = useAuth();
  const [items, setItems] = useState<AppNotification[]>([]);
  const [now] = useState(() => Date.now());

  useEffect(() => {
    if (!profile) return;
    listNotifications(profile.id).then(setItems);
    markAllRead(profile.id);
  }, [profile]);

  if (!profile) return null;

  const today = items.filter((n) => now - new Date(n.created_at).getTime() < 24 * 3600000);
  const earlier = items.filter((n) => now - new Date(n.created_at).getTime() >= 24 * 3600000);

  return (
    <>
      <BackHeader title="Notifications" />
      {items.length === 0 && (
        <div style={{ padding: '24px 0', textAlign: 'center', color: 'var(--color-neutral-500)', fontSize: 13 }}>
          Nothing yet.
        </div>
      )}
      {today.length > 0 && <NotificationGroup label="Today" list={today} now={now} />}
      {earlier.length > 0 && <NotificationGroup label="Earlier" list={earlier} now={now} />}
    </>
  );
}
