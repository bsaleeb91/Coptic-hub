-- ============================================================
-- Scheduling the push worker — 2026-09-15
--
-- Steps 6 and 7. Two extensions, one private config row, the sweep that
-- decides who gets a scheduled nudge, and the cron entries that drive both.
--
-- THE SWEEP NEVER SENDS. It only writes to the outbox. Keeping the decision
-- and the delivery apart is what stops a slow or failing Expo call from making
-- a scheduling run take minutes, and it means the rule for "who should be
-- nudged" is readable SQL rather than something buried in a worker.
-- ============================================================

create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;


-- ─── Private config ───────────────────────────────────────────────────────────
-- The worker's URL and shared secret. NOT in this file and not in git: the
-- migration creates the table empty, and configure_push_cron() below is called
-- once with the real values.
--
-- It also must not sit in the cron command string — cron.job.command is plain
-- text — so the scheduled statements read from here at execution time instead.

create schema if not exists private;

create table if not exists private.push_config (
  id            int primary key default 1 check (id = 1),
  worker_url    text not null,
  worker_secret text not null,
  anon_key      text not null,
  updated_at    timestamptz not null default now()
);

-- No grants at all. Only the postgres role and SECURITY DEFINER functions owned
-- by it can read this; PostgREST never exposes the private schema.
revoke all on schema private from public, anon, authenticated;
revoke all on private.push_config from public, anon, authenticated;


-- ─── The sweep ────────────────────────────────────────────────────────────────
-- Runs every 15 minutes and asks, per member who has opted in, whether this is
-- their hour and whether there is anything honest to say.
--
-- The canon rule is the careful one. It fires ONLY when this phone has already
-- reported today as unfinished. No row for today means the app has not been
-- opened today, which means the server knows nothing about today — and a
-- server that guesses here tells someone they have missed a rule they may have
-- kept. That case falls through to re-engagement, which is true either way.

create or replace function public.enqueue_scheduled_pushes()
returns int
language plpgsql security definer set search_path = public as $$
declare
  r         record;
  v_queued  int := 0;
  v_left    int;
begin
  for r in
    select p.user_id, p.nudge_hour, p.quiet_from, p.quiet_to,
           p.canon_nudge, p.reengagement,
           (now() at time zone p.timezone)::date             as local_day,
           extract(hour from (now() at time zone p.timezone))::int as local_hour,
           to_char((now() at time zone p.timezone)::date, 'IYYY-IW') as local_week,
           pr.last_seen_at
      from public.push_prefs p
      join public.profiles   pr on pr.id = p.user_id
     where (p.canon_nudge or p.reengagement)
  loop
    -- Their hour, not the server's.
    continue when r.local_hour <> r.nudge_hour;

    -- Quiet hours are a hard floor. The window wraps midnight, hence the OR.
    continue when r.local_hour >= r.quiet_from or r.local_hour < r.quiet_to;

    -- ── Canon ──
    if r.canon_nudge then
      select (c.due_count - c.done_count)
        into v_left
        from public.canon_day_state c
       where c.user_id = r.user_id and c.day = r.local_day;

      -- v_left is null when no row exists: the phone has not reported today.
      if v_left is not null and v_left > 0 then
        perform public.enqueue_push(
          r.user_id, 'canon',
          'Your canon today',
          case when v_left = 1
               then 'One thing is still standing in your rule.'
               else v_left || ' things are still standing in your rule.' end,
          jsonb_build_object('route', '/(tabs)/canon'),
          'canon:' || r.user_id || ':' || r.local_day,
          -- Expires the same evening. A canon nudge that lands tomorrow
          -- morning is about a day that is already over.
          interval '2 hours');
        v_queued := v_queued + 1;
      end if;
    end if;

    -- ── Re-engagement ──
    -- Absence is the one thing only the server can observe, and the only
    -- honest thing to say to someone whose phone has told it nothing. Once a
    -- week at most, by ISO week, so a long absence cannot queue a backlog.
    if r.reengagement
       and r.last_seen_at is not null
       and r.last_seen_at < now() - interval '10 days' then
      perform public.enqueue_push(
        r.user_id, 'reengagement',
        'Still here when you are',
        'It has been a little while. Your canon and your psalms are where you left them.',
        jsonb_build_object('route', '/(tabs)'),
        'reeng:' || r.user_id || ':' || r.local_week,
        interval '12 hours');
      v_queued := v_queued + 1;
    end if;
  end loop;

  return v_queued;
end;
$$;

revoke execute on function public.enqueue_scheduled_pushes() from public, anon, authenticated;


-- ─── Configuration + scheduling ───────────────────────────────────────────────
-- Called once, outside version control, with the real URL and secret. It also
-- (re)creates the cron entries, so rotating the secret is one call rather than
-- a migration.

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
    set worker_url = excluded.worker_url,
        worker_secret = excluded.worker_secret,
        anon_key = excluded.anon_key,
        updated_at = now();

  perform cron.unschedule(jobname)
    from cron.job
   where jobname in ('push-drain', 'push-sweep', 'push-prune');

  -- Drain every minute. The worker returns immediately when the queue is
  -- empty, so the common case costs one cheap round trip.
  perform cron.schedule('push-drain', '* * * * *', $cmd$
    select extensions.net.http_post(
      url     := (select worker_url from private.push_config where id = 1),
      headers := jsonb_build_object(
                   'Content-Type', 'application/json',
                   'Authorization', 'Bearer ' || (select anon_key from private.push_config where id = 1),
                   'X-Push-Worker-Secret', (select worker_secret from private.push_config where id = 1)),
      body    := '{}'::jsonb,
      timeout_milliseconds := 20000);
  $cmd$);

  -- Sweep every 15 minutes. Finer than that buys nothing — the predicate is
  -- keyed to a whole local hour — and coarser risks missing a member whose
  -- hour straddles a run.
  perform cron.schedule('push-sweep', '*/15 * * * *',
    $cmd$ select public.enqueue_scheduled_pushes(); $cmd$);

  perform cron.schedule('push-prune', '17 4 * * *',
    $cmd$ select public.prune_notification_outbox(); $cmd$);
end;
$$;

revoke execute on function public.configure_push_cron(text, text, text)
  from public, anon, authenticated;
