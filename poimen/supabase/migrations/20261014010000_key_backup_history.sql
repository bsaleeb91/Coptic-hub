-- ============================================================
-- Keep every replaced key backup — 2026-10-14
--
-- App Store 1.0.0 (build 17) reads key_backup with a plain select, which
-- 20261013020000 now denies. That build takes the denial as "no backup", and
-- on a device without the key (reinstall, new phone) it mints a new keypair
-- and saves its backup OVER the real one — leaving everything the old key
-- sealed unreadable. Build 17 has no expo-updates, so no OTA can fix it; only
-- a new App Store build can.
--
-- Until then, nothing is lost for good: whenever a backup is replaced, the old
-- one is copied here first. The member's original PIN still opens it, so an
-- overwrite can be undone by putting the old value back in profiles.key_backup.
--
-- Lives in `private`, which the API does not expose, and is revoked from the
-- API roles besides. Rows go with the profile (on delete cascade): a deleted
-- account's sealed key should not outlive it.
-- ============================================================

create schema if not exists private;

create table if not exists private.key_backup_history (
  id           bigint generated always as identity primary key,
  user_id      uuid not null references public.profiles(id) on delete cascade,
  old_backup   text not null,
  old_public_key text,
  replaced_at  timestamptz not null default now()
);

create index if not exists key_backup_history_user_idx
  on private.key_backup_history (user_id, replaced_at desc);

revoke all on private.key_backup_history from public, anon, authenticated;
-- Belt and braces: no policies, so API roles see nothing even if a grant
-- slipped back. The trigger function runs as the table owner, which RLS
-- does not restrict, so the copy still lands.
alter table private.key_backup_history enable row level security;

create or replace function private.keep_replaced_key_backup()
returns trigger
language plpgsql security definer set search_path = private, public as $$
begin
  if old.key_backup is not null and new.key_backup is distinct from old.key_backup then
    insert into private.key_backup_history (user_id, old_backup, old_public_key)
    values (old.id, old.key_backup, old.public_key);
  end if;
  return new;
end $$;

revoke all on function private.keep_replaced_key_backup() from public, anon, authenticated;

drop trigger if exists keep_replaced_key_backup on public.profiles;
create trigger keep_replaced_key_backup
  before update of key_backup on public.profiles
  for each row execute function private.keep_replaced_key_backup();
