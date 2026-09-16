-- ============================================================
-- Push notifications — 2026-09-15
--
-- The app already sends LOCAL notifications for the daily canon and psalm
-- reminders (lib/reminders/*), scheduled on the device from data the device
-- holds. Those stay exactly as they are. This adds the other half: the things
-- the phone cannot know, because they happen on the server while it sleeps —
-- a priest confirming an appointment, a canon being assigned.
--
-- THE RULE GOVERNING EVERYTHING BELOW: the server never tells you something
-- the phone would contradict. A push saying "you haven't done your canon" to
-- someone who prayed the Third Hour at 6am is not a small bug — it is wrong,
-- it is accusatory, and it is about their spiritual life. So the server only
-- speaks where it genuinely knows better, and where it does not, it stays
-- quiet and leaves the job to the phone.
--
-- Transport is Expo Push (one endpoint for APNs and FCM). Nothing here calls
-- it: rows queue in notification_outbox and an Edge Function drains them.
-- Sending from inside a trigger would put an HTTP call in a transaction, with
-- nowhere to retry from and nowhere to look when it fails.
-- ============================================================


-- ─── push_tokens ──────────────────────────────────────────────────────────────
-- One row per device. A member with a phone and an iPad should have both ring,
-- so this is not a column on profiles.

create table if not exists public.push_tokens (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.profiles(id) on delete cascade,

  -- "ExponentPushToken[...]" — issued by Expo, rotates on reinstall.
  expo_token   text not null unique,

  platform     text not null check (platform in ('ios', 'android')),

  -- Shown in the app's settings so a member can tell which device is which
  -- before revoking one. Cosmetic; never used for targeting.
  device_label text,

  created_at   timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),

  -- Set when Expo reports DeviceNotRegistered: the app was deleted or the
  -- token rotated. Kept rather than deleted so the worker's receipt handling
  -- is idempotent and so a token is not re-added by a stale client write.
  disabled_at  timestamptz
);

create index if not exists push_tokens_live_idx
  on public.push_tokens (user_id) where disabled_at is null;

alter table public.push_tokens enable row level security;

-- Owner only, in every direction. A push token is a device identifier; no
-- priest, servant or admin has any reason to read one, and a token that could
-- be read by another account could be sent to by them.
drop policy if exists "push_tokens: owner" on public.push_tokens;
create policy "push_tokens: owner" on public.push_tokens
  using (user_id = auth.uid()) with check (user_id = auth.uid());


-- ─── push_prefs ───────────────────────────────────────────────────────────────
-- Reminder preferences have been device-local until now (lib/reminders/store.ts,
-- deliberately so). Push cannot work that way: the server has to know when 8pm
-- is where the member actually is. This is the smallest server-side shape that
-- allows that, and nothing more.

create table if not exists public.push_prefs (
  user_id       uuid primary key references public.profiles(id) on delete cascade,

  -- IANA zone, rewritten by the client on every foreground, so someone who
  -- travels or moves parish is right by their next app open rather than by a
  -- support request.
  timezone      text not null default 'UTC',

  -- Local hour for anything scheduled. Quiet hours are a hard floor around it:
  -- nothing this app has to say is worth waking someone at 3am.
  nudge_hour    int  not null default 20 check (nudge_hour between 0 and 23),
  quiet_from    int  not null default 21 check (quiet_from between 0 and 23),
  quiet_to      int  not null default 7  check (quiet_to   between 0 and 23),

  -- Per-category, and the split is the point. Being told your appointment is
  -- confirmed is a service you asked for by requesting it. Being chased about
  -- your rule is a different thing entirely, and it is opt-in — as the psalm
  -- leaderboard and vitals sharing already are.
  appointments  boolean not null default true,
  assignments   boolean not null default true,
  canon_nudge   boolean not null default false,
  reengagement  boolean not null default false,

  updated_at    timestamptz not null default now()
);

alter table public.push_prefs enable row level security;

drop policy if exists "push_prefs: owner" on public.push_prefs;
create policy "push_prefs: owner" on public.push_prefs
  using (user_id = auth.uid()) with check (user_id = auth.uid());


-- ─── notification_outbox ──────────────────────────────────────────────────────
-- Everything queues here before it is sent. This is what makes retries,
-- de-duplication and debugging possible at all; without it a failed send is
-- simply a notification nobody ever received and nobody can find.

create table if not exists public.notification_outbox (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade,

  kind        text not null
                check (kind in ('appointment', 'assignment', 'canon', 'reengagement')),

  title       text not null,
  body        text not null,

  -- Where a tap should land, read by ReminderSync.tsx: { "route": "/(tabs)/…" }
  data        jsonb not null default '{}'::jsonb,

  -- The one guard against sending the same thing twice, whatever else goes
  -- wrong upstream. Shapes: 'appt:<id>:<status>', 'canon:<user>:<local day>'.
  dedupe_key  text not null unique,

  send_after  timestamptz not null default now(),

  -- After this, the row is dropped unsent rather than delivered late. If cron
  -- stalls for three hours, an 8pm canon nudge must NOT arrive at 11pm; an
  -- appointment confirmation is still worth having late, so it gets a much
  -- longer fuse. Set by whoever enqueues.
  expires_at  timestamptz not null default now() + interval '2 hours',

  sent_at     timestamptz,
  attempts    int not null default 0,
  last_error  text,
  created_at  timestamptz not null default now()
);

-- The worker's claim query: unsent, due, unexpired, oldest first.
create index if not exists notification_outbox_pending_idx
  on public.notification_outbox (send_after)
  where sent_at is null;

alter table public.notification_outbox enable row level security;

-- Enabled with NO policies on purpose. Only the service role touches this
-- table: a member has no business reading the queue, and a client that could
-- write to it could send a notification in someone else's name.


-- ─── canon_day_state ──────────────────────────────────────────────────────────
-- COUNTS ONLY. Not which items were done, not which were skipped.
--
-- This exists for exactly one decision: whether a canon nudge would be wrong.
-- "2 of 5 done" answers that. "Skipped Vespers" answers it no better, and is
-- a materially different disclosure — it is the shape of someone's week.
--
-- The Father of Confession does NOT read this. They already see the vitals
-- mirror (agent_progress 'vitals'), which is coarser; this is finer-grained
-- than anything the pastoral relationship currently exposes, and it was added
-- for the scheduler, not for them.

create table if not exists public.canon_day_state (
  user_id    uuid not null references public.profiles(id) on delete cascade,

  -- The member's LOCAL calendar day, as the phone computed it. Not derived
  -- server-side from a timestamp: the phone is the authority on what day it
  -- is for the person holding it.
  day        date not null,

  due_count  int  not null default 0 check (due_count  >= 0),
  done_count int  not null default 0 check (done_count >= 0),
  updated_at timestamptz not null default now(),

  primary key (user_id, day)
);

alter table public.canon_day_state enable row level security;

drop policy if exists "canon_day_state: owner" on public.canon_day_state;
create policy "canon_day_state: owner" on public.canon_day_state
  using (user_id = auth.uid()) with check (user_id = auth.uid());


-- ─── Enqueue helper ───────────────────────────────────────────────────────────
-- Every enqueue path goes through this, so the consent check and the dedupe
-- behaviour live in one place rather than being re-derived per trigger.
--
-- SECURITY DEFINER because notification_outbox has no policies: the caller is
-- a congregant or a priest, and neither can write to it directly.

create or replace function public.enqueue_push(
  p_user_id    uuid,
  p_kind       text,
  p_title      text,
  p_body       text,
  p_data       jsonb,
  p_dedupe_key text,
  p_expires_in interval default interval '2 hours'
) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_allowed boolean;
begin
  -- No prefs row means the member has never set push up, which means there is
  -- no token to send to either. Absent is treated as "not yet", not as "yes".
  select case p_kind
           when 'appointment'  then appointments
           when 'assignment'   then assignments
           when 'canon'        then canon_nudge
           when 'reengagement' then reengagement
         end
    into v_allowed
    from public.push_prefs where user_id = p_user_id;

  if not coalesce(v_allowed, false) then return; end if;

  -- Nothing to ring. Queueing anyway would fill the outbox with rows the
  -- worker can only ever drop.
  if not exists (
    select 1 from public.push_tokens
     where user_id = p_user_id and disabled_at is null
  ) then return; end if;

  insert into public.notification_outbox
    (user_id, kind, title, body, data, dedupe_key, expires_at)
  values
    (p_user_id, p_kind, p_title, p_body, coalesce(p_data, '{}'::jsonb),
     p_dedupe_key, now() + p_expires_in)
  on conflict (dedupe_key) do nothing;
end;
$$;

revoke execute on function public.enqueue_push(uuid, text, text, text, jsonb, text, interval)
  from public, anon, authenticated;


-- ─── Appointments → outbox ────────────────────────────────────────────────────
-- On the TABLE, not inside respond_to_appointment(). The RPC is not the only
-- thing that changes a status: confirming one request auto-declines every
-- other request overlapping that slot (20260723_scheduling.sql), and those
-- members are precisely the ones who would otherwise never be told. A trigger
-- on the table catches every path, including ones written later.

create or replace function public.notify_appointment_change()
returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_tz    text;
  v_when  text;
  v_other text;
begin
  if tg_op = 'UPDATE' and new.status is not distinct from old.status then
    return new;
  end if;

  -- Formatted in the RECIPIENT's zone. A time is the whole content of this
  -- notification; rendering it in the server's zone would make it wrong for
  -- everyone not sitting in UTC. The coalesce is unreachable in practice —
  -- no prefs row means enqueue_push declines anyway — but a wrong time is a
  -- worse failure than no notification, so it is not left to chance.
  select coalesce(timezone, 'UTC') into v_tz
    from public.push_prefs
   where user_id = case when new.status = 'requested' then new.priest_id
                        else new.congregant_id end;

  v_when := to_char(new.starts_at at time zone coalesce(v_tz, 'UTC'),
                    'FMDay FMDD FMMon, FMHH12:MI AM');

  if tg_op = 'INSERT' and new.status = 'requested' then
    -- The priest is the one who has to act, so the request goes to him.
    select coalesce(nullif(trim(full_name), ''), 'A member') into v_other
      from public.profiles where id = new.congregant_id;

    perform public.enqueue_push(
      new.priest_id, 'appointment',
      'New ' || new.type_label || ' request',
      v_other || ' asked for ' || v_when || '.',
      jsonb_build_object('route', '/(priest)/schedule', 'appointment_id', new.id),
      'appt:' || new.id || ':requested',
      interval '7 days');
    return new;
  end if;

  if tg_op = 'UPDATE' and new.status in ('confirmed', 'declined', 'cancelled') then
    select coalesce(nullif(trim(full_name), ''), 'your father') into v_other
      from public.profiles where id = new.priest_id;

    perform public.enqueue_push(
      new.congregant_id, 'appointment',
      case new.status
        when 'confirmed' then 'Your ' || new.type_label || ' is confirmed'
        when 'declined'  then 'Your ' || new.type_label || ' request was declined'
        else                  'Your ' || new.type_label || ' was cancelled'
      end,
      case new.status
        when 'confirmed' then v_when || ' with ' || v_other || '.'
        when 'declined'  then 'Asked for ' || v_when || '. Open the app to pick another time.'
        else                  'Was ' || v_when || '.'
      end,
      jsonb_build_object('route', '/(tabs)/appointments', 'appointment_id', new.id),
      'appt:' || new.id || ':' || new.status,
      -- Worth having late: a member who learns at midnight that Saturday is
      -- confirmed is better served than one who learns nothing.
      interval '3 days');
  end if;

  return new;
end;
$$;

drop trigger if exists appointments_notify on public.appointments;
create trigger appointments_notify
  after insert or update of status on public.appointments
  for each row execute function public.notify_appointment_change();


-- ─── Housekeeping ─────────────────────────────────────────────────────────────
-- The outbox is a queue, not a log. Sent rows are kept a month so a "did that
-- actually send?" question has an answer, then dropped.

create or replace function public.prune_notification_outbox()
returns void
language sql security definer set search_path = public as $$
  delete from public.notification_outbox
   where sent_at is not null and sent_at < now() - interval '30 days';
$$;

revoke execute on function public.prune_notification_outbox() from public, anon, authenticated;
