import { useEffect, useState } from 'react';
import { listUpcomingPeopleDates, type UpcomingPerson } from '../api/directory';
import { BackHeader } from '../components/PageHeader';

export function WorkAnniversaries() {
  const [people, setPeople] = useState<UpcomingPerson[]>([]);
  useEffect(() => {
    listUpcomingPeopleDates('join_date').then(setPeople);
  }, []);

  return (
    <>
      <BackHeader title="Work anniversaries" />
      {people.length > 0 && (
        <div className="card">
          {people.map((a, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '13px 16px', borderBottom: i === people.length - 1 ? 'none' : '1px solid var(--color-divider)' }}>
              <div style={{ width: 44, textAlign: 'center', fontSize: 11, fontWeight: 800, color: 'var(--color-accent-700)', flex: 'none' }}>
                {a.date}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 600 }}>{a.name}</div>
                <div style={{ fontSize: 12, color: 'var(--color-neutral-700)' }}>{a.years} years</div>
              </div>
            </div>
          ))}
        </div>
      )}
      {people.length === 0 && (
        <div style={{ padding: '24px 0', textAlign: 'center', color: 'var(--color-neutral-500)', fontSize: 13 }}>
          Nothing coming up in the next 90 days.
        </div>
      )}
    </>
  );
}
