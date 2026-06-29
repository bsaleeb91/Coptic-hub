-- ── is_admin() helper ────────────────────────────────────────
-- Security definer so the body can read profiles without triggering
-- RLS recursion when used inside a profiles policy.
create or replace function public.is_admin()
returns boolean language sql security definer stable
set search_path = public as $$
  select exists (
    select 1 from public.profiles where id = auth.uid() and role = 'admin'
  );
$$;

-- ── Churches ──────────────────────────────────────────────────
create table if not exists public.churches (
  id         uuid primary key default uuid_generate_v4(),
  name       text not null,
  address    text,
  created_at timestamptz not null default now()
);

alter table public.churches enable row level security;

create policy "Anyone reads churches" on public.churches
  for select using (true);

create policy "Admin inserts churches" on public.churches
  for insert with check (public.is_admin());

create policy "Admin updates churches" on public.churches
  for update using (public.is_admin());

create policy "Admin deletes churches" on public.churches
  for delete using (public.is_admin());

-- ── Profiles: new columns ─────────────────────────────────────
alter table public.profiles
  add column if not exists church_id uuid references public.churches(id) on delete set null;

alter table public.profiles
  add column if not exists last_seen_at timestamptz;

-- ── Admin reads all profiles ──────────────────────────────────
create policy "Admin reads all profiles" on public.profiles
  for select using (public.is_admin());
