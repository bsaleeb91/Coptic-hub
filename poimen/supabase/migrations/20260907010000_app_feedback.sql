-- In-app feedback.
--
-- There has been no way to tell us anything from inside the app: the only
-- contact route is an email address buried at the bottom of the privacy
-- policy, which means the people most likely to hit a problem are the least
-- likely to report it.
--
-- Feedback is deliberately NOT visible to priests or servants. A member
-- reporting that something is broken, or that they dislike a feature their
-- Father of Confession assigned, must be able to say so without it appearing
-- in the pastoral relationship. Only admins read this table.

create table if not exists public.app_feedback (
  id          uuid primary key default gen_random_uuid(),

  -- Nulled rather than cascaded when an account is deleted: the report stays
  -- useful ("the canon tab crashed on save") after the reporter is gone, and
  -- nulling is what makes it anonymous at that point.
  user_id     uuid references public.profiles(id) on delete set null,

  category    text not null default 'other'
                check (category in ('bug', 'idea', 'other')),
  message     text not null check (length(trim(message)) > 0),

  -- Captured automatically and shown to the member before they send, so
  -- "what am I attaching" is never a guess. Role is stored as text rather
  -- than read through the profile at display time, so a report keeps the
  -- context it had when it was written.
  app_version text,
  platform    text,
  role        text,

  -- Admin triage. 'new' until someone looks at it.
  status      text not null default 'new'
                check (status in ('new', 'read', 'resolved')),

  created_at  timestamptz not null default now()
);

create index if not exists app_feedback_status_idx  on public.app_feedback (status, created_at desc);
create index if not exists app_feedback_user_idx    on public.app_feedback (user_id);

alter table public.app_feedback enable row level security;

-- Anyone signed in may send feedback, but only as themselves — user_id is
-- checked against the caller so a report cannot be attributed to someone else.
drop policy if exists "feedback: insert own" on public.app_feedback;
create policy "feedback: insert own" on public.app_feedback
  for insert to authenticated
  with check (auth.uid() = user_id);

-- A member can see what they sent, and nothing else. No update or delete
-- policy for members: an already-sent report should not be quietly rewritten.
drop policy if exists "feedback: read own" on public.app_feedback;
create policy "feedback: read own" on public.app_feedback
  for select to authenticated
  using (auth.uid() = user_id);

-- Admins read everything and may move status along. is_admin() is the same
-- gate the rest of the admin surface uses.
drop policy if exists "feedback: admin reads all" on public.app_feedback;
create policy "feedback: admin reads all" on public.app_feedback
  for select to authenticated
  using (public.is_admin());

drop policy if exists "feedback: admin updates status" on public.app_feedback;
create policy "feedback: admin updates status" on public.app_feedback
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

grant select, insert on table public.app_feedback to authenticated;
grant update (status)   on table public.app_feedback to authenticated;
