-- ============================================================
-- Seeing what cron is actually doing — 2026-09-15
--
-- cron.job and cron.job_run_details are not reachable through PostgREST, which
-- means a scheduled job that fails every minute fails invisibly: the only
-- symptom is notifications quietly not arriving. That is the worst possible
-- failure shape for this feature, so this exposes just enough to answer "is
-- the drain running, and what did it say last time".
--
-- Service role only, like everything else in the push path.
-- ============================================================

create or replace function public.push_cron_status()
returns table (
  jobname      text,
  schedule     text,
  active       boolean,
  last_run     timestamptz,
  last_status  text,
  last_message text
)
language sql security definer set search_path = public, cron as $$
  select j.jobname::text,
         j.schedule::text,
         j.active,
         d.start_time,
         d.status::text,
         left(coalesce(d.return_message, ''), 300)
    from cron.job j
    left join lateral (
      select r.start_time, r.status, r.return_message
        from cron.job_run_details r
       where r.jobid = j.jobid
       order by r.start_time desc
       limit 1
    ) d on true
   where j.jobname like 'push-%'
   order by j.jobname;
$$;

revoke execute on function public.push_cron_status() from public, anon, authenticated;
