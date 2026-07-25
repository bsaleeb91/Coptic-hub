// lib/canon/postpone.ts
// Heart of Service postponements. A service that is due can be deferred from
// the Canon tab instead of checked off; it disappears until the chosen date
// (kept on the item's weekday) and reappears exactly that day — overriding its
// normal frequency — after which the regular schedule resumes.
// Stored on-device, keyed by the rule-item key (serve_<weekday>_<index>) →
// local YYYY-MM-DD date the item returns.

// Per-user-scoped storage (see lib/storage.ts) — keeps one account's spiritual
// data from bleeding into another's on a shared device.
import { userStorage as AsyncStorage } from '@/lib/storage';

const KEY = 'poimen.canon.postponed';
const DONE_KEY = 'poimen.canon.serviceDone';

export interface PostponeOption { label: string; weeks?: number; months?: number; }

// What postponement (if any) a service's frequency allows. A weekly service
// can't be postponed — it recurs next week anyway. A biweekly one can slip to
// the off-week; monthly and longer can slip to next month.
export function postponeOptionsFor(freq: string): PostponeOption[] {
  if (freq === 'Weekly') return [];
  if (freq === 'Every 2 weeks') return [{ label: 'Next week', weeks: 1 }];
  return [{ label: 'Next month', months: 1 }];
}

// Local (not UTC) YYYY-MM-DD — comparisons are plain string compares.
export function localDateStr(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

type Stored = Record<string, string>;

async function read(storageKey: string = KEY): Promise<Stored> {
  try {
    const raw = await AsyncStorage.getItem(storageKey);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch { return {}; }
}

async function write(map: Stored, storageKey: string = KEY): Promise<void> {
  try { await AsyncStorage.setItem(storageKey, JSON.stringify(map)); } catch {}
}

// Active postponements, pruning entries whose date has passed. An entry dated
// today is kept — it is what forces the item to reappear today.
export async function loadPostponements(): Promise<Stored> {
  const map = await read();
  const today = localDateStr(new Date());
  let dirty = false;
  for (const k of Object.keys(map)) {
    if (typeof map[k] !== 'string' || map[k] < today) { delete map[k]; dirty = true; }
  }
  if (dirty) await write(map);
  return map;
}

// Defer a service item from today. The target stays on the weekday the item
// lives on (it can only be postponed on a day it is showing): "Next week" is
// exactly seven days out, "Next month" is the first occurrence of the weekday
// in the following calendar month.
export async function postponeServiceItem(itemKey: string, opt: PostponeOption): Promise<string> {
  const now = new Date();
  const target = new Date(now);
  if (opt.weeks) target.setDate(target.getDate() + opt.weeks * 7);
  if (opt.months) { target.setDate(1); target.setMonth(target.getMonth() + opt.months); }
  while (target.getDay() !== now.getDay()) target.setDate(target.getDate() + 1);
  const until = localDateStr(target);
  const map = await read();
  map[itemKey] = until;
  await write(map);
  return until;
}

// ─── Last-completed anchors ───────────────────────────────────────────────────
// Non-weekly services measure their cadence from the last completion: a
// monthly service checked off today rests until a month from today, then
// shows on its weekday again until checked. Anchors persist across days
// (unlike the daily check-offs).

export async function loadServiceDone(): Promise<Stored> {
  return read(DONE_KEY);
}

export async function recordServiceDone(itemKey: string): Promise<void> {
  const map = await read(DONE_KEY);
  map[itemKey] = localDateStr(new Date());
  await write(map, DONE_KEY);
}

// Undo a same-day check-off. Only a today-dated anchor is removed — the
// previous anchor is already gone, so the item simply shows until re-checked.
export async function clearServiceDone(itemKey: string): Promise<void> {
  const map = await read(DONE_KEY);
  if (map[itemKey] === localDateStr(new Date())) {
    delete map[itemKey];
    await write(map, DONE_KEY);
  }
}
