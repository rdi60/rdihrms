import { useEffect, useMemo, useState } from 'react';
import { listAttendanceRange, listTodayRoster } from '../api/attendance';
import { listPendingApprovals } from '../api/leave';
import { listMyManagedDepartmentIds } from '../api/departments';
import { useAuth } from '../context/AuthContext';
import {
  addDays, addMonths, eachDateInRange, endOfMonth, formatDayHeader, formatWeekRange,
  monthLabel, startOfMonth, startOfWeek, toDateStr,
} from '../lib/dates';
import { ChevronLeftIcon, ChevronRightIcon, SearchIcon } from '../icons';
import type { AttendanceDay, Profile } from '../types';

const WEEKDAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
type Period = 'day' | 'week' | 'month';

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

function periodRange(period: Period, anchor: Date): { start: Date; end: Date } {
  if (period === 'day') return { start: anchor, end: anchor };
  if (period === 'week') {
    const start = startOfWeek(anchor);
    return { start, end: addDays(start, 6) };
  }
  return { start: startOfMonth(anchor), end: endOfMonth(anchor) };
}

function periodLabel(period: Period, anchor: Date): string {
  if (period === 'day') return formatDayHeader(anchor);
  if (period === 'week') {
    const start = startOfWeek(anchor);
    return formatWeekRange(start, addDays(start, 6));
  }
  return monthLabel(anchor.getFullYear(), anchor.getMonth());
}

