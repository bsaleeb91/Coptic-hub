-- ============================================================
-- Migration: Profile photos — 2026-07-27
--
-- Two kinds of photos, one public "avatars" storage bucket:
--
--   self/<user_id>.jpg          A member's own profile picture. Referenced in
--                               profiles.avatar_url; visible to the member and
--                               (through the existing flock/class reads) to
--                               their priest and servant.
--
--   flock/<owner_id>/<subject>  A photo a priest or servant took/uploaded for
--                               a member of their flock/class who has no
--                               picture of their own. Tracked in member_photos
--                               with owner-only RLS, so it shows ONLY in that
--                               shepherd's views — never in the member's own
--                               account (they hold no row they can read).
--
-- The bucket is public (unguessable uuid paths); write access is restricted
-- by path prefix so users can only touch their own objects.
-- ============================================================

-- ── Shepherd-set member photos ──────────────────────────────
create table if not exists public.member_photos (
  subject_id uuid not null references auth.users(id) on delete cascade,
  owner_id   uuid not null references auth.users(id) on delete cascade,
  url        text not null,
  updated_at timestamptz not null default now(),
  primary key (subject_id, owner_id)
);
alter table public.member_photos enable row level security;

-- Only the shepherd who set a photo can see or manage it, and only for
-- members actually linked to them (FOC or servant). No member-facing policy
-- exists on purpose: the subject cannot read rows about themselves.
drop policy if exists "member photos: owner manages" on public.member_photos;
create policy "member photos: owner manages" on public.member_photos
  for all using (owner_id = auth.uid())
  with check (
    owner_id = auth.uid()
    and exists (
      select 1 from public.profiles p
      where p.id = member_photos.subject_id
        and (p.foc_id = auth.uid() or p.servant_id = auth.uid())
    )
  );

-- ── Storage bucket + object policies ────────────────────────
insert into storage.buckets (id, name, public)
  values ('avatars', 'avatars', true)
  on conflict (id) do update set public = true;

-- Own avatar: exactly self/<uid>.jpg
drop policy if exists "avatars: self insert" on storage.objects;
create policy "avatars: self insert" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'avatars' and name = 'self/' || auth.uid()::text || '.jpg');

drop policy if exists "avatars: self update" on storage.objects;
create policy "avatars: self update" on storage.objects
  for update to authenticated
  using (bucket_id = 'avatars' and name = 'self/' || auth.uid()::text || '.jpg')
  with check (bucket_id = 'avatars' and name = 'self/' || auth.uid()::text || '.jpg');

drop policy if exists "avatars: self delete" on storage.objects;
create policy "avatars: self delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'avatars' and name = 'self/' || auth.uid()::text || '.jpg');

-- Shepherd photos: anything under flock/<uid>/, but only for actual shepherds
-- (priest/servant/admin) — otherwise any account could use its flock/ prefix
-- as free public file hosting. Note the object FILENAMES carry a random token
-- (lib/avatar.ts newFlockPhotoPath): the subject knows their own and their
-- shepherd's uuids, so a fixed name would make the "hidden from the member"
-- photo URL guessable; with the token the URL exists only in the owner-only
-- member_photos row.
create or replace function public.is_shepherd()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('priest', 'servant', 'admin')
  )
$$;

drop policy if exists "avatars: shepherd insert" on storage.objects;
create policy "avatars: shepherd insert" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'avatars' and name like 'flock/' || auth.uid()::text || '/%' and public.is_shepherd());

drop policy if exists "avatars: shepherd update" on storage.objects;
create policy "avatars: shepherd update" on storage.objects
  for update to authenticated
  using (bucket_id = 'avatars' and name like 'flock/' || auth.uid()::text || '/%' and public.is_shepherd())
  with check (bucket_id = 'avatars' and name like 'flock/' || auth.uid()::text || '/%' and public.is_shepherd());

drop policy if exists "avatars: shepherd delete" on storage.objects;
create policy "avatars: shepherd delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'avatars' and name like 'flock/' || auth.uid()::text || '/%' and public.is_shepherd());

-- Reads: the bucket is public (served via public URL); this covers API reads.
drop policy if exists "avatars: authenticated read" on storage.objects;
create policy "avatars: authenticated read" on storage.objects
  for select to authenticated
  using (bucket_id = 'avatars');
