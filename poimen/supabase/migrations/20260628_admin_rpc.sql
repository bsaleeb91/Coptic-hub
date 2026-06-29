-- ── Admin RPC functions ───────────────────────────────────────
-- All functions are security definer so they bypass RLS and can
-- aggregate across all rows. Each checks is_admin() first so only
-- admin-role users can invoke them. Clients only ever receive
-- aggregate counts — no individual user content is returned.

create or replace function public.get_admin_summary()
returns jsonb language plpgsql security definer stable
set search_path = public as $$
declare result jsonb;
begin
  if not public.is_admin() then raise exception 'Access denied'; end if;
  select jsonb_build_object(
    'total_users',       (select count(*) from profiles),
    'priests',           (select count(*) from profiles where role = 'priest'),
    'servants',          (select count(*) from profiles where role = 'servant'),
    'congregants',       (select count(*) from profiles where role = 'congregant'),
    'active_week',       (select count(*) from profiles where last_seen_at > now() - interval '7 days'),
    'active_month',      (select count(*) from profiles where last_seen_at > now() - interval '30 days'),
    'churches',          (select count(*) from churches),
    'foc_linked',        (select count(*) from profiles where foc_id is not null and role = 'congregant'),
    'total_prayers',     (select count(*) from prayer_requests),
    'answered_prayers',  (select count(*) from prayer_requests where answered = true),
    'total_confessions', (select count(*) from pastoral_encounters where encounter_type = 'confession'),
    'total_encounters',  (select count(*) from pastoral_encounters),
    'active_canons',     (select count(*) from spiritual_canons where active = true),
    'canon_completions', (select count(*) from canon_completions where completed_on >= current_date - 30),
    'journal_users',     (select count(*) from agent_progress where agent_slug = 'journal-entries' and (payload -> 'entries') != '[]'::jsonb),
    'new_this_month',    (select count(*) from profiles where created_at >= date_trunc('month', now())),
    'new_last_month',    (select count(*) from profiles where created_at >= date_trunc('month', now() - interval '1 month') and created_at < date_trunc('month', now()))
  ) into result;
  return result;
end;
$$;

create or replace function public.get_monthly_activity()
returns table(
  month            text,
  signups          bigint,
  prayers          bigint,
  confessions      bigint,
  canon_completions bigint,
  journal_active   bigint
) language plpgsql security definer stable
set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Access denied'; end if;
  return query
  with months as (
    select generate_series(
      date_trunc('month', now() - interval '5 months'),
      date_trunc('month', now()),
      '1 month'::interval
    ) as m
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

create or replace function public.get_church_breakdown()
returns table(
  church_id   uuid,
  church_name text,
  priests     bigint,
  servants    bigint,
  congregants bigint,
  foc_linked  bigint
) language plpgsql security definer stable
set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Access denied'; end if;
  return query
  select
    c.id   as church_id,
    c.name as church_name,
    count(*) filter (where p.role = 'priest')                                 as priests,
    count(*) filter (where p.role = 'servant')                                as servants,
    count(*) filter (where p.role = 'congregant')                             as congregants,
    count(*) filter (where p.role = 'congregant' and p.foc_id is not null)    as foc_linked
  from churches c
  left join profiles p on p.church_id = c.id
  group by c.id, c.name
  order by c.name;
end;
$$;
