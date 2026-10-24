-- Admin activity chart: let the caller pick how many months to show.
--
-- The original get_monthly_activity() is fixed at six months. This adds a
-- one-argument version beside it rather than replacing it, so an admin page
-- deployed before this migration keeps working. The argument has no default
-- on purpose: a default would make a no-argument call ambiguous between the
-- two functions.
--
-- p_months: how many months back, including the current one (1–120).
--           null means all time, starting from the month of the first signup.

create or replace function public.get_monthly_activity(p_months integer)
returns table (
  month text,
  signups bigint,
  prayers bigint,
  confessions bigint,
  canon_completions bigint,
  journal_active bigint
)
language plpgsql stable security definer
set search_path to 'public'
as $$
declare
  first_month timestamptz;
begin
  if not public.is_admin() then raise exception 'Access denied'; end if;

  if p_months is null then
    select date_trunc('month', coalesce(min(created_at), now())) into first_month from profiles;
  else
    first_month := date_trunc('month', now()) - make_interval(months => least(greatest(p_months, 1), 120) - 1);
  end if;

  return query
  with months as (
    select generate_series(first_month, date_trunc('month', now()), '1 month'::interval) as m
  )
  select
    to_char(m, 'Mon YY') as month,
    (select count(*) from profiles            where date_trunc('month', created_at)      = m) as signups,
    (select count(*) from prayer_requests     where date_trunc('month', created_at)      = m) as prayers,
    (select count(*) from pastoral_encounters where encounter_type = 'confession'
                                               and date_trunc('month', encountered_at)   = m) as confessions,
    (select count(*) from canon_completions   where date_trunc('month', completed_on::timestamptz) = m) as canon_completions,
    (select count(*) from agent_progress      where agent_slug = 'journal-entries'
                                               and date_trunc('month', updated_at)       = m) as journal_active
  from months
  order by m;
end;
$$;

revoke all on function public.get_monthly_activity(integer) from public, anon;
grant execute on function public.get_monthly_activity(integer) to authenticated;
