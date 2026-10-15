-- Three gaps found reviewing the SELECT/write policies on 2026-10-14.
--
-- 1. "priest servant profiles are discoverable" had no role, so it applied to
--    anon too: anyone holding the public anon key — it ships inside the app —
--    could list every priest, servant and admin (name, church, invite code,
--    last_seen_at, last_confession_at) without signing in. Its only uses are
--    the invite-code lookup in link-to-foc.tsx and a member reading their own
--    priest's name, both signed in.
--
-- 2. "encounters: priest owns" and "canons: priest owns" are FOR ALL with
--    USING (priest_id = auth.uid()) and no other check, so any signed-in user,
--    congregants included, could write an encounter (member note and all) or a
--    canon into anyone's history by naming themselves as the priest. Now a new
--    row must target someone who chose the writer: their foc_id (priest) or
--    servant_id (servant). Only the member can set those on their own profile.
--    Existing rows are untouched — these checks run on writes only.
--
-- 3. An UPDATE could also repoint an existing row at someone else. A trigger
--    pins congregant_id and priest_id after insert; RLS can't compare old and
--    new values.
--
-- Not covered here: joining a flock is still a plain update of one's own
-- foc_id, so the invite code isn't enforced server-side. Fixing that needs a
-- join_flock(code) RPC and an app change.
--
-- Rollback:
--   alter policy "priest servant profiles are discoverable" on public.profiles to public;
--   drop policy "encounters: writer is the member's priest" on public.pastoral_encounters;
--   drop policy "canons: writer is the member's priest or servant" on public.spiritual_canons;
--   drop trigger pin_encounter_parties on public.pastoral_encounters;
--   drop trigger pin_canon_parties on public.spiritual_canons;
--   drop function private.pin_row_parties();

-- 1 ─────────────────────────────────────────────────────────
alter policy "priest servant profiles are discoverable" on public.profiles
  to authenticated;

-- 2 ─────────────────────────────────────────────────────────
drop policy if exists "encounters: writer is the member's priest" on public.pastoral_encounters;
create policy "encounters: writer is the member's priest" on public.pastoral_encounters
  as restrictive for insert to authenticated
  with check (
    priest_id = auth.uid()
    and public.get_my_role() in ('priest', 'admin')
    and exists (
      select 1 from public.profiles c
      where c.id = pastoral_encounters.congregant_id
        and c.foc_id = auth.uid()
    )
  );

drop policy if exists "canons: writer is the member's priest or servant" on public.spiritual_canons;
create policy "canons: writer is the member's priest or servant" on public.spiritual_canons
  as restrictive for insert to authenticated
  with check (
    -- a member's own self-assigned canon
    (priest_id is null and congregant_id = auth.uid())
    or (
      priest_id = auth.uid()
      and exists (
        select 1 from public.profiles c
        where c.id = spiritual_canons.congregant_id
          and (
            (c.foc_id = auth.uid() and public.get_my_role() in ('priest', 'admin'))
            or (c.servant_id = auth.uid() and public.get_my_role() in ('servant', 'priest', 'admin'))
          )
      )
    )
  );

-- 3 ─────────────────────────────────────────────────────────
create schema if not exists private;

create or replace function private.pin_row_parties()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  -- auth.uid() is null for the dashboard and service role: leave them free to
  -- correct a row by hand.
  if auth.uid() is not null
     and (new.congregant_id is distinct from old.congregant_id
          or new.priest_id is distinct from old.priest_id) then
    raise exception 'congregant_id and priest_id cannot be changed after a row is created'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists pin_encounter_parties on public.pastoral_encounters;
create trigger pin_encounter_parties
  before update on public.pastoral_encounters
  for each row execute function private.pin_row_parties();

drop trigger if exists pin_canon_parties on public.spiritual_canons;
create trigger pin_canon_parties
  before update on public.spiritual_canons
  for each row execute function private.pin_row_parties();
