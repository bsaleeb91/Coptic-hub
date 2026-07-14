-- Add explicit vitals sharing consent to profiles.
-- null  = not yet asked (modal will appear on Dashboard)
-- true  = congregant has consented to share vitals with FOC
-- false = congregant declined (nudge banner shown on Dashboard)

alter table public.profiles
  add column if not exists vitals_consent boolean;

-- Update FOC vitals policy to require vitals_consent = true
-- in addition to the foc_consent_at gate added previously.
drop policy if exists "FOC reads flock vitals" on public.agent_progress;
create policy "FOC reads flock vitals" on public.agent_progress
  for select using (
    agent_slug = 'vitals'
    and exists (
      select 1 from public.profiles
      where id             = agent_progress.user_id
        and foc_id         = auth.uid()
        and foc_consent_at is not null
        and vitals_consent = true
    )
  );