export function Team() {
  const { profile } = useAuth();
  const [tab, setTab] = useState<'roster' | 'analytics'>('roster');
  const [query, setQuery] = useState('');
  const [roster, setRoster] = useState<{ profile: Profile; today: AttendanceDay | null }[]>([]);
  const [openLeave, setOpenLeave] = useState(0);
  const [scopedDeptIds, setScopedDeptIds] = useState<string[]>([]);

  const [period, setPeriod] = useState<Period>('week');
  const [anchor, setAnchor] = useState(new Date());
  const [periodDays, setPeriodDays] = useState<AttendanceDay[]>([]);

  useEffect(() => {
    if (!profile) return;
    listTodayRoster().then(setRoster);
    listPendingApprovals().then((r) => setOpenLeave(r.length));
    listMyManagedDepartmentIds(profile.id).then(setScopedDeptIds);
  }, [profile]);

  useEffect(() => {
    const { start, end } = periodRange(period, anchor);
    listAttendanceRange(toDateStr(start), toDateStr(end)).then(setPeriodDays);
  }, [period, anchor]);

  // A manager assigned to no department is unscoped and sees everyone.
  const scopedRoster = scopedDeptIds.length === 0
    ? roster
    : roster.filter((r) => r.profile.department_id && scopedDeptIds.includes(r.profile.department_id));
  const scopedProfileIds = new Set(scopedRoster.map((r) => r.profile.id));
  const scopedPeriodDays = scopedDeptIds.length === 0 ? periodDays : periodDays.filter((d) => scopedProfileIds.has(d.profile_id));

  const filtered = scopedRoster.filter((r) => r.profile.full_name.toLowerCase().includes(query.trim().toLowerCase()));

  const goPeriod = (delta: number) => {
    setAnchor((prev) => {
      if (period === 'day') return addDays(prev, delta);
      if (period === 'week') return addDays(prev, delta * 7);
      return addMonths(prev, delta);
    });
  };

  const stats = useMemo(() => {
    const total = scopedRoster.length || 1;
    const { start, end } = periodRange(period, anchor);
    const byDate = new Map<string, AttendanceDay[]>();
    for (const d of scopedPeriodDays) {
      const list = byDate.get(d.work_date) ?? [];
      list.push(d);
      byDate.set(d.work_date, list);
    }
    const shiftByProfile = new Map(scopedRoster.map((r) => [r.profile.id, r.profile.shift_start]));
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Attendance rate: average of (attended / total) across each non-future day in range.
    const consideredDates = eachDateInRange(start, end).filter((d) => d <= today);
    const dailyPct = consideredDates.map((d) => {
      const records = byDate.get(toDateStr(d)) ?? [];
      const attended = records.filter((r) => r.status === 'present' || r.status === 'late').length;
      return Math.round((attended / total) * 100);
    });
    const attendanceRate = dailyPct.length ? Math.round(dailyPct.reduce((a, b) => a + b, 0) / dailyPct.length) : 0;

    let presentCount = 0;
    let lateCount = 0;
    let lateMinutesSum = 0;
    for (const r of scopedPeriodDays) {
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

    // Week view: one bar per weekday. Month view: one bar per calendar week in the month.
    let bars: { label: string; pct: number }[] = [];
    if (period === 'week') {
      bars = WEEKDAY_LABELS.map((label, i) => {
        const d = addDays(start, i);
        if (d > today) return { label, pct: 0 };
        const records = byDate.get(toDateStr(d)) ?? [];
        const attended = records.filter((r) => r.status === 'present' || r.status === 'late').length;
        return { label, pct: Math.round((attended / total) * 100) };
      });
    } else if (period === 'month') {
      let weekStart = startOfWeek(start);
      let weekIndex = 1;
      while (weekStart <= end) {
        const weekEnd = addDays(weekStart, 6);
        const daysInMonth = eachDateInRange(weekStart, weekEnd).filter((d) => d >= start && d <= end && d <= today);
        let sum = 0;
        for (const d of daysInMonth) {
          const records = byDate.get(toDateStr(d)) ?? [];
          sum += records.filter((r) => r.status === 'present' || r.status === 'late').length;
        }
        const pct = daysInMonth.length ? Math.round((sum / (daysInMonth.length * total)) * 100) : 0;
        bars.push({ label: `W${weekIndex}`, pct });
        weekStart = addDays(weekStart, 7);
        weekIndex++;
      }
    }

    // Day view: a status breakdown instead of bars.
    let dayBreakdown: { present: number; late: number; leave: number; absent: number } | null = null;
    if (period === 'day') {
      const byProfile = new Map(scopedPeriodDays.map((d) => [d.profile_id, d]));
      let present = 0, late = 0, leave = 0;
      for (const r of scopedRoster) {
        const rec = byProfile.get(r.profile.id);
        if (rec?.status === 'present') present++;
        else if (rec?.status === 'late') late++;
        else if (rec?.status === 'leave') leave++;
      }
      dayBreakdown = { present, late, leave, absent: Math.max(scopedRoster.length - present - late - leave, 0) };
    }

    return { attendanceRate, onTimeRate, avgLateBy, bars, dayBreakdown };
  }, [scopedRoster, scopedPeriodDays, period, anchor]);

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
          <div className="seg" style={{ marginBottom: 14 }}>
            <button className="seg-opt" data-active={period === 'day'} onClick={() => setPeriod('day')}>Day</button>
            <button className="seg-opt" data-active={period === 'week'} onClick={() => setPeriod('week')}>Week</button>
            <button className="seg-opt" data-active={period === 'month'} onClick={() => setPeriod('month')}>Month</button>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
            <span style={{ fontWeight: 800, fontSize: 14 }}>{periodLabel(period, anchor)}</span>
            <div style={{ display: 'flex', gap: 4 }}>
              <button className="icon-btn" style={{ border: '1px solid var(--color-divider)', padding: '4px 8px' }} onClick={() => goPeriod(-1)}>
                <ChevronLeftIcon />
              </button>
              <button className="icon-btn" style={{ border: '1px solid var(--color-divider)', padding: '4px 8px' }} onClick={() => goPeriod(1)}>
                <ChevronRightIcon />
              </button>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2, background: 'var(--color-divider)', marginBottom: 18 }}>
            <Stat label="Attendance rate" value={`${stats.attendanceRate}%`} />
            <Stat label="On-time rate" value={`${stats.onTimeRate}%`} />
            <Stat label="Avg. late by" value={`${stats.avgLateBy} min`} />
            <Stat label="Open leave" value={String(openLeave)} />
          </div>

          {period === 'day' && stats.dayBreakdown && (
            <>
              <div className="section-label" style={{ marginBottom: 10 }}>Status breakdown</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 2, background: 'var(--color-divider)' }}>
                <Stat label="Present" value={String(stats.dayBreakdown.present)} />
                <Stat label="Late" value={String(stats.dayBreakdown.late)} />
                <Stat label="On leave" value={String(stats.dayBreakdown.leave)} />
                <Stat label="Absent" value={String(stats.dayBreakdown.absent)} />
              </div>
            </>
          )}

          {period !== 'day' && (
            <>
              <div className="section-label" style={{ marginBottom: 10 }}>{period === 'week' ? 'This week' : 'This month'}</div>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: 110, marginBottom: 6 }}>
                {stats.bars.map((w) => (
                  <div key={w.label} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%', justifyContent: 'flex-end', gap: 6 }}>
                    <div style={{ width: '100%', background: 'var(--color-accent)', height: `${w.pct}%` }} />
                    <span style={{ fontSize: 10, color: 'var(--color-neutral-700)' }}>{w.label}</span>
                  </div>
                ))}
              </div>
            </>
          )}
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
