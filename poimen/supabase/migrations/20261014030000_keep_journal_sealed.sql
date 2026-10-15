-- The Spiritual Journal and Blessings rows in agent_progress are now sealed to
-- the member's own key (payload { sealed: 'box1:…' }, lib/journal.ts). Older
-- app builds — App Store 1.0.0 can't take over-the-air updates — read
-- payload.entries, find nothing in a sealed row, show an empty journal, and on
-- the next save upsert { entries: [that one entry] } over the sealed row:
-- every earlier entry gone.
--
-- Once a journal row is sealed, refuse an update that would replace it with an
-- unsealed payload. The old build's save fails instead of wiping the journal.
-- auth.uid() is null for the dashboard and service role, which stay free to
-- repair a row by hand.
--
-- Apply BEFORE the app update that seals journals goes out.
--
-- Rollback:
--   drop trigger keep_journal_sealed on public.agent_progress;
--   drop function private.keep_journal_sealed();

create schema if not exists private;

create or replace function private.keep_journal_sealed()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if auth.uid() is not null
     and old.agent_slug in ('journal-entries', 'journal-blessings')
     and old.payload ? 'sealed'
     and not (new.payload ? 'sealed') then
    raise exception 'This journal is encrypted. Update Nepsis to change it.'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists keep_journal_sealed on public.agent_progress;
create trigger keep_journal_sealed
  before update on public.agent_progress
  for each row execute function private.keep_journal_sealed();
