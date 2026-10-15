-- Joining a flock or a class by invite code, checked on the server.
--
-- Until now the app read the code's owner straight out of profiles and then
-- wrote foc_id / servant_id on the member's own row. The code was only ever
-- checked in the app: anyone could set foc_id to any priest's id.
--
-- Two RPCs replace that:
--   lookup_invite_code(code)          who a code belongs to, for the confirm
--                                     screen ("Link to Fr. Mina?")
--   join_by_invite_code(code, kind)   sets foc_id (+ foc_consent_at) or
--                                     servant_id, only if the code matches a
--                                     priest/servant of the right kind
-- Both count wrong codes per caller; ten in an hour and further attempts are
-- refused until the hour passes. Codes are 6 hex characters (~16.7M), so
-- without a limit they could be walked.
--
-- NOT YET ENFORCED: direct writes to foc_id / servant_id still work, because
-- App Store 1.0.0 joins that way and can't be updated. Once 1.0.0 is retired,
-- a follow-up trigger rejects direct writes that don't come through
-- join_by_invite_code (it sets nepsis.via_invite_code for exactly that).
--
-- Rollback:
--   drop function public.join_by_invite_code(text, text);
--   drop function public.lookup_invite_code(text);
--   drop function private.invite_code_owner(text, text);
--   drop table private.invite_code_misses;

create schema if not exists private;

create table if not exists private.invite_code_misses (
  user_id uuid not null,
  at timestamptz not null default now()
);
create index if not exists invite_code_misses_user_at on private.invite_code_misses (user_id, at);

-- Resolve a code to its owner, enforcing the attempt limit. kind is 'foc'
-- (priest or admin) or 'servant' (servant or admin); null accepts either, for
-- the lookup screen, which reports a wrong-kind code in its own words.
create or replace function private.invite_code_owner(p_code text, p_kind text)
returns public.profiles
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  owner public.profiles;
begin
  if me is null then
    raise exception 'sign in first' using errcode = '42501';
  end if;
  if (select count(*) from private.invite_code_misses
       where user_id = me and at > now() - interval '1 hour') >= 10 then
    raise exception 'Too many incorrect codes. Try again in an hour.' using errcode = '54000';
  end if;

  select * into owner from public.profiles p
   where p.invite_code = upper(btrim(p_code))
     and p.role in ('priest', 'servant', 'admin');

  if owner.id is null then
    insert into private.invite_code_misses (user_id) values (me);
    return null;
  end if;
  if p_kind = 'foc' and owner.role not in ('priest', 'admin') then return null; end if;
  if p_kind = 'servant' and owner.role not in ('servant', 'admin') then return null; end if;
  return owner;
end;
$$;

create or replace function public.lookup_invite_code(p_code text)
returns table (id uuid, full_name text, church_name text, role text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  owner public.profiles := private.invite_code_owner(p_code, null);
begin
  if owner.id is null then return; end if;
  return query select owner.id, owner.full_name, owner.church_name, owner.role;
end;
$$;

create or replace function public.join_by_invite_code(p_code text, p_kind text)
returns table (id uuid, full_name text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  owner public.profiles;
begin
  if p_kind not in ('foc', 'servant') then
    raise exception 'kind must be foc or servant' using errcode = '22023';
  end if;
  owner := private.invite_code_owner(p_code, p_kind);
  -- No match returns no row rather than raising: an exception would roll back
  -- the miss invite_code_owner just recorded, and guesses sent straight here
  -- would never count toward the limit.
  if owner.id is null then return; end if;
  if owner.id = me then
    raise exception 'That is your own code.' using errcode = '22023';
  end if;

  -- Marks this write as coming through the code check, for the enforcement
  -- trigger that follows once 1.0.0 is retired.
  perform set_config('nepsis.via_invite_code', 'on', true);
  if p_kind = 'foc' then
    update public.profiles
       set foc_id = owner.id, foc_consent_at = now()
     where profiles.id = me;
  else
    update public.profiles
       set servant_id = owner.id
     where profiles.id = me;
  end if;
  return query select owner.id, owner.full_name;
end;
$$;

revoke all on function private.invite_code_owner(text, text) from public, anon, authenticated;
revoke all on function public.lookup_invite_code(text) from public, anon;
revoke all on function public.join_by_invite_code(text, text) from public, anon;
grant execute on function public.lookup_invite_code(text) to authenticated;
grant execute on function public.join_by_invite_code(text, text) to authenticated;
