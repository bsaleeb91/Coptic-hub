// lib/canon/history.ts
// Rolling per-day record of which canon items were due and which were checked
// off (kept ~60 days, on-device). Powers the Home "Spiritual Vitals" card,
// which shows real adherence to My Spiritual Canon instead of self-reported
// numbers. Days the app wasn't opened have no record and don't count against
// (or toward) adherence.

import AsyncStorage from '@react-native-async-storage/async-storage';
import { RuleItem } from './today';
import { localDateStr } from './postpone';

const KEY = 'poimen.canon.history';
const EPOCH_KEY = 'poimen.canon.vitalsEpoch';
const KEEP_DAYS = 366; // longitudinal — keep a year of records

export interface DayRecord { due: string[]; done: string[]; }
export type CanonHistory = Record<string, DayRecord>; // local YYYY-MM-DD → record

export async function loadCanonHistory(): Promise<CanonHistory> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch { return {}; }
}

// Upsert today's record. Called whenever today's due list and check state are
// both known — Canon tab load, Home load, and every check-off.
export async function recordCanonDay(items: RuleItem[], checked: Set<string>): Promise<void> {
  try {
    const map = await loadCanonHistory();
    map[localDateStr(new Date())] = {
      due: items.map(it => it.key),
      done: items.filter(it => checked.has(`rule_${it.key}`)).map(it => it.key),
    };
    const cutoff = localDateStr(new Date(Date.now() - KEEP_DAYS * 86400000));
    for (const k of Object.keys(map)) if (k < cutoff) delete map[k];
    await AsyncStorage.setItem(KEY, JSON.stringify(map));
  } catch {}
}

// The vitals categories, mapped from canon item keys. `key` doubles as the
// agent_progress 'vitals' payload field (the original five keys keep their
// meaning for FOC dashboards). Every category always renders — the card is a
// longitudinal picture — showing "—" where nothing was ever due. Fasting only
// accrues on actual fasting days (Wed/Fri outside the Holy Fifty + church
// fasting seasons); Confession has no tracking yet and reads "—" until we
// decide how to measure it.
export const VITAL_CATEGORIES: {
  key: string; label: string; match: (k: string) => boolean;
}[] = [
  { key: 'prayer',     label: 'Daily Prayer (Agpeya + Prostrations)', match: (k) => k.startsWith('hour_') || k === 'prostrations' },
  { key: 'quiet',      label: 'Quiet Time',            match: (k) => k === 'quiet' },
  { key: 'scripture',  label: 'Scripture Reading',     match: (k) => k === 'bible' },
  { key: 'book',       label: 'Spiritual Book',        match: (k) => k === 'book' },
  { key: 'liturgy',    label: 'Liturgical Services',   match: (k) => k.startsWith('svc_') },
  { key: 'fasting',    label: 'Fasting',               match: (k) => k === 'fast' },
  { key: 'service',    label: 'Service / Diakonia',    match: (k) => k.startsWith('serve_') },
  { key: 'confession', label: 'Confession',            match: () => false },
];

export interface VitalStat {
  key: string; label: string; due: number; done: number; pct: number | null;
}

// Adherence per category across recorded history, optionally from a reset
// epoch (the user can reset vitals after confession — tracking then reads
// "since that date"). pct stays null where nothing in the window was due.
export function computeVitals(history: CanonHistory, since?: string | null): VitalStat[] {
  const stats: VitalStat[] = VITAL_CATEGORIES.map(c => ({ key: c.key, label: c.label, due: 0, done: 0, pct: null }));
  for (const [date, rec] of Object.entries(history)) {
    if (since && date < since) continue;
    VITAL_CATEGORIES.forEach((c, i) => {
      stats[i].due += (rec?.due ?? []).filter(c.match).length;
      stats[i].done += (rec?.done ?? []).filter(c.match).length;
    });
  }
  for (const s of stats) if (s.due > 0) s.pct = Math.round((s.done / s.due) * 100);
  return stats;
}

// ─── Vitals epoch (reset point) ───────────────────────────────────────────────
// Set when the user resets their vitals after confession; adherence is
// measured from this date forward. Null = never reset (all history counts).

export async function loadVitalsEpoch(): Promise<string | null> {
  try { return await AsyncStorage.getItem(EPOCH_KEY); } catch { return null; }
}

export async function resetVitalsEpoch(): Promise<string> {
  const today = localDateStr(new Date());
  try { await AsyncStorage.setItem(EPOCH_KEY, today); } catch {}
  return today;
}
