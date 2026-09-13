import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { listMonthAttendance } from '../api/attendance';
import { formatDayLabel, formatTime, isWeekend, monthGrid, monthLabel, toDateStr } from '../lib/dates';
import { ChevronLeftIcon, ChevronRightIcon } from '../icons';
import type { AttendanceDay, AttendanceStatus } from '../types';

const WEEKDAY_LETTERS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

const LEGEND: { status: AttendanceStatus; label: string; swatch: string; border?: string }[] = [
  { status: 'present', label: 'Present', swatch: 'var(--color-surface)' },
  { status: 'late', label: 'Late', swatch: 'var(--color-accent-200)' },
  { status: 'absent', label: 'Absent', swatch: 'var(--color-accent)' },
  { status: 'leave', label: 'Leave', swatch: 'transparent', border: '1.5px solid var(--color-divider)' },
];

function dayStyle(status: AttendanceStatus | undefined, selected: boolean) {
  let bg = 'var(--color-surface)';
  let fg = 'var(--color-text)';
  let border = '1px solid transparent';
  if (status === 'late') { bg = 'var(--color-accent-200)'; fg = 'var(--color-accent-800)'; }
  else if (status === 'absent') { bg = 'var(--color-accent)'; fg = 'var(--color-bg)'; }
  else if (status === 'leave') { bg = 'var(--color-bg)'; border = '1.5px solid var(--color-divider)'; }
  else if (status === 'weekend') { bg = 'transparent'; fg = 'var(--color-neutral-500)'; }
  if (selected) border = '2px solid var(--color-accent-700)';
  return { bg, fg, border };
}

export function History() {
  const { profile } = useAuth();
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [days, setDays] = useState<AttendanceDay[]>([]);
  const [selected, setSelected] = useState(today.getDate());

  useEffect(() => {
    if (!profile) return;
    listMonthAttendance(profile.id, year, month).then(setDays);
    setSelected(year === today.getFullYear() && month === today.getMonth() ? today.getDate() : 1);
  }, [profile, year, month]);

  const byDay = useMemo(() => {
    const map = new Map<number, AttendanceDay>();
    for (const d of days) map.set(new Date(`${d.work_date}T00:00:00`).getDate(), d);
    return map;
  }, [days]);

  const grid = useMemo(() => monthGrid(year, month), [year, month]);
  const selectedDateStr = toDateStr(new Date(year, month, selected));
  const selectedRecord = byDay.get(selected);

  const goMonth = (delta: number) => {
    let m = month + delta;
    let y = year;
    if (m < 0) { m = 11; y -= 1; }
    if (m > 11) { m = 0; y += 1; }
    setMonth(m);
    setYear(y);
  };

  return (
    <>
      <div style={{ paddingTop: 6 }}>
        <div className="kicker">Overview</div>
        <h1 style={{ fontSize: 28 }}>History</h1>
      </div>
      <div className="hr" style={{ margin: '16px 0 18px' }} />

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <span style={{ fontWeight: 800, fontSize: 16 }}>{monthLabel(year, month)}</span>
        <div style={{ display: 'flex', gap: 4 }}>
          <button className="icon-btn" style={{ border: '1px solid var(--color-divider)', padding: '4px 8px' }} onClick={() => goMonth(-1)}>
            <ChevronLeftIcon />
          </button>
          <button className="icon-btn" style={{ border: '1px solid var(--color-divider)', padding: '4px 8px' }} onClick={() => goMonth(1)}>
            <ChevronRightIcon />
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 1, fontSize: 10, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--color-neutral-700)', marginBottom: 6, textAlign: 'center' }}>
        {WEEKDAY_LETTERS.map((l, i) => <div key={i}>{l}</div>)}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 2 }}>
        {grid.map((day, i) => {
          if (day === null) return <div key={i} />;
          const record = byDay.get(day);
          const status: AttendanceStatus = record?.status ?? (isWeekend(year, month, day) ? 'weekend' : 'present');
          const { bg, fg, border } = dayStyle(status, day === selected);
          return (
            <button
              key={i}
              onClick={() => setSelected(day)}
              style={{
                aspectRatio: '1', background: bg, color: fg, border, fontSize: 12, fontWeight: 600,
                cursor: 'pointer', padding: 0, fontFamily: 'inherit',
              }}
            >
              {day}
            </button>
          );
        })}
      </div>

      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', margin: '16px 0', fontSize: 11, color: 'var(--color-neutral-700)' }}>
        {LEGEND.map((l) => (
          <span key={l.status} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <span style={{ width: 9, height: 9, background: l.swatch, border: l.border, display: 'inline-block' }} />
            {l.label}
          </span>
        ))}
      </div>
      <div className="hr" style={{ margin: '4px 0 16px' }} />

      <div style={{ background: 'var(--color-surface)', padding: 16 }}>
        <div className="kicker" style={{ marginBottom: 4 }}>{formatDayLabel(selectedDateStr)}</div>
        <div style={{ fontSize: 17, fontWeight: 800, marginBottom: 10 }}>
          {selectedRecord ? statusLabel(selectedRecord.status) : isWeekend(year, month, selected) ? 'Weekend' : 'Present'}
        </div>
        <div style={{ display: 'flex', gap: 24, fontSize: 13 }}>
          <div><div style={{ color: 'var(--color-neutral-700)', fontSize: 11, marginBottom: 2 }}>In</div>{formatTime(selectedRecord?.clock_in ?? null)}</div>
          <div><div style={{ color: 'var(--color-neutral-700)', fontSize: 11, marginBottom: 2 }}>Out</div>{formatTime(selectedRecord?.clock_out ?? null)}</div>
        </div>
      </div>
    </>
  );
}

function statusLabel(status: AttendanceStatus): string {
  switch (status) {
    case 'present': return 'Present';
    case 'late': return 'Late';
    case 'absent': return 'Absent';
    case 'leave': return 'On leave';
    case 'holiday': return 'Holiday';
    default: return 'Weekend';
  }
}
