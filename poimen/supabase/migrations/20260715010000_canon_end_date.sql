-- Record when a canon ends. Written by the app when a canon is deactivated;
-- null means the canon is still active (or was deactivated before this column
-- existed, which the history UI renders as "Ongoing").
-- Additive and nullable — safe for all running clients. Safe to re-run.

alter table public.spiritual_canons
  add column if not exists end_date date;
