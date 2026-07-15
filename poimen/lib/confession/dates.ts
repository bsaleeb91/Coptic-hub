// lib/confession/dates.ts
// Confession DATES only — never content. Tracked on-device so the Home tile,
// the vitals row, Confession History, and Communion Readiness all reflect the
// last confession even offline or in demo mode. When signed in, the date is
// also mirrored to the profile (db.setLastConfession) for the FOC dashboards.

import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'poimen.confession.dates'; // local YYYY-MM-DD strings

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

export async function lastConfessionDate(): Promise<string | null> {
  const list = await loadConfessionDates();
  return list[0] ?? null;
}

// Whole days since a local YYYY-MM-DD (noon-anchored; same day = 0).
export function daysSinceDate(dateStr: string): number {
  const then = new Date(`${dateStr}T12:00:00`).getTime();
  const now = new Date(); now.setHours(12, 0, 0, 0);
  return Math.max(0, Math.round((now.getTime() - then) / 86400000));
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
