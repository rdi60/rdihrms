import { useEffect, useMemo, useState } from 'react';
import { listAttendanceRange, listTodayRoster } from '../api/attendance';
import { listPendingApprovals } from '../api/leave';
import { listMyManagedDepartmentIds } from '../api/departments';
import { useAuth } from '../context/AuthContext';
import { addDays, startOfWeek, toDateStr } from '../lib/dates';
import { SearchIcon } from '../icons';
import type { AttendanceDay, Profile } from '../types';

const WEEKDAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function tagStyle(status: string) {
  if (status === 'Present') return { bg: '#f8f4f4', color: '#444141' };
  if (status === 'Late') return { bg: 'var(--color-accent-100)', color: 'var(--color-accent-800)' };
  if (status === 'Absent') return { bg: 'var(--color-accent-200)', color: 'var(--color-accent-700)' };
  return { bg: '#eae7e7', color: 'var(--color-neutral-700)' };
}

function statusLabel(a: AttendanceDay | null): string {
  if (!a) return 'Absent';
  if (a.status === 'leave') return 'On leave';
  if (a.status === 'late') return 'Late';
  return 'Present';
}

export function Team() {
  const { profile } = useAuth();
  const [tab, setTab] = useState<'roster' | 'analytics'>('roster');
  const [query, setQuery] = useState('');
  const [roster, setRoster] = useState<{ profile: Profile; today: AttendanceDay | null }[]>([]);
  const [weekDays, setWeekDays] = useState<AttendanceDay[]>([]);
  const [openLeave, setOpenLeave] = useState(0);
  const [scopedDeptIds, setScopedDeptIds] = useState<string[]>([]);

  useEffect(() => {
    if (!profile) return;
    listTodayRoster().then(setRoster);
    listPendingApprovals().then((r) => setOpenLeave(r.length));
    listMyManagedDepartmentIds(profile.id).then(setScopedDeptIds);
    const monday = startOfWeek(new Date());
    listAttendanceRange(toDateStr(monday), toDateStr(addDays(monday, 6))).then(setWeekDays);
  }, [profile]);

  // A manager assigned to no department is unscoped and sees everyone.
  const scopedRoster = scopedDeptIds.length === 0
    ? roster
    : roster.filter((r) => r.profile.department_id && scopedDeptIds.includes(r.profile.department_id));
  const scopedProfileIds = new Set(scopedRoster.map((r) => r.profile.id));
  const scopedWeekDays = scopedDeptIds.length === 0 ? weekDays : weekDays.filter((d) => scopedProfileIds.has(d.profile_id));

  const filtered = scopedRoster.filter((r) => r.profile.full_name.toLowerCase().includes(query.trim().toLowerCase()));

  const stats = useMemo(() => {
    const roster = scopedRoster;
    const weekDays = scopedWeekDays;
    const total = roster.length || 1;
    const monday = startOfWeek(new Date());
    const byDate = new Map<string, AttendanceDay[]>();
    for (const d of weekDays) {
      const list = byDate.get(d.work_date) ?? [];
      list.push(d);
      byDate.set(d.work_date, list);
    }
    const shiftByProfile = new Map(roster.map((r) => [r.profile.id, r.profile.shift_start]));

    const weekBars = WEEKDAY_LABELS.map((label, i) => {
      const dateStr = toDateStr(addDays(monday, i));
      const records = byDate.get(dateStr) ?? [];
      const isFuture = new Date(dateStr) > new Date();
      const attended = records.filter((r) => r.status === 'present' || r.status === 'late').length;
      const pct = isFuture ? 0 : Math.round((attended / total) * 100);
      return { day: label, pct, isFuture };
    });
    const countedDays = weekBars.filter((w) => !w.isFuture).length;
    const attendanceRate = countedDays ? Math.round(weekBars.reduce((a, b) => a + b.pct, 0) / countedDays) : 0;

    let presentCount = 0;
    let lateCount = 0;
    let lateMinutesSum = 0;
    for (const r of weekDays) {
      if (r.status === 'present') presentCount++;
      if (r.status === 'late') {
        lateCount++;
        if (r.clock_in) {
          const shiftStart = shiftByProfile.get(r.profile_id) ?? '09:00:00';
          const [h, m] = shiftStart.split(':').map(Number);
          const shiftDate = new Date(r.clock_in);
          shiftDate.setHours(h, m, 0, 0);
          lateMinutesSum += Math.max(0, (new Date(r.clock_in).getTime() - shiftDate.getTime()) / 60000);
        }
      }
    }
    const onTimeRate = presentCount + lateCount ? Math.round((presentCount / (presentCount + lateCount)) * 100) : 0;
    const avgLateBy = lateCount ? Math.round(lateMinutesSum / lateCount) : 0;

    return { attendanceRate, onTimeRate, avgLateBy, weekBars };
  }, [scopedRoster, scopedWeekDays]);

  return (
    <>
      <div style={{ paddingTop: 6 }}>
        <div className="kicker">Manager</div>
        <h1 style={{ fontSize: 28 }}>Team</h1>
      </div>
      <div className="hr" style={{ margin: '16px 0 18px' }} />

      <div className="seg" style={{ marginBottom: 18 }}>
        <button className="seg-opt" data-active={tab === 'roster'} onClick={() => setTab('roster')}>Roster</button>
        <button className="seg-opt" data-active={tab === 'analytics'} onClick={() => setTab('analytics')}>Analytics</button>
      </div>

      {tab === 'roster' && (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, border: '1px solid var(--color-divider)', padding: '8px 10px', marginBottom: 14 }}>
            <span style={{ fontSize: 15, color: 'var(--color-neutral-700)', display: 'flex' }}><SearchIcon /></span>
            <input
              className="input"
              style={{ border: 'none', padding: 0, minHeight: 'auto' }}
              placeholder="Search staff"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          {filtered.map(({ profile, today }) => {
            const status = statusLabel(today);
            const tag = tagStyle(status);
            const initials = profile.full_name.split(' ').map((p) => p[0]).join('');
            return (
              <div key={profile.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0', borderBottom: '1px solid var(--color-divider)' }}>
                <div style={{ width: 34, height: 34, flex: 'none', background: 'var(--color-surface)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 13, color: 'var(--color-neutral-700)' }}>
                  {initials}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{profile.full_name}</div>
                  <div style={{ fontSize: 12, color: 'var(--color-neutral-700)' }}>{profile.job_title}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <span className="tag" style={{ background: tag.bg, color: tag.color, marginBottom: 3 }}>{status}</span>
                  <div style={{ fontSize: 11, color: 'var(--color-neutral-500)' }}>
                    {today?.clock_in ? new Date(today.clock_in).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : '—'}
                  </div>
                </div>
              </div>
            );
          })}
        </>
      )}

      {tab === 'analytics' && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2, background: 'var(--color-divider)', marginBottom: 18 }}>
            <Stat label="Attendance rate" value={`${stats.attendanceRate}%`} />
            <Stat label="On-time rate" value={`${stats.onTimeRate}%`} />
            <Stat label="Avg. late by" value={`${stats.avgLateBy} min`} />
            <Stat label="Open leave" value={String(openLeave)} />
          </div>

          <div className="section-label" style={{ marginBottom: 10 }}>This week</div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: 110, marginBottom: 6 }}>
            {stats.weekBars.map((w) => (
              <div key={w.day} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%', justifyContent: 'flex-end', gap: 6 }}>
                <div style={{ width: '100%', background: 'var(--color-accent)', height: `${w.pct}%` }} />
                <span style={{ fontSize: 10, color: 'var(--color-neutral-700)' }}>{w.day}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ background: 'var(--color-bg)', padding: 16 }}>
      <div className="section-label" style={{ marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 800 }}>{value}</div>
    </div>
  );
}
