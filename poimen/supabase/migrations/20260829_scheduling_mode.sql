-- Where a priest's members book him: in the app's own scheduler, or on his
-- Calendly page. Exactly ONE — offering both meant two availability systems
-- drifting apart and a double-booking hole no one-way sync could fully close,
-- so the choice is binary by design.
--
-- 'app' is the default and matches today's behavior. Members read this from
-- their FOC's profile row (same row-level policies that let them read his
-- name); only the priest writes his own row.
alter table public.profiles
  add column if not exists scheduling_mode text not null default 'app'
  check (scheduling_mode in ('app', 'calendly'));
