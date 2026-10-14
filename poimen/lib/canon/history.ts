// lib/canon/history.ts
// Rolling per-day record of which canon items were due and which were checked
// off (kept ~60 days, on-device). Powers the Home "Spiritual Vitals" card,
// which shows real adherence to My Spiritual Canon instead of self-reported
// numbers. Days the app wasn't opened have no record and don't count against
// (or toward) adherence.

// Per-user-scoped storage (see lib/storage.ts) — keeps one account's spiritual
// data from bleeding into another's on a shared device.
import { userStorage as AsyncStorage } from '@/lib/storage';
import { RuleItem } from './today';
import { isWeeklyServiceKey, weeklyServiceKey } from './keys';
import { ServiceLog, unfinalizedPeriods, markFinalized, type ElapsedPeriod } from './service-log';
import { periodEnd } from './periods';
import { localDateStr } from './postpone';

const KEY = 'poimen.canon.history';
const EPOCH_KEY = 'poimen.canon.vitalsEpoch';
const KEEP_DAYS = 366; // longitudinal — keep a year of records

// The scoring itself lives in vitals.ts (no storage, so it can be tested);
// re-exported here so existing call sites keep one import.
export { VITAL_CATEGORIES, computeVitals, type VitalStat, type ConfessionInput, type DayRecord, type CanonHistory } from './vitals';
import type { CanonHistory, DayRecord } from './vitals';

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

// Score count-committed services for every PERIOD that has fully elapsed, so
// "attended 1 of 2" reads as 50% for that period rather than penalizing the
// days in between. The result is written on the period's last day, repeating
// each service key `target` times in `due` and `attended` times in `done` —
// the same shape computeVitals already counts.
//
// Each period is scored against the target and frequency STORED WITH THAT
// PERIOD (see service-log.ensurePeriods), never against the rule's current
// values, so:
//   • a period the member attended nothing in still counts as a miss (the
//     period exists because ensurePeriods wrote its target),
//   • changing a target or cadence, or leaving counts mode entirely, can't
//     rescore or strand past periods.
// Periods are marked finalized so this is idempotent across app focuses.
export async function finalizeWeeklyServices(log: ServiceLog, now = new Date()): Promise<void> {
  try {
    const periods = unfinalizedPeriods(log, now);
    if (!periods.length) return;

    const map = await loadCanonHistory();
    const cutoff = localDateStr(new Date(now.getTime() - KEEP_DAYS * 86400000));
    const scored: ElapsedPeriod[] = [];

    for (const p of periods) {
      scored.push(p);
      const last = periodEnd(p.freq, p.start);
      if (last < cutoff) continue;                    // older than history keeps
      const rec: DayRecord = map[last] ?? { due: [], done: [] };
      const key = weeklyServiceKey(p.serviceKey);
      const done = Math.min(p.done, p.target);
      for (let i = 0; i < p.target; i++) rec.due.push(key);
      for (let i = 0; i < done; i++) rec.done.push(key);
      map[last] = rec;
    }

    for (const k of Object.keys(map)) if (k < cutoff) delete map[k];
    await AsyncStorage.setItem(KEY, JSON.stringify(map));
    await markFinalized(scored);
  } catch {}
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
