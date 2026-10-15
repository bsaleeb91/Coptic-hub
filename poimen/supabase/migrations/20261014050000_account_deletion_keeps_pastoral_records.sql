-- Account deletion (the delete-account Edge Function removes the auth user;
-- profiles and everything keyed to it go by ON DELETE CASCADE).
--
-- Decided 2026-10-14: when a member deletes their account, the priest keeps his
-- records of them — encounters and his pastoral notes — detached from any
-- account. Today those rows cascade away with the member, and a priest who has
-- logged an encounter can't be deleted at all (priest_id is ON DELETE RESTRICT).
--
--   pastoral_encounters.congregant_id   CASCADE  -> SET NULL  (priest keeps it)
--   pastoral_encounters.priest_id       RESTRICT -> SET NULL  (member keeps
--                                       their Pastoral Journey and confession
--                                       dates when a priest deletes his account)
--   pastoral_notes.member_id            CASCADE  -> SET NULL  (priest keeps his
--                                       notes; they're his writing)
--   spiritual_canons.priest_id          CASCADE  -> SET NULL  (a canon a priest
--                                       assigned stays in the member's rule,
--                                       as their own, when he deletes)
--
-- Everything else a member owns already cascades: profile, agent_progress
-- (journal, vitals, psalms…), prayer requests, canons, completions, contacts,
-- children, appointments, push tokens, key backup + its history. A priest's
-- own private notes (pastoral_encounter_private_notes, pastoral_notes he
-- authored) cascade with him.
--
-- A detached row is readable only by whoever is still on it: "encounters:
-- priest owns" / "pastoral_notes_own" for the priest, "encounters: congregant
-- reads own" for the member. No one can see a row whose both ends are gone.
--
-- Rollback (only while no row has a NULL in these columns):
--   restore NOT NULL and the original ON DELETE actions listed above.

alter table public.pastoral_encounters alter column congregant_id drop not null;
alter table public.pastoral_encounters alter column priest_id drop not null;
alter table public.pastoral_notes alter column member_id drop not null;

alter table public.pastoral_encounters drop constraint if exists pastoral_encounters_congregant_id_fkey;
alter table public.pastoral_encounters add constraint pastoral_encounters_congregant_id_fkey
  foreign key (congregant_id) references public.profiles(id) on delete set null;

alter table public.pastoral_encounters drop constraint if exists pastoral_encounters_priest_id_fkey;
alter table public.pastoral_encounters add constraint pastoral_encounters_priest_id_fkey
  foreign key (priest_id) references public.profiles(id) on delete set null;

alter table public.pastoral_notes drop constraint if exists pastoral_notes_member_id_fkey;
alter table public.pastoral_notes add constraint pastoral_notes_member_id_fkey
  foreign key (member_id) references public.profiles(id) on delete set null;

alter table public.spiritual_canons drop constraint if exists spiritual_canons_priest_id_fkey;
alter table public.spiritual_canons add constraint spiritual_canons_priest_id_fkey
  foreign key (priest_id) references public.profiles(id) on delete set null;

-- An encounter whose priest AND member have both deleted their accounts belongs
-- to no one and is readable by no one; remove it (and the member note in it)
-- rather than keep data about nobody.
create schema if not exists private;

create or replace function private.drop_orphaned_encounter()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.priest_id is null and new.congregant_id is null then
    delete from public.pastoral_encounters where id = new.id;
  end if;
  return null;
end;
$$;

revoke all on function private.drop_orphaned_encounter() from public, anon, authenticated;

drop trigger if exists drop_orphaned_encounter on public.pastoral_encounters;
create trigger drop_orphaned_encounter
  after update of priest_id, congregant_id on public.pastoral_encounters
  for each row execute function private.drop_orphaned_encounter();
