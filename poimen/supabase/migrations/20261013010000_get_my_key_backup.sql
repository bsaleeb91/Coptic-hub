-- ============================================================
-- Own-row key backup reader — 2026-10-13
--
-- Step 1 of 2 in hiding profiles.key_backup from other users. Safe to apply on
-- its own: it adds a function and changes nothing that exists.
--
-- Why: the "priest servant profiles are discoverable" policy lets any signed-in
-- user read whole priest/servant/admin rows, key_backup included. Verified live
-- 2026-10-13: a congregant and an admin account could both read a priest's
-- pinbak1: backup. That backup is the PIN-sealed private key for every note,
-- prayer request and journal entry the priest has, and its PIN key is a single
-- SHA-512 — a 6-digit PIN falls offline in seconds.
--
-- Row security cannot hide one column, so step 2
-- (20261013020000_hide_key_backup_column.sql) withdraws SELECT on the column
-- itself. The app's own read (restoring the key on a new device) then has to
-- come through here instead of a table select.
--
-- Rollout order: apply this, ship an app build that calls it, and only apply
-- step 2 once builds that select key_backup directly are retired — on those
-- builds, step 2 makes new-device key recovery fail.
-- ============================================================

create or replace function public.get_my_key_backup()
returns text
language sql stable security definer set search_path = public as $$
  select key_backup from public.profiles where id = auth.uid();
$$;

revoke all on function public.get_my_key_backup() from public, anon;
grant execute on function public.get_my_key_backup() to authenticated;
