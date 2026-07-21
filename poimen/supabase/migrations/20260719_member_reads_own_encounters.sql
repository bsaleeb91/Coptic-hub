-- ============================================================
-- Migration: members read their own pastoral encounters — 2026-07-19
--
-- Repo catch-up: the LIVE database already has this policy (added
-- outside the repo's migrations — verified 2026-07-19), but the repo
-- only defined priest-side policies (priest_id = auth.uid()), so a
-- fresh database built from these migrations would leave the
-- congregant dashboard's Pastoral Journey permanently empty. The
-- policy name matches the live one exactly, so re-running this on
-- the live project is a harmless drop-and-recreate.
--
-- Members may see encounters logged about them — the priest's Log
-- Encounter screen promises "This note appears in the member's
-- Pastoral Journey timeline."
-- ============================================================

drop policy if exists "encounters: congregant reads own" on public.pastoral_encounters;
create policy "encounters: congregant reads own" on public.pastoral_encounters
  for select using (auth.uid() = congregant_id);
