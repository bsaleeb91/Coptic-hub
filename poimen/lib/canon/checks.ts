// lib/canon/checks.ts
// Spiritual-canon check-offs, persisted on-device and keyed by local calendar
// date, so each day starts clean — and so a day can still be completed after
// the fact. Only ever holding TODAY's checks meant a canon kept faithfully but
// logged after midnight, or during a few days away from the app, was recorded
// as a miss and dragged Spiritual Vitals down. Shared by the Canon tab (reads +
// writes) and the Home "canon today" tile (reads today only).

// Per-user-scoped storage (see lib/storage.ts) — keeps one account's spiritual
// data from bleeding into another's on a shared device.
import { userStorage as AsyncStorage } from '@/lib/storage';
import { localDateStr } from './postpone';

const KEY = 'poimen.canon.checks';

// How far back the Canon tab lets you go: today plus the six days before it.
// Long enough for a week away, short enough that adherence stays a record of
// what happened rather than something rewritten at leisure.
export const BACKFILL_DAYS = 7;

// A day's slack past the window, so a device whose clock shifts doesn't lose
// the day being edited. The adherence record itself lives in history.ts.
const KEEP_DAYS = BACKFILL_DAYS + 1;

type Stored = Record<string, string[]>;   // local YYYY-MM-DD → checked ids

// Tolerate anything on disk. The store used to hold one day as {date, keys};
// that shape is migrated in place rather than dropped, so the day in progress
// survives the upgrade.
function coerce(raw: any): Stored {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const strings = (v: any) => Array.isArray(v) ? v.filter((k: any) => typeof k === 'string') : [];
  if (typeof raw.date === 'string' && Array.isArray(raw.keys)) return { [raw.date]: strings(raw.keys) };
  const out: Stored = {};
  for (const [day, keys] of Object.entries<any>(raw)) {
    if (Array.isArray(keys)) out[day] = strings(keys);
  }
  return out;
}

async function readAll(): Promise<Stored> {
  try { return coerce(JSON.parse((await AsyncStorage.getItem(KEY)) ?? '{}')); }
  catch { return {}; }
}

export async function loadChecks(date = new Date()): Promise<Set<string>> {
  return new Set((await readAll())[localDateStr(date)] ?? []);
}

export async function saveChecks(keys: Set<string>, date = new Date()): Promise<void> {
  try {
    const all = await readAll();
    all[localDateStr(date)] = [...keys];
    const cutoff = localDateStr(new Date(Date.now() - KEEP_DAYS * 86400000));
    for (const d of Object.keys(all)) if (d < cutoff) delete all[d];
    await AsyncStorage.setItem(KEY, JSON.stringify(all));
  } catch {}
}

// The dates the Canon tab offers, in calendar order — oldest first, today last,
// so the strip reads left to right the way a week does.
export function backfillDates(now = new Date()): Date[] {
  const base = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Array.from({ length: BACKFILL_DAYS }, (_, i) => {
    const d = new Date(base);
    d.setDate(base.getDate() - (BACKFILL_DAYS - 1 - i));
    return d;
  });
}

export const isSameDay = (a: Date, b: Date) => localDateStr(a) === localDateStr(b);

// Today's checks — what the Home tile shows.
export const loadTodayChecks = () => loadChecks();
export const saveTodayChecks = (keys: Set<string>) => saveChecks(keys);
