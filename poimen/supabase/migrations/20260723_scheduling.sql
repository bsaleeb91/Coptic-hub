-- ============================================================
-- Migration: Appointment scheduling — 2026-07-23
--
-- A priest publishes recurring weekly availability, broken down by
-- priest-defined appointment types (Confession 30m, Visitation 60m, …).
-- Congregants browse the open slots those rules generate and REQUEST one;
-- the priest must CONFIRM (or decline). A master switch on the profile lets
-- the priest open or close scheduling entirely at any time.
--
-- All state lives in the cloud. Three tables:
--   appointment_types   — a priest's custom types + durations
--   availability_rules  — recurring weekly windows (weekday + time + type)
--   appointments        — concrete booking requests and their status
--
-- Writes that cross the priest↔congregant boundary go through SECURITY
-- DEFINER RPCs so a congregant can request/cancel and a priest can respond
-- without either being able to tamper with the other's rows. A congregant
-- never reads *who* holds another slot — only anonymized busy ranges, via
-- foc_busy_ranges(), so they can tell which times are already taken.
-- ============================================================

-- ── Master switch: is the priest accepting appointments right now ──
alter table public.profiles
  add column if not exists scheduling_open boolean not null default false;

-- ── Appointment types (priest-defined) ──────────────────────
create table if not exists public.appointment_types (
  id               uuid primary key default gen_random_uuid(),
  priest_id        uuid not null references auth.users(id) on delete cascade,
  label            text not null,
  duration_minutes int  not null check (duration_minutes between 5 and 480),
  active           boolean not null default true,
  sort             int  not null default 0,
  created_at       timestamptz not null default now()
);
alter table public.appointment_types enable row level security;

drop policy if exists "types: priest manages own" on public.appointment_types;
create policy "types: priest manages own" on public.appointment_types
  for all using (priest_id = auth.uid()) with check (priest_id = auth.uid());

drop policy if exists "types: consented member reads FOC" on public.appointment_types;
create policy "types: consented member reads FOC" on public.appointment_types
  for select using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.foc_id = appointment_types.priest_id
        and p.foc_consent_at is not null
    )
  );

-- ── Recurring weekly availability windows ───────────────────
-- weekday: 0 = Sunday … 6 = Saturday (matches JS Date.getDay()).
-- start_minute / end_minute: minutes past local midnight.
create table if not exists public.availability_rules (
  id           uuid primary key default gen_random_uuid(),
  priest_id    uuid not null references auth.users(id) on delete cascade,
  type_id      uuid not null references public.appointment_types(id) on delete cascade,
  weekday      int  not null check (weekday between 0 and 6),
  start_minute int  not null check (start_minute between 0 and 1439),
  end_minute   int  not null check (end_minute between 1 and 1440),
  active       boolean not null default true,
  created_at   timestamptz not null default now(),
  check (end_minute > start_minute)
);
alter table public.availability_rules enable row level security;

drop policy if exists "rules: priest manages own" on public.availability_rules;
create policy "rules: priest manages own" on public.availability_rules
  for all using (priest_id = auth.uid()) with check (priest_id = auth.uid());

drop policy if exists "rules: consented member reads FOC" on public.availability_rules;
create policy "rules: consented member reads FOC" on public.availability_rules
  for select using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.foc_id = availability_rules.priest_id
        and p.foc_consent_at is not null
    )
  );

