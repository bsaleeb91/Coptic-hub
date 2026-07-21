-- ============================================================
-- Migration: FOC reads flock pastoral-visit requests — 2026-07-20
--
-- A congregant taps "Request Pastoral Visit" on their home screen,
-- which writes agent_progress (slug 'visit-request', own row). Their
-- Father of Confession sees the flag on the flock list. This policy
-- lets the FOC read that slug for members linked to them, gated on the
-- same consented FOC link as the other FOC reads.
-- ============================================================

drop policy if exists "FOC reads flock visit requests" on public.agent_progress;
create policy "FOC reads flock visit requests" on public.agent_progress
  for select using (
    agent_slug = 'visit-request'
    and exists (
      select 1 from public.profiles
      where id = agent_progress.user_id
        and foc_id = auth.uid()
        and foc_consent_at is not null
    )
  );
