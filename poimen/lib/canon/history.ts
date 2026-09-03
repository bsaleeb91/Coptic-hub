// lib/canon/history.ts
// Rolling per-day record of which canon items were due and which were checked
// off (kept ~60 days, on-device). Powers the Home "Spiritual Vitals" card,
// which shows real adherence to My Spiritual Canon instead of self-reported
// numbers. Days the app wasn't opened have no record and don't count against
// (or toward) adherence.

// Per-user-scoped storage (see lib/storage.ts) — keeps one account's spiritual
// data from bleeding into another's on a shared device.
import { userStorage as AsyncStorage } from '@/lib/storage';
import { RuleItem, isWeeklyServiceKey, weeklyServiceKey } from './today';
import { ServiceLog, unfinalizedWeeks, markFinalized } from './service-log';
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

// Upsert a day's record — today by default, or an earlier day the member is
// completing after the fact from the Canon tab. Called whenever a day's due
// list and check state are both known: Canon tab load, Home load, and every
// check-off.
//
// Services committed by COUNT per week (`svcw_` keys) are deliberately left out
// of the daily record: a "twice a week" liturgy commitment is not a miss on the
// five days you don't attend. Those are scored per week instead, by
// finalizeWeeklyServices below — which writes its result onto the week's
// Saturday. Back-dating means we can now be asked to re-record such a Saturday,
// so those entries are carried across rather than overwritten.
export async function recordCanonDay(items: RuleItem[], checked: Set<string>, date = new Date()): Promise<void> {
  try {
    const map = await loadCanonHistory();
    const day = localDateStr(date);
    const daily = items.filter(it => !isWeeklyServiceKey(it.key));
    const prev = map[day];
    const keepDue = (prev?.due ?? []).filter(isWeeklyServiceKey);
    const keepDone = (prev?.done ?? []).filter(isWeeklyServiceKey);
    map[day] = {
      due: [...keepDue, ...daily.map(it => it.key)],
      done: [...keepDone, ...daily.filter(it => checked.has(`rule_${it.key}`)).map(it => it.key)],
    };
    const cutoff = localDateStr(new Date(Date.now() - KEEP_DAYS * 86400000));
    for (const k of Object.keys(map)) if (k < cutoff) delete map[k];
    await AsyncStorage.setItem(KEY, JSON.stringify(map));
  } catch {}
}

// Score count-committed services for every week that has fully elapsed, so
// "attended 1 of 2" reads as 50% for that week rather than penalizing the days
// in between. The result is written under the week's Saturday, repeating each
// service key `target` times in `due` and `attended` times in `done` — the same
// shape computeVitals already counts.
//
// Each week is scored against the targets STORED WITH THAT WEEK (see
// service-log.ensureWeek), never against the rule's current values, so:
//   • a week the member attended nothing still counts as a miss (the week
//     exists because ensureWeek wrote its targets),
//   • changing a target, or leaving counts mode entirely, can't rescore or
//     strand past weeks.
// Weeks are marked finalized so this is idempotent across app focuses.
export async function finalizeWeeklyServices(log: ServiceLog, now = new Date()): Promise<void> {
  try {
    const weeks = unfinalizedWeeks(log, now);
    if (!weeks.length) return;

    const map = await loadCanonHistory();
    const cutoff = localDateStr(new Date(now.getTime() - KEEP_DAYS * 86400000));
    const scored: string[] = [];

    for (const week of weeks) {
      const satDate = new Date(`${week}T12:00:00`);
      satDate.setDate(satDate.getDate() + 6);
      const sat = localDateStr(satDate);
      scored.push(week);
      if (sat < cutoff) continue;                     // older than history keeps
      const rec: DayRecord = map[sat] ?? { due: [], done: [] };
      for (const [svKey, target] of Object.entries(log[week].targets)) {
        const key = weeklyServiceKey(svKey);
        const attended = Math.min((log[week].attended?.[svKey] ?? []).length, target);
        for (let i = 0; i < target; i++) rec.due.push(key);
        for (let i = 0; i < attended; i++) rec.done.push(key);
      }
      map[sat] = rec;
    }

    for (const k of Object.keys(map)) if (k < cutoff) delete map[k];
    await AsyncStorage.setItem(KEY, JSON.stringify(map));
    await markFinalized(scored);
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
  { key: 'liturgy',    label: 'Liturgical Services',   match: (k) => k.startsWith('svc_') || isWeeklyServiceKey(k) },
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