-- ── Appointments (requests + their lifecycle) ───────────────
create table if not exists public.appointments (
  id               uuid primary key default gen_random_uuid(),
  priest_id        uuid not null references auth.users(id) on delete cascade,
  congregant_id    uuid not null references auth.users(id) on delete cascade,
  type_id          uuid references public.appointment_types(id) on delete set null,
  type_label       text not null,                       -- snapshot; survives type deletion
  starts_at        timestamptz not null,
  duration_minutes int  not null,
  status           text not null default 'requested'
                     check (status in ('requested','confirmed','declined','cancelled')),
  note             text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
alter table public.appointments enable row level security;

-- Reads: each party sees their own rows. Writes are RPC-only (below).
drop policy if exists "appts: priest reads own" on public.appointments;
create policy "appts: priest reads own" on public.appointments
  for select using (priest_id = auth.uid());

drop policy if exists "appts: congregant reads own" on public.appointments;
create policy "appts: congregant reads own" on public.appointments
  for select using (congregant_id = auth.uid());

create index if not exists appointments_priest_start_idx    on public.appointments (priest_id, starts_at);
create index if not exists appointments_congregant_start_idx on public.appointments (congregant_id, starts_at);

-- ── RPC: congregant requests an appointment ─────────────────
create or replace function public.request_appointment(
  p_type_id   uuid,
  p_starts_at timestamptz,
  p_note      text default null
) returns public.appointments
language plpgsql security definer set search_path = public as $$
declare
  v_priest uuid;
  v_type   public.appointment_types;
  v_appt   public.appointments;
begin
  -- Caller must be a consented congregant; derive their Father of Confession.
  select foc_id into v_priest
    from public.profiles
    where id = auth.uid() and foc_consent_at is not null;
  if v_priest is null then
    raise exception 'You must be linked to a Father of Confession';
  end if;

  select * into v_type
    from public.appointment_types
    where id = p_type_id and priest_id = v_priest and active;
  if v_type.id is null then
    raise exception 'That appointment type is unavailable';
  end if;

  if not exists (select 1 from public.profiles where id = v_priest and scheduling_open) then
    raise exception 'Scheduling is currently closed';
  end if;

  if p_starts_at <= now() then
    raise exception 'Choose a time in the future';
  end if;

  -- First-come: block if any live request/confirmation overlaps this slot.
  if exists (
    select 1 from public.appointments a
    where a.priest_id = v_priest
      and a.status in ('requested','confirmed')
      and tstzrange(a.starts_at, a.starts_at + make_interval(mins => a.duration_minutes), '[)')
       && tstzrange(p_starts_at, p_starts_at + make_interval(mins => v_type.duration_minutes), '[)')
  ) then
    raise exception 'That time was just taken — please pick another';
  end if;

  insert into public.appointments
    (priest_id, congregant_id, type_id, type_label, starts_at, duration_minutes, status, note)
  values
    (v_priest, auth.uid(), v_type.id, v_type.label, p_starts_at, v_type.duration_minutes, 'requested', nullif(btrim(p_note), ''))
  returning * into v_appt;
  return v_appt;
end $$;

-- ── RPC: priest confirms or declines a request ──────────────
create or replace function public.respond_appointment(
  p_appointment_id uuid,
  p_confirm        boolean
) returns public.appointments
language plpgsql security definer set search_path = public as $$
declare v_appt public.appointments;
begin
  select * into v_appt
    from public.appointments
    where id = p_appointment_id and priest_id = auth.uid();
  if v_appt.id is null then
    raise exception 'Appointment not found';
  end if;
  if v_appt.status <> 'requested' then
    raise exception 'This request has already been handled';
  end if;

  update public.appointments
    set status = case when p_confirm then 'confirmed' else 'declined' end,
        updated_at = now()
    where id = p_appointment_id
    returning * into v_appt;

  -- On confirm, auto-decline any other pending request overlapping this slot.
  if p_confirm then
    update public.appointments a
      set status = 'declined', updated_at = now()
      where a.priest_id = auth.uid()
        and a.status = 'requested'
        and a.id <> v_appt.id
        and tstzrange(a.starts_at, a.starts_at + make_interval(mins => a.duration_minutes), '[)')
         && tstzrange(v_appt.starts_at, v_appt.starts_at + make_interval(mins => v_appt.duration_minutes), '[)');
  end if;

  return v_appt;
end $$;

-- ── RPC: either party cancels ───────────────────────────────
create or replace function public.cancel_appointment(
  p_appointment_id uuid
) returns public.appointments
language plpgsql security definer set search_path = public as $$
declare v_appt public.appointments;
begin
  select * into v_appt
    from public.appointments
    where id = p_appointment_id
      and (priest_id = auth.uid() or congregant_id = auth.uid());
  if v_appt.id is null then
    raise exception 'Appointment not found';
  end if;
  if v_appt.status = 'cancelled' then
    return v_appt;
  end if;

  update public.appointments
    set status = 'cancelled', updated_at = now()
    where id = p_appointment_id
    returning * into v_appt;
  return v_appt;
end $$;

-- ── RPC: anonymized busy ranges for the caller's FOC ────────
-- Lets a congregant compute which generated slots are already taken without
-- reading who booked them.
create or replace function public.foc_busy_ranges(
  p_days int default 21
) returns table(starts_at timestamptz, duration_minutes int)
language sql security definer set search_path = public as $$
  select a.starts_at, a.duration_minutes
  from public.appointments a
  join public.profiles p on p.id = auth.uid()
  where a.priest_id = p.foc_id
    and p.foc_consent_at is not null
    and a.status in ('requested','confirmed')
    and a.starts_at >= now()
    and a.starts_at < now() + make_interval(days => p_days);
$$;

grant execute on function public.request_appointment(uuid, timestamptz, text) to authenticated;
grant execute on function public.respond_appointment(uuid, boolean)         to authenticated;
grant execute on function public.cancel_appointment(uuid)                   to authenticated;
grant execute on function public.foc_busy_ranges(int)                       to authenticated;
