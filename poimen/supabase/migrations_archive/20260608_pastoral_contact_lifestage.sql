-- ============================================================
-- Migration: pastoral contact info, life stage, children
-- Date: 2026-06-08
-- Tables: pastoral_contacts, pastoral_profile, pastoral_children
-- Ownership: congregant writes own rows; active FOC reads only
-- Portability: all three tables use congregant user_id as PK/FK
--   so FOC access transfers automatically when the link changes
-- ============================================================


-- ── pastoral_contacts ────────────────────────────────────────
-- Phone, email, and home address for priestly visitation.
-- Congregant fills this in via their profile screen.

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

-- Congregant reads and writes their own row
drop policy if exists "pastoral_contacts_self" on public.pastoral_contacts;
create policy "pastoral_contacts_self"
  on public.pastoral_contacts for all
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Active FOC may read their linked congregant's contact info
drop policy if exists "pastoral_contacts_foc_read" on public.pastoral_contacts;
create policy "pastoral_contacts_foc_read"
  on public.pastoral_contacts for select
  using (
    exists (
      select 1 from public.priest_congregant_links
      where congregant_id = pastoral_contacts.user_id
        and priest_id      = auth.uid()
        and revoked_at    is null
    )
  );


-- ── pastoral_profile ─────────────────────────────────────────
-- Life stage and spouse name.

create table if not exists public.pastoral_profile (
  user_id      uuid primary key references public.profiles(id) on delete cascade,
  life_stage   text check (life_stage in ('single', 'engaged', 'married', 'widowed', 'divorced')),
  spouse_name  text,
  updated_at   timestamptz default now()
);

alter table public.pastoral_profile enable row level security;

drop policy if exists "pastoral_profile_self" on public.pastoral_profile;
create policy "pastoral_profile_self"
  on public.pastoral_profile for all
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "pastoral_profile_foc_read" on public.pastoral_profile;
create policy "pastoral_profile_foc_read"
  on public.pastoral_profile for select
  using (
    exists (
      select 1 from public.priest_congregant_links
      where congregant_id = pastoral_profile.user_id
        and priest_id      = auth.uid()
        and revoked_at    is null
    )
  );


-- ── pastoral_children ────────────────────────────────────────
-- Children records. Stores birth_year (not full DOB) to
-- allow age display without storing precise child DOBs.

create table if not exists public.pastoral_children (
  id          uuid        primary key default gen_random_uuid(),
  parent_id   uuid        not null references public.profiles(id) on delete cascade,
  name        text        not null,
  birth_year  integer     not null,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

alter table public.pastoral_children enable row level security;

drop policy if exists "pastoral_children_self" on public.pastoral_children;
create policy "pastoral_children_self"
  on public.pastoral_children for all
  using  (auth.uid() = parent_id)
  with check (auth.uid() = parent_id);

drop policy if exists "pastoral_children_foc_read" on public.pastoral_children;
create policy "pastoral_children_foc_read"
  on public.pastoral_children for select
  using (
    exists (
      select 1 from public.priest_congregant_links
      where congregant_id = pastoral_children.parent_id
        and priest_id      = auth.uid()
        and revoked_at    is null
    )
  );
