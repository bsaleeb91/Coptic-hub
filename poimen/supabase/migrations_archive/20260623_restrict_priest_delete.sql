-- Prevent priest deletion from cascade-deleting all encounter history.
-- A priest leaving the church should not erase congregants' pastoral records.
-- Restrict the FK so the priest profile cannot be deleted while encounters exist.

alter table public.pastoral_encounters
  drop constraint if exists pastoral_encounters_priest_id_fkey;

alter table public.pastoral_encounters
  add constraint pastoral_encounters_priest_id_fkey
  foreign key (priest_id) references public.profiles(id) on delete restrict;
