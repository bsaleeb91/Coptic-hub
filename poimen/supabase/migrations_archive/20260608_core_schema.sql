-- Poimen core schema — run this against a fresh Supabase project.
-- Order matters: profiles must exist before foreign-key references.

-- ── Extensions ────────────────────────────────────────────────
create extension if not exists "uuid-ossp";

-- ── Profiles (extends auth.users) ────────────────────────────
create table if not exists public.profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  full_name    text,
  church_name  text,
  role         text not null default 'congregant'
               check (role in ('congregant','priest','servant','admin')),
  avatar_url   text,
  foc_id       uuid references public.profiles(id) on delete set null,
  servant_id   uuid references public.profiles(id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "Users read own profile" on public.profiles
  for select using (auth.uid() = id);

create policy "Priest reads flock" on public.profiles
  for select using (foc_id = auth.uid());

create policy "Servant reads students" on public.profiles
  for select using (servant_id = auth.uid());

create policy "Users update own profile" on public.profiles
  for update using (auth.uid() = id);

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', null),
    'congregant'
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ── Pastoral encounters ───────────────────────────────────────
create table if not exists public.pastoral_encounters (
  id             uuid primary key default uuid_generate_v4(),
  priest_id      uuid not null references public.profiles(id) on delete cascade,
  congregant_id  uuid not null references public.profiles(id) on delete cascade,
  encounter_type text not null
                 check (encounter_type in ('confession','counseling','visit','advice','phone','group')),
  encountered_at timestamptz not null default now(),
  member_note    text,
  outcomes       jsonb,
  created_at     timestamptz not null default now()
);

alter table public.pastoral_encounters enable row level security;

create policy "Priest reads own encounters" on public.pastoral_encounters
  for select using (priest_id = auth.uid());

create policy "Priest writes encounters" on public.pastoral_encounters
  for insert with check (priest_id = auth.uid());

create policy "Congregant reads own encounters" on public.pastoral_encounters
  for select using (congregant_id = auth.uid());

create index if not exists pastoral_encounters_priest_idx on public.pastoral_encounters(priest_id, encountered_at desc);
create index if not exists pastoral_encounters_cong_idx  on public.pastoral_encounters(congregant_id, encountered_at desc);

-- ── Private encounter notes (priest-only) ─────────────────────
create table if not exists public.pastoral_encounter_private_notes (
  id            uuid primary key default uuid_generate_v4(),
  encounter_id  uuid not null references public.pastoral_encounters(id) on delete cascade,
  priest_id     uuid not null references public.profiles(id) on delete cascade,
  private_note  text not null
);

alter table public.pastoral_encounter_private_notes enable row level security;

create policy "Priest reads own private notes" on public.pastoral_encounter_private_notes
  for select using (priest_id = auth.uid());

create policy "Priest writes private notes" on public.pastoral_encounter_private_notes
  for insert with check (priest_id = auth.uid());

-- ── Spiritual canons ──────────────────────────────────────────
create table if not exists public.spiritual_canons (
  id                uuid primary key default uuid_generate_v4(),
  congregant_id     uuid not null references public.profiles(id) on delete cascade,
  priest_id         uuid not null references public.profiles(id) on delete cascade,
  component         text not null,
  frequency         text not null default 'Daily'
                    check (frequency in ('Daily','3x/week','Weekly','Custom')),
  start_date        date not null default current_date,
  end_date          date,
  active            boolean not null default true,
  reflection_prompt text,
  created_at        timestamptz not null default now()
);

alter table public.spiritual_canons enable row level security;

create policy "Priest/servant writes canons" on public.spiritual_canons
  for insert with check (priest_id = auth.uid());

create policy "Priest/servant reads own assignments" on public.spiritual_canons
  for select using (priest_id = auth.uid());

create policy "Congregant reads own canons" on public.spiritual_canons
  for select using (congregant_id = auth.uid());

create policy "Priest updates canons they own" on public.spiritual_canons
  for update using (priest_id = auth.uid());

create index if not exists spiritual_canons_cong_idx on public.spiritual_canons(congregant_id, active);

-- ── Canon completions ─────────────────────────────────────────
create table if not exists public.canon_completions (
  id            uuid primary key default uuid_generate_v4(),
  canon_id      uuid not null references public.spiritual_canons(id) on delete cascade,
  user_id       uuid not null references public.profiles(id) on delete cascade,
  completed_on  date not null default current_date,
  unique (canon_id, user_id, completed_on)
);

alter table public.canon_completions enable row level security;

create policy "User reads own completions" on public.canon_completions
  for select using (user_id = auth.uid());

create policy "User writes own completions" on public.canon_completions
  for insert with check (user_id = auth.uid());

create index if not exists canon_completions_canon_idx on public.canon_completions(canon_id);

-- ── Prayer requests ───────────────────────────────────────────
create table if not exists public.prayer_requests (
  id            uuid primary key default uuid_generate_v4(),
  user_id       uuid not null references public.profiles(id) on delete cascade,
  category      text not null default 'other'
                check (category in ('health','family','relationships','work','faith','gratitude','other')),
  body          text,
  visibility    text not null default 'private'
                check (visibility in ('private','foc_only','foc_and_servant','servant_only')),
  answered      boolean not null default false,
  answered_note text,
  created_at    timestamptz not null default now()
);

alter table public.prayer_requests enable row level security;

create policy "User reads own requests" on public.prayer_requests
  for select using (user_id = auth.uid());

create policy "User writes own requests" on public.prayer_requests
  for insert with check (user_id = auth.uid());

create policy "User updates own requests" on public.prayer_requests
  for update using (user_id = auth.uid());

create policy "User deletes own requests" on public.prayer_requests
  for delete using (user_id = auth.uid());

-- Priest can read requests shared with FOC
create policy "Priest reads foc-shared requests" on public.prayer_requests
  for select using (
    visibility in ('foc_only','foc_and_servant')
    and exists (
      select 1 from public.profiles
      where id = prayer_requests.user_id and foc_id = auth.uid()
    )
  );

create index if not exists prayer_requests_user_idx on public.prayer_requests(user_id, answered);

-- ── Agent progress (per-user KV store) ────────────────────────
create table if not exists public.agent_progress (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  agent_slug  text not null,
  payload     jsonb not null default '{}'::jsonb,
  updated_at  timestamptz not null default now(),
  unique (user_id, agent_slug)
);

alter table public.agent_progress enable row level security;

create policy "User reads own progress" on public.agent_progress
  for select using (user_id = auth.uid());

create policy "User writes own progress" on public.agent_progress
  for insert with check (user_id = auth.uid());

create policy "User updates own progress" on public.agent_progress
  for update using (user_id = auth.uid());
