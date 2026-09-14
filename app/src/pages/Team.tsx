import { useEffect, useMemo, useState } from 'react';
import { listAttendanceRange, listTodayRoster } from '../api/attendance';
import { listApprovedLeaveOverlapping, listPendingApprovals } from '../api/leave';
import { listMyManagedDepartmentIds } from '../api/departments';
import { useAuth } from '../context/AuthContext';
import {
  addDays, addMonths, eachDateInRange, endOfMonth, formatDayHeader, formatDayLabel, formatTimeOfDay,
  formatWeekRange, monthGrid, monthLabel, startOfMonth, startOfWeek, toDateStr,
} from '../lib/dates';
import { ChevronLeftIcon, ChevronRightIcon, SearchIcon } from '../icons';
import type { AttendanceDay, LeaveRequest, Profile } from '../types';

const WEEKDAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
type Period = 'day' | 'week' | 'month';

type ExceptionKind = 'late' | 'leave' | 'permission' | 'early';
interface Exception {
  name: string;
  kind: ExceptionKind;
  detail: string;
}

function exceptionTag(kind: ExceptionKind) {
  if (kind === 'late') return { bg: 'var(--status-late-bg)', color: 'var(--status-late-text)', label: 'Late' };
  if (kind === 'leave') return { bg: 'var(--status-leave-bg)', color: 'var(--status-leave-text)', label: 'Leave' };
  if (kind === 'permission') return { bg: 'var(--status-permission-bg)', color: 'var(--status-permission-text)', label: 'Permission' };
  return { bg: 'var(--status-early-bg)', color: 'var(--status-early-text)', label: 'Early out' };
}

function ExceptionList({ label, items }: { label?: string; items: Exception[] }) {
  return (
    <div className="card" style={{ padding: 14, marginBottom: 10 }}>
      {label && <div style={{ fontWeight: 800, fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--color-neutral-700)', marginBottom: items.length ? 10 : 0 }}>{label}</div>}
      {items.length === 0 && (
        <div style={{ fontSize: 12, color: 'var(--color-neutral-500)' }}>No exceptions.</div>
      )}
      {items.map((ex, i) => {
        const tag = exceptionTag(ex.kind);
        return (
          <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '8px 0', borderTop: i > 0 ? '1px solid var(--color-divider)' : 'none' }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontWeight: 700, fontSize: 13 }}>{ex.name}</div>
              <div style={{ fontSize: 11, color: 'var(--color-neutral-700)' }}>{ex.detail}</div>
            </div>
            <span className="tag" style={{ background: tag.bg, color: tag.color, flex: 'none' }}>{tag.label}</span>
          </div>
        );
      })}
    </div>
  );
}

function MonthExceptionCalendar({
  anchor, exceptionsByDate, selectedDate, onSelectDate,
}: {
  anchor: Date;
  exceptionsByDate: Map<string, Exception[]>;
  selectedDate: string;
  onSelectDate: (d: string) => void;
}) {
  const year = anchor.getFullYear();
  const month = anchor.getMonth();
  const grid = monthGrid(year, month);
  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 1, fontSize: 10, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--color-neutral-700)', marginBottom: 6, textAlign: 'center' }}>
        {WEEKDAY_LABELS.map((l) => <div key={l}>{l[0]}</div>)}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 4, marginBottom: 14 }}>
        {grid.map((day, i) => {
          if (day === null) return <div key={i} />;
          const dateStr = toDateStr(new Date(year, month, day));
          const items = exceptionsByDate.get(dateStr) ?? [];
          const kinds = Array.from(new Set(items.map((x) => x.kind)));
          const isSelected = dateStr === selectedDate;
          return (
            <button
              key={i}
              onClick={() => onSelectDate(dateStr)}
              style={{
                aspectRatio: '1', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 3,
                borderRadius: 'var(--radius-sm)', border: isSelected ? '2px solid var(--color-accent)' : '1px solid var(--color-divider)',
                background: 'var(--color-surface)', cursor: 'pointer', fontFamily: 'inherit', padding: 0,
              }}
            >
              <span style={{ fontSize: 12, fontWeight: 700 }}>{day}</span>
              <span style={{ display: 'flex', gap: 2, height: 5 }}>
                {kinds.slice(0, 4).map((k) => (
                  <span key={k} style={{ width: 5, height: 5, borderRadius: '50%', background: exceptionTag(k).color }} />
                ))}
              </span>
            </button>
          );
        })}
      </div>
      <ExceptionList label={formatDayLabel(selectedDate)} items={exceptionsByDate.get(selectedDate) ?? []} />
    </>
  );
}

