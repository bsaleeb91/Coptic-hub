// lib/canon/rule-store.ts
// The user's personal prayer rule (Canon), ideally set with their father of
// confession. Ported from Nepsis. Configurable per day of the week and persisted
// on-device (AsyncStorage); mirrored to Supabase agent_progress by rule-sync.ts.
// This is the congregant's *self-set* rule — distinct from the priest-assigned
// spiritual_canons that already drive the Canon tab.

import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'poimen.rule';

// ─── Option lists ─────────────────────────────────────────────────────────────

export const AGPEYA_HOURS: { key: string; name: string }[] = [
  { key: 'prime',    name: 'First Hour (Prime)' },
  { key: 'terce',    name: 'Third Hour (Terce)' },
  { key: 'sext',     name: 'Sixth Hour (Sext)' },
  { key: 'none',     name: 'Ninth Hour (None)' },
  { key: 'vespers',  name: 'Eleventh Hour (Vespers)' },
  { key: 'compline', name: 'Twelfth Hour (Compline)' },
  { key: 'veil',     name: 'Prayer of the Veil' },
  { key: 'midnight', name: 'Midnight (Three Watches)' },
];

export const SERVICES: { key: string; name: string }[] = [
  { key: 'church_vespers', name: 'Vespers (Raising of Incense)' },
  { key: 'matins',         name: 'Matins' },
  { key: 'liturgy',        name: 'Divine Liturgy' },
  { key: 'midnight_praise',name: 'Midnight Praise (Tasbeha)' },
];

export const CONFESSION_OPTIONS = [
  'Weekly', 'Every 2 weeks', 'Monthly', 'Every 2 months', 'Quarterly', 'Twice a year',
];

// On fasting days, abstain from food until this time of day — every half hour.
function genTimeOptions(): string[] {
  const out: string[] = [];
  for (let h = 0; h < 24; h++) {
    for (const m of [0, 30]) {
      const period = h < 12 ? 'AM' : 'PM';
      const hr = h % 12 === 0 ? 12 : h % 12;
      out.push(`${hr}:${m === 0 ? '00' : '30'} ${period}`);
    }
  }
  return out;
}
export const FAST_UNTIL_OPTIONS = genTimeOptions();

export const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

// ─── Model ────────────────────────────────────────────────────────────────────

export type ReadMode = 'chapters' | 'minutes';

export interface DayPlan {
  hours: string[];      // agpeya hour keys prayed this weekday
  services: string[];   // church service keys this weekday
}

export interface RuleConfig {
  prostrations: number;
  fastUntil: string;    // abstain from food until this time on fasting days
  quietMinutes: number;
  bible: { mode: ReadMode; amount: number };
  book: { title: string; mode: ReadMode; amount: number } | null;
  confession: string;
  days: DayPlan[];      // length 7, index 0 = Sunday
}

export const DEFAULT_RULE: RuleConfig = {
  prostrations: 0,
  fastUntil: '3:00 PM',
  quietMinutes: 10,
  bible: { mode: 'chapters', amount: 1 },
  book: null,
  confession: 'Monthly',
  days: Array.from({ length: 7 }, () => ({ hours: [], services: [] })),
};

// ─── Persistence ──────────────────────────────────────────────────────────────

function normalize(parsed: any): RuleConfig {
  // Merge with defaults so older saves don't break on new fields.
  const days: DayPlan[] = Array.from({ length: 7 }, (_, i) => ({
    hours: parsed?.days?.[i]?.hours ?? [],
    services: parsed?.days?.[i]?.services ?? [],
  }));
  return { ...DEFAULT_RULE, ...parsed, bible: { ...DEFAULT_RULE.bible, ...parsed?.bible }, days };
}

export async function loadRule(): Promise<RuleConfig> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return DEFAULT_RULE;
    return normalize(JSON.parse(raw));
  } catch {
    return DEFAULT_RULE;
  }
}

export async function saveRule(rule: RuleConfig): Promise<void> {
  try { await AsyncStorage.setItem(KEY, JSON.stringify(rule)); } catch {}
}

// Whether a rule has ever been saved on this device (vs. the default fallback).
export async function hasStoredRule(): Promise<boolean> {
  try { return (await AsyncStorage.getItem(KEY)) != null; } catch { return false; }
}

// Overwrite local rule with one pulled from the cloud.
export async function importRule(parsed: any): Promise<RuleConfig> {
  const rule = normalize(parsed);
  await saveRule(rule);
  return rule;
}
