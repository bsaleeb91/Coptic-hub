-- ============================================================
-- Migration: security fixes — 2026-06-18
-- Self-contained: creates pastoral tables if missing, then applies
-- correct policies. Safe to re-run (all IF EXISTS / IF NOT EXISTS).
-- ============================================================


-- ── 1. Block role self-escalation ────────────────────────────
-- Original UPDATE policy had no WITH CHECK, letting any user set
-- their own role = 'priest' via a direct client call.
-- The role subquery must go through a SECURITY DEFINER function —
-- a bare subquery on profiles inside a profiles policy causes
-- infinite recursion during RLS evaluation.

create or replace function public.get_my_role()
returns text language sql stable security definer set search_path = public as $$
  select role from public.profiles where id = auth.uid()
$$;

drop policy if exists "Users update own profile" on public.profiles;

create policy "Users update own profile" on public.profiles
  for update
  using  (auth.uid() = id)
  with check (
    auth.uid() = id
    and role = public.get_my_role()
  );


-- ── 2. Add foc_consent_at if missing ─────────────────────────
-- getProfile() selects this column. Missing column causes every
-- getProfile() call to return null, silently breaking auth.

alter table public.profiles
  add column if not exists foc_consent_at timestamptz;


-- ── 3. Pastoral contact/profile/children tables ───────────────
-- The second migration was never applied to the live DB.
-- Creating all three tables here with IF NOT EXISTS so this is
-- safe whether or not the tables already exist.

create table if not exists public.pastoral_contacts (
  user_id       uuid primary key references public.profiles(id) on delete cascade,
  phone         text,
  email         text,
  address_line1 text,
  address_line2 text,
  city          text,
  state         text,
  zip           text,
  country       text default 'US',
  updated_at    timestamptz default now()
);

alter table public.pastoral_contacts enable row level security;

create table if not exists public.pastoral_profile (
  user_id      uuid primary key references public.profiles(id) on delete cascade,
  life_stage   text check (life_stage in ('single', 'engaged', 'married', 'widowed', 'divorced')),
  spouse_name  text,
  updated_at   timestamptz default now()
);

alter table public.pastoral_profile enable row level security;

create table if not exists public.pastoral_children (
  id          uuid        primary key default gen_random_uuid(),
  parent_id   uuid        not null references public.profiles(id) on delete cascade,
  name        text        not null,
  birth_year  integer     not null,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

alter table public.pastoral_children enable row level security;


-- ── 4. Pastoral self-policies (owner read/write) ──────────────

drop policy if exists "pastoral_contacts_self" on public.pastoral_contacts;
create policy "pastoral_contacts_self"
  on public.pastoral_contacts for all
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "pastoral_profile_self" on public.pastoral_profile;
create policy "pastoral_profile_self"
  on public.pastoral_profile for all
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "pastoral_children_self" on public.pastoral_children;
create policy "pastoral_children_self"
  on public.pastoral_children for all
  using  (auth.uid() = parent_id)
  with check (auth.uid() = parent_id);


-- ── 5. Fix FOC read policies — priest_congregant_links → profiles.foc_id ──
-- The original migration referenced priest_congregant_links which was never
-- created. Rewritten to use the foc_id FK that actually exists on profiles.

drop policy if exists "pastoral_contacts_foc_read" on public.pastoral_contacts;
create policy "pastoral_contacts_foc_read"
  on public.pastoral_contacts for select
  using (
    exists (
      select 1 from public.profiles
      where id     = pastoral_contacts.user_id
        and foc_id = auth.uid()
    )
  );

drop policy if exists "pastoral_profile_foc_read" on public.pastoral_profile;
create policy "pastoral_profile_foc_read"
  on public.pastoral_profile for select
  using (
    exists (
      select 1 from public.profiles
      where id     = pastoral_profile.user_id
        and foc_id = auth.uid()
    )
  );

drop policy if exists "pastoral_children_foc_read" on public.pastoral_children;
create policy "pastoral_children_foc_read"
  on public.pastoral_children for select
  using (
    exists (
      select 1 from public.profiles
      where id     = pastoral_children.parent_id
        and foc_id = auth.uid()
    )
  );


-- ── 6. FOC can read congregant vitals ────────────────────────
-- agent_progress only had a self-read policy. Priests were silently
-- blocked from reading member vitals despite the app's privacy copy
-- saying vitals are shared with the FOC.

drop policy if exists "FOC reads flock vitals" on public.agent_progress;
create policy "FOC reads flock vitals" on public.agent_progress
  for select using (
    agent_slug = 'vitals'
    and exists (
      select 1 from public.profiles
      where id     = agent_progress.user_id
        and foc_id = auth.uid()
    )
  );