function tagStyle(status: string) {
  if (status === 'Present') return { bg: 'var(--status-present-bg)', color: 'var(--status-present-text)' };
  if (status === 'Late') return { bg: 'var(--status-late-bg)', color: 'var(--status-late-text)' };
  if (status === 'Absent') return { bg: 'var(--status-absent-bg)', color: 'var(--status-absent-text)' };
  return { bg: 'var(--status-leave-bg)', color: 'var(--status-leave-text)' };
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
  const [tab, setTab] = useState<'roster' | 'analytics' | 'calendar'>('roster');
  const [query, setQuery] = useState('');
  const [roster, setRoster] = useState<{ profile: Profile; today: AttendanceDay | null }[]>([]);
  const [openLeave, setOpenLeave] = useState(0);
  const [scopedDeptIds, setScopedDeptIds] = useState<string[]>([]);

  const [period, setPeriod] = useState<Period>('week');
  const [anchor, setAnchor] = useState(new Date());
  const [periodDays, setPeriodDays] = useState<AttendanceDay[]>([]);
  const [approvedLeave, setApprovedLeave] = useState<LeaveRequest[]>([]);
  const [selectedDate, setSelectedDate] = useState(toDateStr(new Date()));

  useEffect(() => {
    if (!profile) return;
    listTodayRoster().then(setRoster);
    listPendingApprovals().then((r) => setOpenLeave(r.length));
    listMyManagedDepartmentIds(profile.id).then(setScopedDeptIds);
  }, [profile]);

  useEffect(() => {
    const { start, end } = periodRange(period, anchor);
    listAttendanceRange(toDateStr(start), toDateStr(end)).then(setPeriodDays);
    listApprovedLeaveOverlapping(toDateStr(start), toDateStr(end)).then(setApprovedLeave);
    setSelectedDate(toDateStr(anchor));
  }, [period, anchor]);

  // A manager assigned to no department is unscoped and sees everyone.
  const scopedRoster = scopedDeptIds.length === 0
    ? roster
    : roster.filter((r) => r.profile.department_id && scopedDeptIds.includes(r.profile.department_id));
  const scopedProfileIds = new Set(scopedRoster.map((r) => r.profile.id));
  const scopedPeriodDays = scopedDeptIds.length === 0 ? periodDays : periodDays.filter((d) => scopedProfileIds.has(d.profile_id));
  const scopedApprovedLeave = scopedDeptIds.length === 0
    ? approvedLeave
    : approvedLeave.filter((l) => scopedProfileIds.has(l.profile_id));

  const exceptionsByDate = useMemo(() => {
    const map = new Map<string, Exception[]>();
    const push = (dateStr: string, ex: Exception) => {
      const list = map.get(dateStr) ?? [];
      list.push(ex);
      map.set(dateStr, list);
    };
    const profileById = new Map(scopedRoster.map((r) => [r.profile.id, r.profile]));

    for (const a of scopedPeriodDays) {
      const p = profileById.get(a.profile_id);
      if (!p) continue;
      if (a.status === 'late' && a.clock_in) {
        const [h, m] = p.shift_start.split(':').map(Number);
        const shiftStart = new Date(a.clock_in);
        shiftStart.setHours(h, m, 0, 0);
        const lateBy = Math.max(0, Math.round((new Date(a.clock_in).getTime() - shiftStart.getTime()) / 60000));
        push(a.work_date, { name: p.full_name, kind: 'late', detail: `Late by ${lateBy} min` });
      }
      if (a.clock_out) {
        const [h, m] = p.shift_end.split(':').map(Number);
        const shiftEnd = new Date(a.clock_out);
        shiftEnd.setHours(h, m, 0, 0);
        const earlyBy = Math.round((shiftEnd.getTime() - new Date(a.clock_out).getTime()) / 60000);
        if (earlyBy > 5) {
          push(a.work_date, { name: p.full_name, kind: 'early', detail: `Left ${earlyBy} min early` });
        }
      }
    }

    for (const req of scopedApprovedLeave) {
      const name = req.profiles?.full_name ?? profileById.get(req.profile_id)?.full_name ?? 'Staff';
      if (req.duration === 'permission') {
        push(req.start_date, { name, kind: 'permission', detail: `Permission ${formatTimeOfDay(req.permission_from)}–${formatTimeOfDay(req.permission_to)}` });
      } else {
        for (const d of eachDateInRange(new Date(`${req.start_date}T00:00:00`), new Date(`${req.end_date}T00:00:00`))) {
          push(toDateStr(d), { name, kind: 'leave', detail: `${req.leave_type_code} leave${req.duration === 'half' ? ` (${req.half_session})` : ''}` });
        }
      }
    }

    return map;
  }, [scopedRoster, scopedPeriodDays, scopedApprovedLeave]);

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
        <button className="seg-opt" data-active={tab === 'calendar'} onClick={() => setTab('calendar')}>Calendar</button>
      </div>

      {tab === 'roster' && (
        <>
          <div className="card" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', marginBottom: 14, boxShadow: 'none', border: '1px solid var(--color-divider)' }}>
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
              <div key={profile.id} className="card" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 13, marginBottom: 10 }}>
                <div style={{ width: 36, height: 36, flex: 'none', background: 'var(--color-surface-tint)', borderRadius: 'var(--radius-sm)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 13, color: 'var(--color-accent-700)' }}>
                  {initials}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>{profile.full_name}</div>
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
            <div style={{ display: 'flex', gap: 6 }}>
              <button className="icon-btn card" style={{ padding: '4px 8px', boxShadow: 'none', border: '1px solid var(--color-divider)' }} onClick={() => goPeriod(-1)}>
                <ChevronLeftIcon />
              </button>
              <button className="icon-btn card" style={{ padding: '4px 8px', boxShadow: 'none', border: '1px solid var(--color-divider)' }} onClick={() => goPeriod(1)}>
                <ChevronRightIcon />
              </button>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 18 }}>
            <Stat label="Attendance rate" value={`${stats.attendanceRate}%`} />
            <Stat label="On-time rate" value={`${stats.onTimeRate}%`} />
            <Stat label="Avg. late by" value={`${stats.avgLateBy} min`} />
            <Stat label="Open leave" value={String(openLeave)} />
          </div>

          {period === 'day' && stats.dayBreakdown && (
            <>
              <div className="section-label" style={{ marginBottom: 10 }}>Status breakdown</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8 }}>
                <Stat label="Present" value={String(stats.dayBreakdown.present)} bg="var(--status-present-bg)" fg="var(--status-present-text)" />
                <Stat label="Late" value={String(stats.dayBreakdown.late)} bg="var(--status-late-bg)" fg="var(--status-late-text)" />
                <Stat label="On leave" value={String(stats.dayBreakdown.leave)} bg="var(--status-leave-bg)" fg="var(--status-leave-text)" />
                <Stat label="Absent" value={String(stats.dayBreakdown.absent)} bg="var(--status-absent-bg)" fg="var(--status-absent-text)" />
              </div>
            </>
          )}

          {period !== 'day' && (
            <>
              <div className="section-label" style={{ marginBottom: 10 }}>{period === 'week' ? 'This week' : 'This month'}</div>
              <div className="card" style={{ padding: '16px 14px 10px', display: 'flex', alignItems: 'flex-end', gap: 8, height: 140, marginBottom: 6 }}>
                {stats.bars.map((w) => (
                  <div key={w.label} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%', justifyContent: 'flex-end', gap: 6 }}>
                    <div style={{ width: '100%', background: 'var(--color-accent-gradient)', height: `${w.pct}%`, borderRadius: '6px 6px 2px 2px', minHeight: 2 }} />
                    <span style={{ fontSize: 10, color: 'var(--color-neutral-700)', fontWeight: 600 }}>{w.label}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </>
      )}

      {tab === 'calendar' && (
        <>
          <div className="seg" style={{ marginBottom: 14 }}>
            <button className="seg-opt" data-active={period === 'day'} onClick={() => setPeriod('day')}>Day</button>
            <button className="seg-opt" data-active={period === 'week'} onClick={() => setPeriod('week')}>Week</button>
            <button className="seg-opt" data-active={period === 'month'} onClick={() => setPeriod('month')}>Month</button>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
            <span style={{ fontWeight: 800, fontSize: 14 }}>{periodLabel(period, anchor)}</span>
            <div style={{ display: 'flex', gap: 6 }}>
              <button className="icon-btn card" style={{ padding: '4px 8px', boxShadow: 'none', border: '1px solid var(--color-divider)' }} onClick={() => goPeriod(-1)}>
                <ChevronLeftIcon />
              </button>
              <button className="icon-btn card" style={{ padding: '4px 8px', boxShadow: 'none', border: '1px solid var(--color-divider)' }} onClick={() => goPeriod(1)}>
                <ChevronRightIcon />
              </button>
            </div>
          </div>

          {period === 'day' && (
            <ExceptionList items={exceptionsByDate.get(toDateStr(anchor)) ?? []} />
          )}

          {period === 'week' && eachDateInRange(startOfWeek(anchor), addDays(startOfWeek(anchor), 6)).map((d) => {
            const dateStr = toDateStr(d);
            return <ExceptionList key={dateStr} label={formatDayHeader(d)} items={exceptionsByDate.get(dateStr) ?? []} />;
          })}

          {period === 'month' && (
            <MonthExceptionCalendar
              anchor={anchor}
              exceptionsByDate={exceptionsByDate}
              selectedDate={selectedDate}
              onSelectDate={setSelectedDate}
            />
          )}
        </>
      )}
    </>
  );
}

function Stat({ label, value, bg, fg }: { label: string; value: string; bg?: string; fg?: string }) {
  return (
    <div className="card" style={{ padding: 15, background: bg ?? 'var(--color-surface)', boxShadow: bg ? 'none' : 'var(--shadow-sm)' }}>
      <div className="section-label" style={{ marginBottom: 6, color: fg ?? undefined }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 800, color: fg ?? undefined }}>{value}</div>
    </div>
  );
}
