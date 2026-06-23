-- FOC data access now requires explicit congregant consent (foc_consent_at IS NOT NULL).
-- Without consent, the priest cannot see pastoral contacts, profile, children, or vitals
-- even if foc_id is set. Consent is recorded at the moment of linking via the app.
--
-- Backfill: profiles that already have foc_id set are treated as having consented
-- (they linked voluntarily before this policy existed).

update public.profiles
set foc_consent_at = now()
where foc_id is not null
  and foc_consent_at is null;

-- pastoral_contacts
drop policy if exists "pastoral_contacts_foc_read" on public.pastoral_contacts;
create policy "pastoral_contacts_foc_read"
  on public.pastoral_contacts for select
  using (
    exists (
      select 1 from public.profiles
      where id             = pastoral_contacts.user_id
        and foc_id         = auth.uid()
        and foc_consent_at is not null
    )
  );

-- pastoral_profile
drop policy if exists "pastoral_profile_foc_read" on public.pastoral_profile;
create policy "pastoral_profile_foc_read"
  on public.pastoral_profile for select
  using (
    exists (
      select 1 from public.profiles
      where id             = pastoral_profile.user_id
        and foc_id         = auth.uid()
        and foc_consent_at is not null
    )
  );

-- pastoral_children
drop policy if exists "pastoral_children_foc_read" on public.pastoral_children;
create policy "pastoral_children_foc_read"
  on public.pastoral_children for select
  using (
    exists (
      select 1 from public.profiles
      where id             = pastoral_children.parent_id
        and foc_id         = auth.uid()
        and foc_consent_at is not null
    )
  );

-- agent_progress (vitals)
drop policy if exists "FOC reads flock vitals" on public.agent_progress;
create policy "FOC reads flock vitals" on public.agent_progress
  for select using (
    agent_slug = 'vitals'
    and exists (
      select 1 from public.profiles
      where id             = agent_progress.user_id
        and foc_id         = auth.uid()
        and foc_consent_at is not null
    )
  );
