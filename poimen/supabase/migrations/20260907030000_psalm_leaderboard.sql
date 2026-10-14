-- Class-scoped psalm leaderboard.
--
-- Psalm stats are currently visible to exactly two people, each behind its own
-- consent: the member's Father of Confession and their assigned servant
-- (20260713020000_psalm_stats_sharing.sql). A leaderboard shows members to EACH
-- OTHER, which is a materially larger disclosure than anything else the app
-- does — the canon tab tells members outright that their rule "stays private to
-- you".
--
-- So it gets its OWN consent, defaulting to off, and never borrows
-- vitals_consent. That flag was agreed for one priest; reading it as agreement
-- to be ranked in front of classmates would be a bait-and-switch, and the
-- members most harmed by it are the least likely to go looking for a setting.
--
-- Scope is one servant's class: the smallest circle, and one where the members
-- already know each other from Sunday school.

alter table public.profiles
  add column if not exists psalm_leaderboard_consent boolean not null default false;


-- Names are reduced to "First L." rather than passed through whole. Classmates
-- know each other, so a first name identifies plenty; a full name is more than
-- the feature needs, and this is children's data.
create or replace function public.short_display_name(full_name text)
returns text language sql immutable as $$
  select case
    when coalesce(trim(full_name), '') = '' then 'Someone'
    when array_length(regexp_split_to_array(trim(full_name), '\s+'), 1) = 1
      then initcap(trim(full_name))
    else initcap(split_part(trim(full_name), ' ', 1)) || ' ' ||
         upper(left(split_part(trim(full_name), ' ',
           array_length(regexp_split_to_array(trim(full_name), '\s+'), 1)), 1)) || '.'
  end;
$$;


-- The board for whoever is asking.
--
-- SECURITY DEFINER because a member cannot read another member's profile or
-- agent_progress row directly, and must not gain the ability to — the function
-- returns an aggregate, never a queryable surface. Every branch below is a
-- deliberate limit:
--
--   * A congregant sees their own class only, and ONLY IF they have opted in
--     themselves. Watching without being watched is not on offer; a leaderboard
--     you can lurk on is a different, worse feature.
--   * A servant sees their own class without opting in, because they are the
--     teacher and are never ranked in it.
--   * Members who have not opted in are absent — not greyed out, not counted.
--   * A member with no servant has no class, and gets no rows.
create or replace function public.psalm_leaderboard()
returns table (
  user_id       uuid,
  display_name  text,
  streak        int,
  longest       int,
  mastered      int,
  is_self       boolean
)
language plpgsql security definer set search_path = public as $$
declare
  me         uuid := auth.uid();
  my_role    text;
  class_key  uuid;
  opted_in   boolean;
begin
  if me is null then return; end if;

  select role, servant_id, psalm_leaderboard_consent
    into my_role, class_key, opted_in
    from profiles where id = me;

  if my_role = 'servant' then
    class_key := me;               -- a servant's class is the one they lead
  elsif not coalesce(opted_in, false) then
    return;                        -- opting in is what buys you the view
  end if;

  if class_key is null then return; end if;   -- no servant, no class

  return query
    select p.id,
           short_display_name(p.full_name),
           coalesce((ap.payload->>'streak')::int, 0),
           coalesce((ap.payload->>'longestStreak')::int, 0),
           coalesce((ap.payload->>'masteredItems')::int, 0),
           p.id = me
      from profiles p
      join agent_progress ap
        on ap.user_id = p.id and ap.agent_slug = 'psalm-stats'
     where p.servant_id = class_key
       and p.psalm_leaderboard_consent = true
     order by 3 desc, 5 desc, 2 asc;
end;
$$;

revoke execute on function public.psalm_leaderboard() from public, anon;
grant  execute on function public.psalm_leaderboard() to authenticated;
