// lib/liturgical/ruleStore.ts
// The user's personal prayer rule, ideally set with their father of
// confession. Configurable per day of the week and persisted on-device.
// Distinct from priest-assigned canons (Supabase): this is the private,
// self-kept structure of daily prayer.

import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'poimen.rule';
const DONE_KEY = 'poimen.rule.done';

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

// True when the rule has nothing configured — used to show a setup prompt.
export function ruleIsEmpty(rule: RuleConfig): boolean {
  return (
    rule.prostrations === 0 &&
    rule.quietMinutes === 0 &&
    rule.bible.amount === 0 &&
    !rule.book &&
    rule.days.every(d => d.hours.length === 0 && d.services.length === 0)
  );
}

// ─── Persistence ──────────────────────────────────────────────────────────────

export async function loadRule(): Promise<RuleConfig> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return DEFAULT_RULE;
    const parsed = JSON.parse(raw);
    // Merge with defaults so older saves don't break on new fields.
    const days: DayPlan[] = Array.from({ length: 7 }, (_, i) => ({
      hours: parsed.days?.[i]?.hours ?? [],
      services: parsed.days?.[i]?.services ?? [],
    }));
    return { ...DEFAULT_RULE, ...parsed, bible: { ...DEFAULT_RULE.bible, ...parsed.bible }, days };
  } catch {
    return DEFAULT_RULE;
  }
}

export async function saveRule(rule: RuleConfig): Promise<void> {
  try { await AsyncStorage.setItem(KEY, JSON.stringify(rule)); } catch {}
}

// ─── Today's completions ──────────────────────────────────────────────────────
// Which rule items were checked off today. Keyed by date so yesterday's
// checkmarks never bleed into a new day.

interface DoneRecord { date: string; keys: string[]; }

const todayStr = () => new Date().toISOString().slice(0, 10);

export async function loadTodayDone(): Promise<Set<string>> {
  try {
    const raw = await AsyncStorage.getItem(DONE_KEY);
    if (!raw) return new Set();
    const rec = JSON.parse(raw) as DoneRecord;
    return rec.date === todayStr() ? new Set(rec.keys) : new Set();
  } catch {
    return new Set();
  }
}

export async function saveTodayDone(keys: Set<string>): Promise<void> {
  try {
    const rec: DoneRecord = { date: todayStr(), keys: [...keys] };
    await AsyncStorage.setItem(DONE_KEY, JSON.stringify(rec));
  } catch {}
}
