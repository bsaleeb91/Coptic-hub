-- =============================================================
-- Coptic Hub + Poimen — Shared Supabase Schema
-- Run this in the Supabase SQL editor (Dashboard → SQL Editor)
-- =============================================================

-- Enable pgvector for RAG (Bible Commentary, Rites & Traditions)
create extension if not exists vector with schema extensions;

-- =============================================================
-- SHARED: profiles
-- One row per auth user. Used by both apps.
-- =============================================================
create table if not exists public.profiles (
  id            uuid primary key references auth.users on delete cascade,
  full_name     text,
  role          text not null default 'congregant' check (role in ('congregant', 'priest', 'admin')),
  school_role   text check (school_role in ('teacher', 'student', null)),
  class_id      uuid,
  foc_id        uuid references public.profiles(id) on delete set null, -- Father of Confession
  servant_id    uuid references public.profiles(id) on delete set null, -- Sunday school servant
  avatar_url    text,
  church_name   text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, new.raw_user_meta_data->>'full_name');
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- =============================================================
-- COPTIC HUB: agent_progress
-- =============================================================
create table if not exists public.agent_progress (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  agent_slug  text not null,
  payload     jsonb not null default '{}',
  updated_at  timestamptz not null default now(),
  unique (user_id, agent_slug)
);

-- =============================================================
-- COPTIC HUB: conversations + messages (grounded RAG agents)
-- =============================================================
create table if not exists public.conversations (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  agent_slug  text not null,
  title       text,
  created_at  timestamptz not null default now()
);

create table if not exists public.messages (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  role            text not null check (role in ('user', 'assistant')),
  content         text not null,
  citations       jsonb,
  created_at      timestamptz not null default now()
);

-- =============================================================
-- COPTIC HUB: sources + source_chunks (RAG pipeline)
-- =============================================================
create table if not exists public.sources (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  agent_slug  text not null,
  title       text not null,
  file_path   text,
  status      text not null default 'pending' check (status in ('pending', 'processing', 'ready', 'failed')),
  error_msg   text,
  created_at  timestamptz not null default now()
);

create table if not exists public.source_chunks (
  id          uuid primary key default gen_random_uuid(),
  source_id   uuid not null references public.sources(id) on delete cascade,
  page        int,
  chunk_index int not null,
  content     text not null,
  embedding   extensions.vector(1024),
  created_at  timestamptz not null default now()
);

create index if not exists source_chunks_embedding_idx
  on public.source_chunks using ivfflat (embedding extensions.vector_cosine_ops)
  with (lists = 100);

-- match_chunks RPC for RAG retrieval
create or replace function public.match_chunks(
  query_embedding extensions.vector(1024),
  match_threshold float,
  match_count     int,
  p_agent_slug    text,
  p_user_id       uuid
)
returns table (
  id       uuid,
  content  text,
  page     int,
  source_id uuid,
  similarity float
)
language sql stable as $$
  select
    sc.id, sc.content, sc.page, sc.source_id,
    1 - (sc.embedding <=> query_embedding) as similarity
  from public.source_chunks sc
  join public.sources s on s.id = sc.source_id
  where s.user_id = p_user_id
    and s.agent_slug = p_agent_slug
    and s.status = 'ready'
    and 1 - (sc.embedding <=> query_embedding) > match_threshold
  order by sc.embedding <=> query_embedding
  limit match_count;
$$;

-- =============================================================
-- POIMEN: pastoral_encounters
-- Priest logs encounters (confession, counseling, visit, etc.)
-- =============================================================
create table if not exists public.pastoral_encounters (
  id                uuid primary key default gen_random_uuid(),
  priest_id         uuid not null references public.profiles(id) on delete cascade,
  congregant_id     uuid not null references public.profiles(id) on delete cascade,
  encounter_type    text not null check (encounter_type in ('confession','counseling','advice','visit','phone','group')),
  encountered_at    date not null default current_date,
  member_note       text,     -- visible to congregant in their timeline
  private_note      text,     -- FOC only, never shown to congregant
  outcomes          text[],
  follow_up_date    date,
  created_at        timestamptz not null default now()
);

