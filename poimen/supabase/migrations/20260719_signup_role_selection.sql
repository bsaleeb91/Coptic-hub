-- ============================================================
-- Migration: role selection at sign-up — 2026-07-19
--
-- Sign-up now lets the user choose congregant / servant / priest.
-- Congregant and servant are granted immediately. Priest is a
-- REQUEST: the account starts as a congregant, the request is
-- recorded in profiles.requested_role, and an admin approves or
-- denies it from the web admin dashboard. The client sends the
-- choice as auth signUp metadata (raw_user_meta_data.requested_role)
-- and the trigger below applies it server-side, so the client can
-- never grant itself priest.
--
-- Safe to re-run (create or replace / if not exists / drop if exists).
-- ============================================================


-- ── 1. Track the requested role ──────────────────────────────

alter table public.profiles
  add column if not exists requested_role text
  check (requested_role in ('congregant', 'servant', 'priest'));


-- ── 2. Apply the choice when the auth user is created ────────
-- congregant / servant → granted directly.
-- priest → role stays 'congregant', requested_role marks it pending.
-- Anything missing/unknown (e.g. dashboard "Add user") → plain congregant.
-- requested_role is stored ONLY for priest requests, so non-null
-- requested_role always means exactly "pending priest request".

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  req text := lower(trim(coalesce(new.raw_user_meta_data->>'requested_role', '')));
begin
  if req not in ('congregant', 'servant', 'priest') then
    req := null;
  end if;
  insert into public.profiles (id, full_name, role, requested_role)
  values (
    new.id,
    new.raw_user_meta_data->>'full_name',
    case when req in ('congregant', 'servant') then req else 'congregant' end,
    case when req = 'priest' then req end
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();


-- ── 3. Admin review of priest requests ───────────────────────
-- security definer so they work regardless of profiles RLS; each
-- gate on is_admin(). Email comes from auth.users so the admin can
-- recognize who is asking.

-- Only confirmed emails appear: the profile row is created before email
-- confirmation, and an unconfirmed address is an identity nobody has
-- proven they control — not something an admin should approve against.

create or replace function public.get_priest_requests()
returns table (id uuid, full_name text, church_name text, email text)
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then
    raise exception 'Access denied';
  end if;
  return query
    select p.id, p.full_name, p.church_name, u.email::text
    from public.profiles p
    join auth.users u on u.id = p.id
    where p.requested_role = 'priest' and p.role <> 'priest'
      and u.email_confirmed_at is not null;
end;
$$;

-- Both actions return the affected row count so the client can tell a
-- real change from a stale no-op (request already handled elsewhere).
-- Approve requires role = 'congregant' (a hand-promoted servant/admin
-- with a stale flag must not be silently demoted to priest) and
-- consumes the request flag, so a later demotion cannot resurface an
-- old request as one-click re-approvable.
-- Dropped first because an earlier revision returned void, and
-- create or replace cannot change a return type.

drop function if exists public.approve_priest_request(uuid);
drop function if exists public.deny_priest_request(uuid);

create or replace function public.approve_priest_request(target uuid)
returns integer language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  if not public.is_admin() then
    raise exception 'Access denied';
  end if;
  update public.profiles
  set role = 'priest', requested_role = null
  where id = target and requested_role = 'priest' and role = 'congregant';
  get diagnostics n = row_count;
  return n;
end;
$$;

create or replace function public.deny_priest_request(target uuid)
returns integer language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  if not public.is_admin() then
    raise exception 'Access denied';
  end if;
  update public.profiles
  set requested_role = null
  where id = target and requested_role = 'priest';
  get diagnostics n = row_count;
  return n;
end;
$$;

revoke execute on function public.get_priest_requests() from public, anon;
revoke execute on function public.approve_priest_request(uuid) from public, anon;
revoke execute on function public.deny_priest_request(uuid) from public, anon;
grant execute on function public.get_priest_requests() to authenticated;
grant execute on function public.approve_priest_request(uuid) to authenticated;
grant execute on function public.deny_priest_request(uuid) to authenticated;


-- ── 4. Make role changes admin-only, permanently ─────────────
-- A RESTRICTIVE policy ANDs with every permissive policy, so no
-- present-or-future permissive policy can let a user write a row
-- whose role differs from their current one. (The live DB has a
-- permissive "own row" FOR ALL policy whose WITH CHECK OR'd around
-- the existing "no role escalation" guard, silently defeating it —
-- including a delete-own-row-then-reinsert-as-priest path, which is
-- why this covers ALL commands, not just UPDATE.) requested_role is
-- pinned too: it may only be set by the sign-up trigger and cleared
-- by the admin RPCs, so a denied request cannot be re-asserted via
-- PATCH and the queue cannot be entered outside sign-up. Profile
-- rows are only ever created by the handle_new_user trigger; that
-- and the approval RPCs are unaffected because security definer
-- functions run as the table owner, which bypasses RLS.

create or replace function public.get_my_requested_role()
returns text language sql stable security definer set search_path = public as $$
  select requested_role from public.profiles where id = auth.uid()
$$;

drop policy if exists "role change is admin only" on public.profiles;
create policy "role change is admin only" on public.profiles
  as restrictive for all
  using (true)
  with check (
    (role = public.get_my_role()
     and requested_role is not distinct from public.get_my_requested_role())
    or public.is_admin()
  );

-- Deleting a profiles row is not something the app ever does, and a
-- self-deleted row cannot be recreated under the policy above
-- (get_my_role() returns null), which would brick the account — for
-- admins too. Block ALL client-side deletes; real deletions happen
-- from the dashboard or service role, which bypass RLS.

drop policy if exists "profile delete is admin only" on public.profiles;
create policy "profile delete is admin only" on public.profiles
  as restrictive for delete
  using (false);
