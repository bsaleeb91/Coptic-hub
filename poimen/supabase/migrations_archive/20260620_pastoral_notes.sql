-- ── 1. Create pastoral_notes table ──────────────────────────
-- Replaces the agent_progress JSON blob approach for both priest
-- notes (pastoral-notes-{id}) and servant notes (servant-notes-{id}).
-- author_id = whoever wrote the note (priest or servant).
-- Notes are author-private: the subject (member/student) never has access.

create table if not exists public.pastoral_notes (
  id         uuid        primary key default gen_random_uuid(),
  author_id  uuid        not null references public.profiles(id) on delete cascade,
  member_id  uuid        not null references public.profiles(id) on delete cascade,
  body       text        not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.pastoral_notes enable row level security;

drop policy if exists "pastoral_notes_own" on public.pastoral_notes;
create policy "pastoral_notes_own" on public.pastoral_notes
  for all
  using  (auth.uid() = author_id)
  with check (auth.uid() = author_id);


-- ── 2. Migrate priest notes (pastoral-notes-{member_uuid}) ───
-- 'pastoral-notes-' = 15 chars → UUID starts at position 16

insert into public.pastoral_notes (author_id, member_id, body, created_at, updated_at)
select
  ap.user_id,
  substring(ap.agent_slug, 16)::uuid,
  ap.payload->>'text',
  coalesce((ap.payload->>'updated_at')::timestamptz, now()),
  coalesce((ap.payload->>'updated_at')::timestamptz, now())
from public.agent_progress ap
where ap.agent_slug like 'pastoral-notes-%'
  and ap.payload->>'text' is not null
  and trim(ap.payload->>'text') <> ''
on conflict do nothing;


-- ── 3. Migrate servant notes (servant-notes-{member_uuid}) ───
-- 'servant-notes-' = 14 chars → UUID starts at position 15

insert into public.pastoral_notes (author_id, member_id, body, created_at, updated_at)
select
  ap.user_id,
  substring(ap.agent_slug, 15)::uuid,
  ap.payload->>'text',
  coalesce((ap.payload->>'updated_at')::timestamptz, now()),
  coalesce((ap.payload->>'updated_at')::timestamptz, now())
from public.agent_progress ap
where ap.agent_slug like 'servant-notes-%'
  and ap.payload->>'text' is not null
  and trim(ap.payload->>'text') <> ''
on conflict do nothing;
