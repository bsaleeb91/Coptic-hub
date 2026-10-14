-- ============================================================
-- Migration: remove the priest approval gate — 2026-09-13
--
-- Sign-up granted congregant and servant immediately but held priest
-- as a REQUEST for an admin to approve from the web dashboard
-- (20260719050000_signup_role_selection.sql). That blocked real
-- priests on the day they installed the app, and the queue had no
-- owner watching it.
--
-- The gate is removed, not replaced, because it was never what kept
-- congregants' data safe. Access is gated on the FOC LINK, which the
-- congregant initiates and consents to:
--
--   "priest sees flock"    foc_id = auth.uid() and role in (priest, admin)
--   FOC data policies      foc_id = auth.uid() and foc_consent_at is not null
--
-- None of those consult the priest role on its own, so a self-declared
-- priest sees exactly nothing until a member enters their invite code
-- and taps LINK. Self-declaration now grants a title, not access.
--
-- What this does NOT change, deliberately:
--   • the restrictive "role change is admin only" policy stays — it is
--     what stops a client PATCHing itself to admin, and is unrelated
--     to the approval queue.
--   • profiles.requested_role stays as a column. It is written by
--     nothing after this and is pinned by that same restrictive
--     policy; dropping it would mean rewriting the policy for no gain.
--
-- Safe to re-run.
-- ============================================================


-- ── 1. Grant the role at sign-up ─────────────────────────────
-- All three choices are now applied directly. Anything missing or
-- unknown (e.g. dashboard "Add user") still falls back to congregant,
-- so an absent choice can never grant more than the safest role.

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  req text := lower(trim(coalesce(new.raw_user_meta_data->>'requested_role', '')));
begin
  if req not in ('congregant', 'servant', 'priest') then
    req := 'congregant';
  end if;
  insert into public.profiles (id, full_name, role)
  values (new.id, new.raw_user_meta_data->>'full_name', req);
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();


-- ── 2. Settle the accounts still sitting in the queue ────────
-- They asked to be priests under the old rules and were never
-- answered. Under the new rule, asking IS the grant — so honour the
-- request rather than stranding them in a queue whose UI is being
-- deleted below.
--
-- Restricted to role = 'congregant', matching the old approve RPC: a
-- hand-promoted servant or admin carrying a stale flag must not be
-- silently demoted to priest.

-- Reports what it touched. There is no way to inspect this queue from the
-- client (the RPCs are admin-only and are dropped below), so the notice is
-- the record of how many accounts this migration promoted.
do $$
declare
  pending integer;
  promoted integer;
  cleared integer;
begin
  select count(*) into pending
  from public.profiles
  where requested_role = 'priest' and role = 'congregant';

  raise notice 'priest requests pending: %', pending;

  update public.profiles
  set role = 'priest', requested_role = null
  where requested_role = 'priest' and role = 'congregant';
  get diagnostics promoted = row_count;

  -- Any remaining flag belongs to someone already holding a role above
  -- congregant; clear it so nothing reads as pending, without touching role.
  update public.profiles
  set requested_role = null
  where requested_role is not null;
  get diagnostics cleared = row_count;

  raise notice 'promoted to priest: %, stale flags cleared: %', promoted, cleared;
end $$;


-- ── 3. Drop the approval RPCs ────────────────────────────────
-- Dropped rather than left in place: each is security definer and
-- would remain callable by any authenticated client.

drop function if exists public.get_priest_requests();
drop function if exists public.approve_priest_request(uuid);
drop function if exists public.deny_priest_request(uuid);
