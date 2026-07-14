-- Servant can read prayer requests their students have shared with them.
-- Mirrors the existing "Priest reads foc-shared requests" policy.

create policy "Servant reads servant-shared requests" on public.prayer_requests
  for select using (
    visibility in ('servant_only','foc_and_servant')
    and exists (
      select 1 from public.profiles
      where id = prayer_requests.user_id
        and servant_id = auth.uid()
    )
  );
