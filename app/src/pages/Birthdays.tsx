import { useEffect, useState } from 'react';
import { listUpcomingPeopleDates, type UpcomingPerson } from '../api/directory';
import { BackHeader } from '../components/PageHeader';

export function Birthdays() {
  const [people, setPeople] = useState<UpcomingPerson[]>([]);
  useEffect(() => {
    listUpcomingPeopleDates('date_of_birth').then(setPeople);
  }, []);

  return (
    <>
      <BackHeader title="Birthdays" />
      {people.map((b, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '13px 0', borderBottom: '1px solid var(--color-divider)' }}>
          <div style={{ width: 44, textAlign: 'center', fontSize: 11, fontWeight: 800, color: 'var(--color-accent-700)', flex: 'none' }}>
            {b.date}
          </div>
          <div style={{ flex: 1, fontSize: 14, fontWeight: 600 }}>{b.name}</div>
        </div>
      ))}
      {people.length === 0 && (
        <div style={{ padding: '24px 0', textAlign: 'center', color: 'var(--color-neutral-500)', fontSize: 13 }}>
          Nothing coming up in the next 90 days.
        </div>
      )}
    </>
  );
}
