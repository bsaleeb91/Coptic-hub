-- FOC / servant linking via invite codes.
-- Priests and servants get a permanent 6-char code.
-- Congregants enter the code to link themselves.

-- ── 1. Add invite_code column ────────────────────────────────
alter table public.profiles
  add column if not exists invite_code text unique;

-- ── 2. Generate codes for existing priests/servants ──────────
update public.profiles
set invite_code = upper(substring(replace(gen_random_uuid()::text, '-', ''), 1, 6))
where role in ('priest', 'servant', 'admin') and invite_code is null;

-- ── 3. Auto-generate code when a priest/servant is created or role is set ──
create or replace function public.ensure_invite_code()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.role in ('priest', 'servant', 'admin') and new.invite_code is null then
    new.invite_code := upper(substring(replace(gen_random_uuid()::text, '-', ''), 1, 6));
  end if;
  return new;
end;
$$;

drop trigger if exists on_profile_ensure_invite_code on public.profiles;
create trigger on_profile_ensure_invite_code
  before insert or update on public.profiles
  for each row execute procedure public.ensure_invite_code();

-- ── 4. Allow any authenticated user to look up a priest/servant profile ──
-- Priests and servants are church leaders — their names and codes are not private.
-- This is required so a congregant can resolve a code to a priest UUID.
create policy "priest servant profiles are discoverable" on public.profiles
  for select using (role in ('priest', 'servant', 'admin'));
