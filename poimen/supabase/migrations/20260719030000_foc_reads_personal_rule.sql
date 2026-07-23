-- ============================================================
-- Migration: FOC reads the member's current canon — 2026-07-19
--
-- The Father of Confession's member view now shows the member's
-- CURRENT self-set rule, and the canon editor pre-fills from it so
-- "editing the canon" starts from what the member actually does.
-- The rule is mirrored to agent_progress under 'personal-rule', but
-- the existing FOC policy only covered agent_slug = 'vitals'. Gated
-- on the same consented FOC link (the member chose this priest and
-- consent was recorded); vitals_consent is NOT required — that
-- toggle governs the computed vitals, while the rule is the very
-- thing priest and member set together.
-- ============================================================

drop policy if exists "FOC reads flock personal rule" on public.agent_progress;
create policy "FOC reads flock personal rule" on public.agent_progress
  for select using (
    agent_slug = 'personal-rule'
    and exists (
      select 1 from public.profiles
      where id = agent_progress.user_id
        and foc_id = auth.uid()
        and foc_consent_at is not null
    )
  );
