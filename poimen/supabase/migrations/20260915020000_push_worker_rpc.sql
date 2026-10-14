-- ============================================================
-- The SQL surface the push worker needs — 2026-09-15
--
-- 20260915010000 created the outbox and the things that write to it. This adds
-- the four operations that drain it. They are SQL rather than queries in the
-- Edge Function for one reason: claiming work has to be atomic, and PostgREST
-- cannot express SELECT ... FOR UPDATE SKIP LOCKED. Two overlapping worker runs
-- must not both pick up the same row and send it twice.
--
-- Every function here is service-role only. A member has no business draining
-- a queue, and one who could mark rows sent could silence their own
-- notifications — or someone else's.
-- ============================================================


-- ─── Claim ────────────────────────────────────────────────────────────────────
-- Take up to p_limit due rows, stamp an attempt on each, and return them joined
-- to their live device tokens.
--
-- ONE ROW PER TOKEN, not per notification: a member with a phone and an iPad
-- gets two rows for one outbox entry, and both should ring. The worker sends to
-- every row and marks the outbox entry sent once.
--
-- Attempts increments on claim rather than on failure, on purpose. A row that
-- makes the worker crash before it reports anything still counts as tried, so a
-- poison message cannot be retried forever.

create or replace function public.claim_outbox_batch(p_limit int default 100)
returns table (
  outbox_id  uuid,
  user_id    uuid,
  title      text,
  body       text,
  data       jsonb,
  expo_token text
)
language plpgsql security definer set search_path = public as $$
begin
  return query
  with claimed as (
    select o.id
      from public.notification_outbox o
     where o.sent_at is null
       and o.send_after <= now()
       and o.expires_at  > now()
       -- Five attempts is generous for a transient Expo outage and short
       -- enough that a genuinely broken row stops costing anything.
       and o.attempts < 5
     order by o.send_after
     limit greatest(1, least(p_limit, 500))
     for update skip locked
  ),
  bumped as (
    update public.notification_outbox o
       set attempts = o.attempts + 1
      from claimed c
     where o.id = c.id
    returning o.id, o.user_id, o.title, o.body, o.data
  )
  select b.id, b.user_id, b.title, b.body, b.data, t.expo_token
    from bumped b
    join public.push_tokens t
      on t.user_id = b.user_id
     and t.disabled_at is null;
end;
$$;

revoke execute on function public.claim_outbox_batch(int) from public, anon, authenticated;


-- ─── Settle ───────────────────────────────────────────────────────────────────
-- Sent. Idempotent: re-marking a row already sent leaves its original timestamp,
-- so a worker that crashes between sending and reporting cannot rewrite history
-- on its retry.

create or replace function public.mark_outbox_sent(p_ids uuid[])
returns void
language sql security definer set search_path = public as $$
  update public.notification_outbox
     set sent_at = now(), last_error = null
   where id = any(p_ids) and sent_at is null;
$$;

revoke execute on function public.mark_outbox_sent(uuid[]) from public, anon, authenticated;


create or replace function public.record_outbox_error(p_id uuid, p_error text)
returns void
language sql security definer set search_path = public as $$
  update public.notification_outbox
     set last_error = left(coalesce(p_error, 'unknown'), 500)
   where id = p_id and sent_at is null;
$$;

revoke execute on function public.record_outbox_error(uuid, text) from public, anon, authenticated;


-- ─── Retire dead tokens ───────────────────────────────────────────────────────
-- Expo reports DeviceNotRegistered when the app was deleted or the token
-- rotated. Disabled rather than deleted: the client's own upsert clears
-- disabled_at when the same device registers again, and deleting here would
-- race that. Skipping this step entirely is how a push system quietly decays
-- into sending most of its traffic into the void.

create or replace function public.disable_push_tokens(p_tokens text[])
returns void
language sql security definer set search_path = public as $$
  update public.push_tokens
     set disabled_at = now()
   where expo_token = any(p_tokens) and disabled_at is null;
$$;

revoke execute on function public.disable_push_tokens(text[]) from public, anon, authenticated;


-- ─── Housekeeping ─────────────────────────────────────────────────────────────
-- Replaces the version in 20260915010000, which only swept SENT rows. Rows that
-- expired unsent, and rows that exhausted their attempts, are never claimed
-- again and would otherwise sit in the table forever.

create or replace function public.prune_notification_outbox()
returns void
language sql security definer set search_path = public as $$
  delete from public.notification_outbox
   where (sent_at is not null and sent_at   < now() - interval '30 days')
      or (sent_at is null     and expires_at < now() - interval '7 days');
$$;

revoke execute on function public.prune_notification_outbox() from public, anon, authenticated;
