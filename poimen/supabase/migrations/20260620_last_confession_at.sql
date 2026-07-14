-- Track when a congregant last received confession.
-- Set by priest when logging a confession encounter,
-- or by congregant via self-report on the Confession tab.

alter table public.profiles
  add column if not exists last_confession_at timestamptz;