-- =============================================================
-- POIMEN: spiritual_canons
-- Assigned spiritual disciplines (canon components)
-- =============================================================
create table if not exists public.spiritual_canons (
  id              uuid primary key default gen_random_uuid(),
  priest_id       uuid not null references public.profiles(id) on delete cascade,
  congregant_id   uuid not null references public.profiles(id) on delete cascade,
  component       text not null,
  frequency       text not null,
  start_date      date not null,
  reflection_prompt text,
  encounter_id    uuid references public.pastoral_encounters(id) on delete set null,
  active          boolean not null default true,
  created_at      timestamptz not null default now()
);

-- =============================================================
-- POIMEN: canon_completions
-- Congregant logs daily completion (shared % only, not content)
-- =============================================================
create table if not exists public.canon_completions (
  id          uuid primary key default gen_random_uuid(),
  canon_id    uuid not null references public.spiritual_canons(id) on delete cascade,
  user_id     uuid not null references public.profiles(id) on delete cascade,
  completed_on date not null default current_date,
  unique (canon_id, completed_on)
);

-- =============================================================
-- POIMEN: prayer_requests
-- =============================================================
create table if not exists public.prayer_requests (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.profiles(id) on delete cascade,
  topic         text not null,
  visibility    text not null default 'private' check (visibility in ('private','foc_only','foc_and_servant','servant_only')),
  answered      boolean not null default false,
  answered_note text,
  created_at    timestamptz not null default now()
);

-- =============================================================
-- RLS POLICIES
-- =============================================================
alter table public.profiles           enable row level security;
alter table public.agent_progress     enable row level security;
alter table public.conversations      enable row level security;
alter table public.messages           enable row level security;
alter table public.sources            enable row level security;
alter table public.source_chunks      enable row level security;
alter table public.pastoral_encounters enable row level security;
alter table public.spiritual_canons   enable row level security;
alter table public.canon_completions  enable row level security;
alter table public.prayer_requests    enable row level security;

-- profiles: users see only their own row; priests see their congregants
create policy "profiles: own row" on public.profiles
  for all using (auth.uid() = id);

create policy "profiles: priest sees flock" on public.profiles
  for select using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role in ('priest','admin')
    )
    and foc_id = auth.uid()
  );

-- agent_progress: own rows only
create policy "agent_progress: own" on public.agent_progress
  for all using (auth.uid() = user_id);

-- conversations: own rows only
create policy "conversations: own" on public.conversations
  for all using (auth.uid() = user_id);

-- messages: own conversations only
create policy "messages: own conversations" on public.messages
  for all using (
    exists (
      select 1 from public.conversations c
      where c.id = conversation_id and c.user_id = auth.uid()
    )
  );

-- sources: own rows only
create policy "sources: own" on public.sources
  for all using (auth.uid() = user_id);

-- source_chunks: own sources only
create policy "source_chunks: own sources" on public.source_chunks
  for all using (
    exists (
      select 1 from public.sources s
      where s.id = source_id and s.user_id = auth.uid()
    )
  );

-- pastoral_encounters: priest owns + congregant can read their own
create policy "encounters: priest owns" on public.pastoral_encounters
  for all using (auth.uid() = priest_id);

create policy "encounters: congregant reads own" on public.pastoral_encounters
  for select using (auth.uid() = congregant_id);

-- spiritual_canons: priest owns + congregant reads own
create policy "canons: priest owns" on public.spiritual_canons
  for all using (auth.uid() = priest_id);

create policy "canons: congregant reads own" on public.spiritual_canons
  for select using (auth.uid() = congregant_id);

-- canon_completions: own rows only
create policy "canon_completions: own" on public.canon_completions
  for all using (auth.uid() = user_id);

-- prayer_requests: own rows + FOC reads foc_only/foc_and_servant + servant reads servant_only/foc_and_servant
create policy "prayer: own" on public.prayer_requests
  for all using (auth.uid() = user_id);

create policy "prayer: foc reads shared" on public.prayer_requests
  for select using (
    visibility in ('foc_only', 'foc_and_servant')
    and exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.role in ('priest','admin')
        and exists (
          select 1 from public.profiles c
          where c.id = prayer_requests.user_id and c.foc_id = auth.uid()
        )
    )
  );

create policy "prayer: servant reads shared" on public.prayer_requests
  for select using (
    visibility in ('servant_only', 'foc_and_servant')
    and exists (
      select 1 from public.profiles c
      where c.id = prayer_requests.user_id and c.servant_id = auth.uid()
    )
  );
