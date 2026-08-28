-- ============================================================
-- Migration: Priest canon templates — 2026-08-11
--
-- Building a member's canon from scratch every time is slow when a priest
-- prescribes much the same rule to many people. A template is a named, reusable
-- snapshot of the assign-canon editor: which categories it sets, the payload for
-- each (byte-for-byte the same shape spiritual_canons stores, so applying one
-- goes through the existing applyCategoryToRule), and any custom components.
--
-- Templates belong to the priest and are never read by anyone else — they are a
-- drafting aid, not part of a member's canon. Nothing is assigned until the
-- priest saves on the member's screen, so applying a template is only a way of
-- filling the editor in.
--
-- Safe to re-run.
-- ============================================================

create table if not exists public.canon_templates (
  id         uuid primary key default gen_random_uuid(),
  priest_id  uuid not null references auth.users(id) on delete cascade,
  name       text not null check (btrim(name) <> ''),
  body       jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.canon_templates enable row level security;

-- The priest's own drafting tool: no member, and no other priest, can see it.
drop policy if exists "templates: priest manages own" on public.canon_templates;
create policy "templates: priest manages own" on public.canon_templates
  for all using (priest_id = auth.uid()) with check (priest_id = auth.uid());

create index if not exists canon_templates_priest_idx
  on public.canon_templates (priest_id, created_at desc);
