-- ============================================================
-- Fix the drain job's function reference — 2026-09-15
--
-- 20260915030000 scheduled the drain as `extensions.net.http_post(...)`, having
-- installed pg_net WITH SCHEMA extensions. Postgres reads a three-part name as
-- database.schema.object, so every run failed with:
--
--   ERROR: cross-database references are not implemented: extensions.net.http_post
--
-- pg_net's functions live in the `net` schema regardless of that clause — the
-- extension was already present, which makes WITH SCHEMA a no-op.
--
-- This failed silently in the only way that matters: cron.job_run_details
-- records it, nothing raises, and the visible symptom is notifications not
-- arriving. push_cron_status() (20260915040000) is what surfaced it, and is
-- why that function is staying.
--
-- Restructured while fixing: scheduling now reads from private.push_config
-- rather than taking arguments, so correcting or rotating a schedule never
-- requires handing the secret around again.
-- ============================================================

create or replace function public.reschedule_push_cron()
returns void
language plpgsql security definer set search_path = public, extensions as $$
begin
  if not exists (select 1 from private.push_config where id = 1) then
    raise exception 'push_config is empty — call configure_push_cron() first';
  end if;

  perform cron.unschedule(jobname)
    from cron.job
   where jobname in ('push-drain', 'push-sweep', 'push-prune');

  perform cron.schedule('push-drain', '* * * * *', $cmd$
    select net.http_post(
      url     := (select worker_url from private.push_config where id = 1),
      headers := jsonb_build_object(
                   'Content-Type', 'application/json',
                   'Authorization', 'Bearer ' || (select anon_key from private.push_config where id = 1),
                   'X-Push-Worker-Secret', (select worker_secret from private.push_config where id = 1)),
      body    := '{}'::jsonb,
      timeout_milliseconds := 20000);
  $cmd$);

  perform cron.schedule('push-sweep', '*/15 * * * *',
    $cmd$ select public.enqueue_scheduled_pushes(); $cmd$);

  perform cron.schedule('push-prune', '17 4 * * *',
    $cmd$ select public.prune_notification_outbox(); $cmd$);
end;
$$;

revoke execute on function public.reschedule_push_cron() from public, anon, authenticated;


-- Store-then-schedule, so the two concerns stay separable.
create or replace function public.configure_push_cron(
  p_worker_url text,
  p_secret     text,
  p_anon_key   text
) returns void
language plpgsql security definer set search_path = public, extensions as $$
begin
  insert into private.push_config (id, worker_url, worker_secret, anon_key, updated_at)
  values (1, p_worker_url, p_secret, p_anon_key, now())
  on conflict (id) do update
    set worker_url    = excluded.worker_url,
        worker_secret = excluded.worker_secret,
        anon_key      = excluded.anon_key,
        updated_at    = now();

  perform public.reschedule_push_cron();
end;
$$;

revoke execute on function public.configure_push_cron(text, text, text)
  from public, anon, authenticated;
