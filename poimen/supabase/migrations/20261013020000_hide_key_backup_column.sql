-- ============================================================
-- Hide profiles.key_backup from API reads — 2026-10-13
--
-- Step 2 of 2. Requires 20261013010000_get_my_key_backup.sql, and an app build
-- that reads its backup through get_my_key_backup(). See that file for why.
--
-- A column-level REVOKE does nothing while the role still holds table-level
-- SELECT, so this withdraws SELECT on the table and grants it back column by
-- column, every column except key_backup. Writes are untouched: saving a
-- backup is an UPDATE, which needs SELECT only on the columns it filters by
-- (id), not on key_backup.
--
-- CONSEQUENCE FOR FUTURE MIGRATIONS: a column added to profiles after this is
-- NOT readable through the API until it is granted explicitly:
--   grant select (new_column) on public.profiles to anon, authenticated;
-- ============================================================

do $$
declare
  cols text;
begin
  select string_agg(quote_ident(column_name), ', ' order by ordinal_position)
    into cols
    from information_schema.columns
   where table_schema = 'public'
     and table_name   = 'profiles'
     and column_name <> 'key_backup';

  revoke select on public.profiles from anon, authenticated;
  execute format('grant select (%s) on public.profiles to anon, authenticated', cols);
end $$;
