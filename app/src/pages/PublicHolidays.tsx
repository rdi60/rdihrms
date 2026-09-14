import { useEffect, useState } from 'react';
import { listUpcomingHolidays } from '../api/directory';
import { BackHeader } from '../components/PageHeader';
import { formatShortDate } from '../lib/dates';
import type { Holiday } from '../types';

export function PublicHolidays() {
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  useEffect(() => {
    listUpcomingHolidays().then(setHolidays);
  }, []);

  return (
    <>
      <BackHeader title="Public holidays" />
      {holidays.length > 0 && (
        <div className="card">
          {holidays.map((h, i) => (
            <div key={h.id} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '13px 16px', borderBottom: i === holidays.length - 1 ? 'none' : '1px solid var(--color-divider)' }}>
              <div style={{ width: 44, textAlign: 'center', fontSize: 11, fontWeight: 800, color: 'var(--color-accent-700)', flex: 'none' }}>
                {formatShortDate(h.holiday_date)}
              </div>
              <div style={{ flex: 1, fontSize: 14, fontWeight: 600 }}>{h.name}</div>
            </div>
          ))}
        </div>
      )}
      {holidays.length === 0 && (
        <div style={{ padding: '24px 0', textAlign: 'center', color: 'var(--color-neutral-500)', fontSize: 13 }}>
          No upcoming holidays on file.
        </div>
      )}
    </>
  );
}
