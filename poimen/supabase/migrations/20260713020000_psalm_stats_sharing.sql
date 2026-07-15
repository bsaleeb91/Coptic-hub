-- Psalm memorization stats sharing.
--
-- The app publishes a small summary (streak, counts, memorized psalm labels)
-- to agent_progress under agent_slug = 'psalm-stats'. These policies let the
-- Father of Confession and the assigned servant read that one slug, gated on
-- the same consent flags as spiritual vitals:
--   * FOC:     profiles.foc_id = auth.uid(), FOC link consented, vitals shared
--   * Servant: profiles.servant_id = auth.uid(), vitals shared
-- Consent UX may split into its own toggle later; enforcement ships now.
-- Safe to re-run.

drop policy if exists "FOC reads psalm stats" on public.agent_progress;
create policy "FOC reads psalm stats" on public.agent_progress
  for select using (
    agent_slug = 'psalm-stats'
    and exists (
      select 1 from public.profiles
      where profiles.id = agent_progress.user_id
        and profiles.foc_id = auth.uid()
        and profiles.foc_consent_at is not null
        and profiles.vitals_consent = true
    )
  );

drop policy if exists "Servant reads psalm stats" on public.agent_progress;
create policy "Servant reads psalm stats" on public.agent_progress
  for select using (
    agent_slug = 'psalm-stats'
    and exists (
      select 1 from public.profiles
      where profiles.id = agent_progress.user_id
        and profiles.servant_id = auth.uid()
        and profiles.vitals_consent = true
    )
  );
