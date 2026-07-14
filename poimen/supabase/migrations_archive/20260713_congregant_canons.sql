-- Allow congregants to add their own canon items alongside priest/servant-assigned ones.
-- priest_id NULL means "added by the congregant themselves"; priest_id set means
-- "assigned by a priest/servant" and stays locked to the assigner.

alter table public.spiritual_canons
  alter column priest_id drop not null;

-- Congregant can insert their own self-assigned canon items.
create policy "Congregant self-assigns canon" on public.spiritual_canons
  for insert with check (congregant_id = auth.uid() and priest_id is null);

-- Congregant can update (deactivate) only their own self-assigned items.
-- Priest/servant-assigned items stay locked to the assigner via the existing
-- "Priest updates canons they own" policy.
create policy "Congregant updates own self-assigned canon" on public.spiritual_canons
  for update using (congregant_id = auth.uid() and priest_id is null)
  with check (congregant_id = auth.uid() and priest_id is null);

-- Priest/servant can see ALL active canon items (self-assigned or assigned)
-- belonging to congregants linked to them, not just the ones they personally assigned.
create policy "Priest/servant reads linked congregant canons" on public.spiritual_canons
  for select using (
    exists (
      select 1 from public.profiles p
      where p.id = spiritual_canons.congregant_id
        and (p.foc_id = auth.uid() or p.servant_id = auth.uid())
    )
  );
