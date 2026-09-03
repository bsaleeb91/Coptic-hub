-- Priest's Calendly link, shown to his flock on the Appointments tab as
-- another way to book. Nullable — no link, no button.
--
-- No new policies: RLS on profiles is row-level, and members can already read
-- their FOC's row (that is how the Appointments tab shows the priest's name),
-- so this column rides along. Only the priest can write his own row.
alter table public.profiles
  add column if not exists calendly_url text;
