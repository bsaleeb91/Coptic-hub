-- Five-question feedback survey.
--
-- Separate from app_feedback, which is the always-available "something is
-- broken, let me tell you now" channel. This is a periodic, answer-once read
-- across everyone: countable, comparable over time, and prompted rather than
-- sought out.
--
-- ANONYMOUS BY DESIGN. There is no user_id column, and there is deliberately
-- no way to add one later without a migration that says so out loud. Question
-- 5 asks whether a member withholds things from the app because they are
-- unsure who can see them — nobody signs their name to that, and the same is
-- true of admitting they ignore the canon entirely. Attributed answers to
-- those questions would be worse than no answers, because they would look
-- like data while being systematically false.
--
-- The cost is accepted: no follow-up on a specific reply, and no correlating
-- answers with real usage. Repeat submissions are prevented on-device, which
-- is a soft guarantee — the alternative is identity, which is the thing being
-- given up on purpose.

create table if not exists public.feedback_survey (
  id uuid primary key default gen_random_uuid(),

  -- Q1 · How often do you use Nepsis?
  frequency     text check (frequency in ('daily', 'weekly_several', 'weekly', 'rarely')),

  -- Q2 · Has Nepsis helped you keep your canon more consistently?
  -- 'no_canon' is the sharp answer: it counts members who ignore the feature
  -- the app is built around.
  consistency   text check (consistency in ('yes_clearly', 'a_little', 'no_change', 'no_canon')),

  -- Q3 · Which part would you miss most? Forced single choice — "which do you
  -- use" is over-reported, "which would you miss" finds the centre of gravity.
  most_missed   text check (most_missed in
                  ('canon', 'confession', 'psalms', 'prayer', 'journal', 'appointments')),

  -- Q4 · The one thing you would add or change.
  one_change    text,

  -- Q5 · Do you hold things back because you are unsure who can see them?
  withholding        boolean,
  withholding_detail text,

  -- Coarse context only. No church and no user id: in a small parish, church
  -- plus role would identify a person, which would undo the anonymity above.
  app_version text,
  platform    text,
  role        text,

  created_at timestamptz not null default now()
);

create index if not exists feedback_survey_created_idx on public.feedback_survey (created_at desc);

alter table public.feedback_survey enable row level security;

-- Any signed-in member may submit, and the row carries nothing tying it to
-- them. `with check (true)` is the point rather than an oversight: there is no
-- identity to check against.
drop policy if exists "survey: submit" on public.feedback_survey;
create policy "survey: submit" on public.feedback_survey
  for insert to authenticated
  with check (true);

-- Only admins read. No member-read policy: a member cannot retrieve their own
-- submission, because nothing records that it was theirs.
drop policy if exists "survey: admin reads all" on public.feedback_survey;
create policy "survey: admin reads all" on public.feedback_survey
  for select to authenticated
  using (public.is_admin());

grant insert, select on table public.feedback_survey to authenticated;
