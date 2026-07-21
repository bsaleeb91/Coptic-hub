-- ============================================================
-- Migration: FOC reads the member's confession dates — 2026-07-19
--
-- The member's self-reported confession DATES (never content) are
-- mirrored to agent_progress under 'confession-dates', so the
-- Father of Confession's member view can show self-reported
-- confessions in the Confession History alongside the encounters
-- the priest logged. Days-since already used the latest date via
-- profiles.last_confession_at; this adds the full dates-only log.
-- Gated on the same consented FOC link as the personal-rule and
-- vitals mirrors.
-- ============================================================

drop policy if exists "FOC reads flock confession dates" on public.agent_progress;
create policy "FOC reads flock confession dates" on public.agent_progress
  for select using (
    agent_slug = 'confession-dates'
    and exists (
      select 1 from public.profiles
      where id = agent_progress.user_id
        and foc_id = auth.uid()
        and foc_consent_at is not null
    )
  );
