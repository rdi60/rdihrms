export function toDateStr(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function todayStr(): string {
  return toDateStr(new Date());
}

export function formatTime(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

export function formatDayLabel(dateStr: string): string {
  return new Date(`${dateStr}T00:00:00`).toLocaleDateString(undefined, {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

export function formatShortDate(dateStr: string): string {
  return new Date(`${dateStr}T00:00:00`).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });
}

export function monthLabel(year: number, month: number): string {
  return new Date(year, month, 1).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
}

/** Days in a month grid, Monday-first, with leading blanks. */
export function monthGrid(year: number, month: number): (number | null)[] {
  const first = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const leadBlanks = (first.getDay() + 6) % 7; // convert Sun=0 -> Mon-first index
  const cells: (number | null)[] = Array(leadBlanks).fill(null);
  for (let day = 1; day <= daysInMonth; day++) cells.push(day);
  return cells;
}

export function isWeekend(year: number, month: number, day: number): boolean {
  const wd = new Date(year, month, day).getDay();
  return wd === 0 || wd === 6;
}

/** Monday of the week containing `d`. */
export function startOfWeek(d: Date): Date {
  const copy = new Date(d);
  const diff = (copy.getDay() + 6) % 7;
  copy.setDate(copy.getDate() - diff);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

export function addDays(d: Date, n: number): Date {
  const copy = new Date(d);
  copy.setDate(copy.getDate() + n);
  return copy;
}
