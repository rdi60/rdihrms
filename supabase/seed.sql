-- Optional starter data. Run this after you've created staff accounts (see
-- README.md — "First-time setup") so profiles already exist to attach balances to.

insert into holidays (holiday_date, name) values
  ('2026-10-02', 'Gandhi Jayanti'),
  ('2026-10-20', 'Diwali'),
  ('2026-11-08', 'Guru Nanak Jayanti'),
  ('2026-12-25', 'Christmas'),
  ('2027-01-01', 'New Year''s Day'),
  ('2027-01-26', 'Republic Day')
on conflict (holiday_date) do nothing;

-- Give every existing profile a standard annual leave allotment for the
-- current year, if they don't already have one.
insert into leave_balances (profile_id, leave_type_code, year, total, used)
select p.id, lt.code, extract(year from now())::int, v.total, 0
from profiles p
cross join (values ('SL', 12), ('CL', 12), ('EL', 15), ('Permission', 4)) as v(code, total)
join leave_types lt on lt.code = v.code
on conflict (profile_id, leave_type_code, year) do nothing;
