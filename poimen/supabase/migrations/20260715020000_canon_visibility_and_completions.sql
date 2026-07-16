-- Canon visibility rules, tightened to match the intended pastoral model:
--
--   * FOC (priest):  sees ALL of a member's canons — but only once the member
--                    has consented to the FOC link (profiles.foc_consent_at).
--   * Assigner:      whoever assigned a canon (priest or servant, via
--                    spiritual_canons.priest_id) always sees it — already
--                    covered by "canons: priest owns" and "Servants can read
--                    canons they assigned".
--   * Servant:       gets NO member-wide grant; only what they assigned.
--
-- This replaces "Priest/servant reads linked congregant canons", which let
-- both the FOC and the servant read every canon with no consent gate.
--
-- Also fixes the long-standing completions gap: canon_completions previously
-- had only an owner policy (auth.uid() = user_id), so the assigner's weekly
-- completion counts always read 0. Completions now follow the same visibility
-- as the canons themselves. Safe to re-run.

-- ── spiritual_canons ─────────────────────────────────────────

drop policy if exists "Priest/servant reads linked congregant canons" on public.spiritual_canons;

drop policy if exists "FOC reads flock canons" on public.spiritual_canons;
create policy "FOC reads flock canons" on public.spiritual_canons
  for select using (
    exists (
      select 1 from public.profiles p
      where p.id = spiritual_canons.congregant_id
        and p.foc_id = auth.uid()
        and p.foc_consent_at is not null
    )
  );

-- ── canon_completions ────────────────────────────────────────

drop policy if exists "Assigner reads completions" on public.canon_completions;
create policy "Assigner reads completions" on public.canon_completions
  for select using (
    exists (
      select 1 from public.spiritual_canons c
      where c.id = canon_completions.canon_id
        and c.priest_id = auth.uid()
    )
  );

drop policy if exists "FOC reads flock completions" on public.canon_completions;
create policy "FOC reads flock completions" on public.canon_completions
  for select using (
    exists (
      select 1 from public.profiles p
      where p.id = canon_completions.user_id
        and p.foc_id = auth.uid()
        and p.foc_consent_at is not null
    )
  );
