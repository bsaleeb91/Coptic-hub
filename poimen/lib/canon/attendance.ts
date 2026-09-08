// lib/canon/attendance.ts
// Ad-hoc attendance: a church service or Holy Communion logged on a day the
// member's rule didn't ask for it.
//
// Without this, a vital could only be tracked if it had first been committed
// to — liturgy showed up on the Canon tab only on the weekday the rule pinned
// it to (or as a weekly count), so attending an unscheduled liturgy, or
// receiving communion when no rule mentioned it, was simply unloggable. That
// broke the rule this card is meant to keep: anything in Spiritual Vitals has
// to be trackable in the Canon.
//
// Logged entries reuse the `svc_<key>` item key, so they flow through
// recordCanonDay and VITAL_CATEGORIES exactly like a committed service, and
// merge silently with a rule item for the same service on the same day.

// Per-user-scoped storage (see lib/storage.ts) — keeps one account's spiritual
// data from bleeding into another's on a shared device.
import { userStorage as AsyncStorage } from '@/lib/storage';
import { localDateStr } from './postpone';
import { SERVICES } from './rule-store';

const KEY = 'poimen.canon.attendance';

// Matches the canon history window, so a logged attendance lives exactly as
// long as the adherence record that counts it.
const KEEP_DAYS = 366;

type Stored = Record<string, string[]>;   // local YYYY-MM-DD → service keys

const known = (k: unknown): k is string =>
  typeof k === 'string' && SERVICES.some(s => s.key === k);

function coerce(raw: any): Stored {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const out: Stored = {};
  for (const [day, keys] of Object.entries<any>(raw)) {
    if (Array.isArray(keys)) {
      const clean = [...new Set(keys.filter(known))];
      if (clean.length) out[day] = clean;
    }
  }
  return out;
}

async function readAll(): Promise<Stored> {
  try { return coerce(JSON.parse((await AsyncStorage.getItem(KEY)) ?? '{}')); }
  catch { return {}; }
}

async function writeAll(all: Stored): Promise<void> {
  try {
    const cutoff = localDateStr(new Date(Date.now() - KEEP_DAYS * 86400000));
    for (const d of Object.keys(all)) if (d < cutoff || !all[d].length) delete all[d];
    await AsyncStorage.setItem(KEY, JSON.stringify(all));
  } catch {}
}

// Service keys logged ad-hoc on `date`.
export async function loadAttendance(date = new Date()): Promise<string[]> {
  return (await readAll())[localDateStr(date)] ?? [];
}

export async function loadAllAttendance(): Promise<Stored> {
  return readAll();
}

export async function logAttendanceOn(serviceKey: string, date = new Date()): Promise<void> {
  if (!known(serviceKey)) return;
  const all = await readAll();
  const day = localDateStr(date);
  const list = all[day] ?? [];
  if (!list.includes(serviceKey)) all[day] = [...list, serviceKey];
  await writeAll(all);
}

export async function unlogAttendanceOn(serviceKey: string, date = new Date()): Promise<void> {
  const all = await readAll();
  const day = localDateStr(date);
  all[day] = (all[day] ?? []).filter(k => k !== serviceKey);
  await writeAll(all);
}
