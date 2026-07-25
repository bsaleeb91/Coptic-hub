-- The FOC policy on prayer_requests only covered visibility = 'foc_only'.
-- A member choosing "FOC and Servant" believes their priest can see it too
-- (the app's getFocPrayerRequests() already queries for both values), but
-- with no policy covering 'foc_and_servant' for the FOC, RLS silently
-- returned nothing for that half of the shared requests. Mirrors the
-- servant-side policy, which already covers both of its values.

drop policy if exists "prayer: foc reads foc_and_servant" on public.prayer_requests;
create policy "prayer: foc reads foc_and_servant" on public.prayer_requests
  for select using (
    visibility = 'foc_and_servant'
    and exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.role in ('priest', 'admin')
        and exists (
          select 1 from public.profiles c
          where c.id = prayer_requests.user_id
            and c.foc_id = auth.uid()
        )
    )
  );
