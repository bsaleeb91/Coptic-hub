-- Add follow_up_date to pastoral_encounters.
-- The log-encounter screen has sent this field since launch;
-- without the column it was silently dropped by PostgREST.

alter table public.pastoral_encounters
  add column if not exists follow_up_date date;
