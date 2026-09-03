-- ============================================================
-- Migration: Date-specific availability exceptions — 2026-08-10
--
-- availability_rules recur weekly and never expire, which leaves no way to say
-- "not this Tuesday, I'm travelling" — or the opposite, "I'm free this Thursday
-- evening even though I never normally am". This adds one-off exceptions pinned
-- to a calendar date, in both directions:
--
--   kind = 'block'  subtracted from what the recurring rules produce
--     start_minute / end_minute NULL  → the whole day is closed
--     start_minute / end_minute set   → only that window is closed
--
--   kind = 'open'   added on top of the recurring rules
--     type_id + start_minute + end_minute are all required — an extra window
--     has to say which kind of appointment it is offering and when.
--
-- A day can carry several of each (away in the morning, extra hours at night).
-- Removing the row is what reverts the day to the plain weekly pattern.
-- Blocks win over extra hours on the same date: an absence is an absence.
--
-- Like availability_rules, these are read by the congregant's client, which is
-- what actually generates the bookable slots — the same trust model the rest of
-- scheduling already uses (request_appointment validates the type, the master
-- switch, the time being future, and slot collisions; the shape of a priest's
-- availability is applied client-side and every request needs his confirmation
-- regardless).
--
-- Safe to re-run: the table and the later columns are all guarded.
-- ============================================================

create table if not exists public.availability_exceptions (
  id           uuid primary key default gen_random_uuid(),
  priest_id    uuid not null references auth.users(id) on delete cascade,
  on_date      date not null,
  start_minute int,                          -- null (with end_minute) = all day
  end_minute   int,
  note         text,
  created_at   timestamptz not null default now()
);

-- Added after the table so an earlier deployment of this file upgrades cleanly.
alter table public.availability_exceptions
  add column if not exists kind text not null default 'block';
alter table public.availability_exceptions
  add column if not exists type_id uuid references public.appointment_types(id) on delete cascade;

alter table public.availability_exceptions
  drop constraint if exists availability_exceptions_window_chk;
alter table public.availability_exceptions
  add constraint availability_exceptions_window_chk check (
    kind in ('block', 'open')
    and (
      -- a closure: whole day, or a window
      (kind = 'block' and type_id is null and (
        (start_minute is null and end_minute is null)
        or (start_minute is not null and end_minute is not null
            and start_minute >= 0 and end_minute <= 1440 and end_minute > start_minute)))
      -- extra hours: always a concrete window, for one appointment type
      or (kind = 'open' and type_id is not null
          and start_minute is not null and end_minute is not null
          and start_minute >= 0 and end_minute <= 1440 and end_minute > start_minute)
    )
  );

alter table public.availability_exceptions enable row level security;

drop policy if exists "exceptions: priest manages own" on public.availability_exceptions;
create policy "exceptions: priest manages own" on public.availability_exceptions
  for all using (priest_id = auth.uid()) with check (priest_id = auth.uid());

-- The member's client subtracts these when generating open slots, so it has to
-- be able to read them — gated on the same consent as the rules themselves.
drop policy if exists "exceptions: consented member reads FOC" on public.availability_exceptions;
create policy "exceptions: consented member reads FOC" on public.availability_exceptions
  for select using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.foc_id = availability_exceptions.priest_id
        and p.foc_consent_at is not null
    )
  );

create index if not exists availability_exceptions_priest_date_idx
  on public.availability_exceptions (priest_id, on_date);
