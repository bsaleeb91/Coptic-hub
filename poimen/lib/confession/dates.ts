// lib/confession/dates.ts
// Confession DATES only — never content. Tracked on-device so the Home tile,
// the vitals row, Confession History, and Communion Readiness all reflect the
// last confession even offline or in demo mode. When signed in, the date is
// also mirrored to the profile (db.setLastConfession) for the FOC dashboards.

// Per-user-scoped storage (see lib/storage.ts) — keeps one account's spiritual
// data from bleeding into another's on a shared device.
import { userStorage as AsyncStorage } from '@/lib/storage';
import * as db from '@/lib/db';

const KEY = 'poimen.confession.dates'; // local YYYY-MM-DD strings
const CLOUD_SLUG = 'confession-dates';

// Mirror the member's confession DATES (never content) to agent_progress so
// the Father of Confession's member view can show self-reported confessions
// in the history, not just the ones the priest logged. Fire-and-forget.
export async function pushConfessionDatesToCloud(userId: string): Promise<void> {
  try {
    await db.upsertAgentProgress({
      user_id: userId,
      agent_slug: CLOUD_SLUG,
      payload: { dates: await loadConfessionDates() },
      updated_at: new Date().toISOString(),
    });
  } catch {
    // Offline — the next record/visit re-mirrors.
  }
}

function localDateStr(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

// Newest first.
export async function loadConfessionDates(): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((x: unknown) => typeof x === 'string').sort().reverse();
  } catch { return []; }
}

// Record a confession on the given date (defaults to today). Same-day
// duplicates collapse, so re-visiting the completion screen is harmless.
export async function recordConfession(date: Date = new Date()): Promise<string[]> {
  const key = localDateStr(date);
  const list = await loadConfessionDates();
  if (!list.includes(key)) list.push(key);
  const next = list.sort().reverse();
  try { await AsyncStorage.setItem(KEY, JSON.stringify(next)); } catch {}
  return next;
}

// Remove a self-reported date (e.g. logged by mistake). Returns the
// remaining dates, newest first, so the caller can re-mirror the newest one.
export async function deleteConfessionDate(dateKey: string): Promise<string[]> {
  const list = await loadConfessionDates();
  const next = list.filter(d => d !== dateKey).sort().reverse();
  try { await AsyncStorage.setItem(KEY, JSON.stringify(next)); } catch {}
  return next;
}

export async function lastConfessionDate(): Promise<string | null> {
  const list = await loadConfessionDates();
  return list[0] ?? null;
}

// Pull this user's confession dates from their cloud mirror into the (now
// per-user) local store when local is empty — so signing into an account on a
// fresh device/namespace restores their own history instead of showing none.
export async function hydrateConfessionDatesFromCloud(userId: string): Promise<void> {
  try {
    if ((await loadConfessionDates()).length > 0) return;
    const payload = await db.getAgentProgress(userId, CLOUD_SLUG);
    const dates = Array.isArray((payload as any)?.dates)
      ? (payload as any).dates.filter((x: unknown) => typeof x === 'string')
      : [];
    if (dates.length) await AsyncStorage.setItem(KEY, JSON.stringify(dates.sort().reverse()));
  } catch {
    // Offline or no row — local (empty) stands.
  }
}

// Newest confession timestamp for FOC views: the latest of a
// confession-encounter timestamp (priest-logged) and the member's
// self-reported profiles.last_confession_at (which may be a bare
// YYYY-MM-DD — anchored at local noon to avoid off-by-one days).
function confessionTimeMs(iso: string | null | undefined): number {
  if (!iso) return 0;
  const t = new Date(/^\d{4}-\d{2}-\d{2}$/.test(iso) ? `${iso}T12:00:00` : iso).getTime();
  return isNaN(t) ? 0 : t;
}

export function latestConfessionMs(
  encounterIso: string | null | undefined,
  profileIso: string | null | undefined,
): number | null {
  const t = Math.max(confessionTimeMs(encounterIso), confessionTimeMs(profileIso));
  return t > 0 ? t : null;
}

const MONTHS: Record<string, number> = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
  jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
};

// Hermes (React Native's engine) cannot parse human date strings like
// "Jul 21, 2026" via `new Date(str)` — it returns Invalid Date, which silently
// blocked date-field saves on device (they only "worked" in a browser). Parse
// the formats our date inputs actually produce/accept ourselves, anchored at
// local noon so day math never slips a day. Returns null if unparseable.
export function parseLocalDate(input: string): Date | null {
  const s = input.trim();
  if (!s) return null;
  // "Mon DD, YYYY" / "Month DD YYYY"
  const m = s.match(/^([A-Za-z]{3,})\.?\s+(\d{1,2}),?\s+(\d{4})$/);
  if (m) {
    const mon = MONTHS[m[1].slice(0, 3).toLowerCase()];
    if (mon !== undefined) {
      const d = new Date(Number(m[3]), mon, Number(m[2]), 12, 0, 0, 0);
      if (!isNaN(d.getTime())) return d;
    }
  }
  // ISO yyyy-mm-dd
  const iso = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (iso) {
    const d = new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]), 12, 0, 0, 0);
    if (!isNaN(d.getTime())) return d;
  }
  // Numeric M/D/YYYY
  const us = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (us) {
    const d = new Date(Number(us[3]), Number(us[1]) - 1, Number(us[2]), 12, 0, 0, 0);
    if (!isNaN(d.getTime())) return d;
  }
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

// Whole days since a local YYYY-MM-DD (noon-anchored; same day = 0).
export function daysSinceDate(dateStr: string): number {
  const then = new Date(`${dateStr}T12:00:00`).getTime();
  const now = new Date(); now.setHours(12, 0, 0, 0);
  return Math.max(0, Math.round((now.getTime() - then) / 86400000));
}

// Whole days since a timestamp, counted on LOCAL calendar days (noon-anchored,
// same day = 0) — matches daysSinceDate so the priest's "days since confession"
// agrees with the member's, instead of counting raw elapsed 24h periods (which
// reads 0 for a confession made yesterday evening).
export function daysSinceMs(ms: number): number {
  const then = new Date(ms); then.setHours(12, 0, 0, 0);
  const now = new Date(); now.setHours(12, 0, 0, 0);
  return Math.max(0, Math.round((now.getTime() - then.getTime()) / 86400000));
}

// The rule's confession frequency → maximum days between confessions.
export function confessionFrequencyDays(freq: string): number {
  switch (freq) {
    case 'Weekly':          return 7;
    case 'Every 2 weeks':   return 14;
    case 'Monthly':         return 31;
    case 'Every 2 months':  return 62;
    case 'Quarterly':       return 93;
    case 'Twice a year':    return 184;
    default:                return 31;
  }
}
