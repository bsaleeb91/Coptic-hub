// supabase/functions/push-worker/index.ts
// Drains notification_outbox and sends through Expo Push.
//
// The first server-side code in this project. It does one thing on each run:
// claim a batch of due notifications, send them, and record what happened.
// Everything that decides WHAT to send lives in SQL (the appointments trigger
// today, the scheduled sweep later); this only carries messages.
//
// No supabase-js. Four RPC calls and one HTTP POST do not need a client
// library, and a worker with no dependencies has no cold-start install and
// nothing to keep current.
//
// AUTH: two gates, and the second one matters.
//
// The platform's JWT check is the first, but it accepts the ANON key — which
// ships inside the app and is known to every member and anyone who unpacks the
// bundle. On its own that would let anyone force a drain at will, and repeated
// forced runs would burn each row's attempt budget until real notifications
// stopped going out: a denial-of-notification, not merely a nuisance.
//
// So the second gate is a shared secret this project owns, sent as
// X-Push-Worker-Secret. It is deliberately NOT a comparison against
// SUPABASE_SERVICE_ROLE_KEY: Supabase is mid-migration from legacy JWT keys to
// the sb_secret_ format, the runtime injects one of them and the API hands out
// the other, and a guard that silently depends on which is which is a guard
// that will fail on a platform change nobody here made. This secret has one
// producer and one consumer.

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const EXPO_TOKEN   = Deno.env.get('EXPO_ACCESS_TOKEN') ?? '';
const WORKER_SECRET = Deno.env.get('PUSH_WORKER_SECRET') ?? '';

const EXPO_SEND_URL = 'https://exp.host/--/api/v2/push/send';

// Expo's documented cap per request. Exceeding it fails the whole batch rather
// than truncating, so this is a hard limit, not a tuning knob.
const EXPO_BATCH = 100;

// How many outbox rows to claim per run. One row can fan out to several
// devices, so the number of Expo messages is >= this.
const CLAIM_LIMIT = 100;

interface ClaimedRow {
  outbox_id: string;
  user_id: string;
  title: string;
  body: string;
  data: Record<string, unknown> | null;
  expo_token: string;
}

// Expo returns one ticket per message, in the order sent.
type Ticket =
  | { status: 'ok'; id: string }
  | { status: 'error'; message: string; details?: { error?: string } };

async function rpc<T>(fn: string, body: Record<string, unknown>): Promise<T> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, {
    method: 'POST',
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`rpc ${fn} → ${res.status} ${await res.text()}`);
  const text = await res.text();
  return (text ? JSON.parse(text) : null) as T;
}

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  // An unset secret fails closed. A worker that drains the queue for anyone
  // who asks is worse than one that drains it for no one.
  const presented = req.headers.get('X-Push-Worker-Secret') ?? '';
  if (!WORKER_SECRET || presented !== WORKER_SECRET) {
    return new Response('Forbidden', { status: 403 });
  }

  try {
    const claimed = await rpc<ClaimedRow[]>('claim_outbox_batch', { p_limit: CLAIM_LIMIT });
    if (!claimed || claimed.length === 0) {
      return Response.json({ claimed: 0, sent: 0, failed: 0, retired: 0 });
    }

    // Per outbox row, whether ANY of its devices accepted the message. A member
    // with a live phone and a dead iPad has been notified; the row is done.
    const anyDelivered = new Map<string, boolean>();
    for (const r of claimed) if (!anyDelivered.has(r.outbox_id)) anyDelivered.set(r.outbox_id, false);

    const deadTokens = new Set<string>();
    const errorFor = new Map<string, string>();

    for (const batch of chunk(claimed, EXPO_BATCH)) {
      const messages = batch.map((r) => ({
        to: r.expo_token,
        title: r.title,
        body: r.body,
        data: r.data ?? {},
        // Silent on purpose. These arrive in the evening, and a rule is not an
        // alarm — the banner is the message, the sound would be an intrusion.
        sound: null,
        priority: 'normal',
      }));

      let tickets: Ticket[] = [];
      try {
        const res = await fetch(EXPO_SEND_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
            // Sent whether or not the account requires it. When Enhanced
            // Security is on, this is the only thing standing between a leaked
            // device token and anyone sending to that member.
            ...(EXPO_TOKEN ? { Authorization: `Bearer ${EXPO_TOKEN}` } : {}),
          },
          body: JSON.stringify(messages),
        });

        const payload = await res.json().catch(() => null);

        if (!res.ok) {
          // A whole-batch rejection — bad token, malformed body, Expo down.
          // Every row stays unsent and is retried on the next run, up to the
          // attempts ceiling in claim_outbox_batch.
          const detail = `expo ${res.status}: ${JSON.stringify(payload)?.slice(0, 300)}`;
          for (const r of batch) errorFor.set(r.outbox_id, detail);
          continue;
        }
        tickets = payload?.data ?? [];
      } catch (e) {
        const detail = `expo request failed: ${e instanceof Error ? e.message : String(e)}`;
        for (const r of batch) errorFor.set(r.outbox_id, detail);
        continue;
      }

      // Tickets come back positionally, so index i belongs to batch[i].
      batch.forEach((row, i) => {
        const t = tickets[i];
        if (!t) { errorFor.set(row.outbox_id, 'no ticket returned'); return; }
        if (t.status === 'ok') { anyDelivered.set(row.outbox_id, true); return; }

        // The app was deleted, or the token rotated. Retire it — a token kept
        // alive after this is queue that can never be delivered.
        if (t.details?.error === 'DeviceNotRegistered') deadTokens.add(row.expo_token);
        errorFor.set(row.outbox_id, `${t.details?.error ?? 'error'}: ${t.message}`);
      });
    }

    const sentIds = [...anyDelivered.entries()].filter(([, ok]) => ok).map(([id]) => id);
    const failedIds = [...anyDelivered.entries()].filter(([, ok]) => !ok).map(([id]) => id);

    if (sentIds.length) await rpc('mark_outbox_sent', { p_ids: sentIds });
    if (deadTokens.size) await rpc('disable_push_tokens', { p_tokens: [...deadTokens] });

    // Errors are recorded only on rows that delivered nowhere. A row that
    // reached one of two devices is sent, and its iPad's failure is already
    // captured by retiring that token.
    for (const id of failedIds) {
      await rpc('record_outbox_error', { p_id: id, p_error: errorFor.get(id) ?? 'unknown' });
    }

    return Response.json({
      claimed: anyDelivered.size,
      messages: claimed.length,
      sent: sentIds.length,
      failed: failedIds.length,
      retired: deadTokens.size,
    });
  } catch (e) {
    // A failure here leaves every claimed row unsent with its attempt counted,
    // so the next run picks them up rather than losing them.
    return Response.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
});
