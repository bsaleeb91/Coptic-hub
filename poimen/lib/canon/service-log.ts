// lib/canon/service-log.ts
// Attendance log for church services committed to by COUNT per period
// (RuleConfig.servicesMode === 'counts'). The member logs each service as they
// attend it; the canon shows "1 of 2 this week", "2 of 3 this month", and so on.
//
// Each service keeps its own periods, because each carries its own frequency —
// liturgy weekly and communion monthly is an ordinary rule, and one shared
// bucket could not express it. Periods come from periods.ts, so every counted
// commitment in the app divides time the same way.
//
// Each period stores the TARGET and FREQUENCY that were in force during it
// alongside what was attended, so a period is always scored against what was
// actually asked at the time — not against whatever the rule says months later,
// and not lost if the member changes cadence or leaves counts mode.
// `ensurePeriods` writes the current period's target on every canon load, which
// is also what makes a period with ZERO attendance exist (and therefore count
// as a miss) rather than silently vanishing.

// Per-user-scoped storage (see lib/storage.ts) — keeps one account's spiritual
// data from bleeding into another's on a shared device.
import { userStorage as AsyncStorage } from '@/lib/storage';
import type { ServiceCount } from './rule-store';
import { periodStart, periodElapsed, dateStr } from './periods';

const KEY = 'poimen.canon.serviceLog';
// Kept just under the 366 days of adherence history, so finalized periods
// aren't re-added to a history that has already pruned them.
const KEEP_DAYS = 360;

export interface PeriodLog {
  target: number;      // times asked of this service during the period
  freq: string;        // the cadence in force then
  attended: string[];  // local dates attended
  finalized?: boolean; // already scored into adherence history
}

// service key → period start (local YYYY-MM-DD) → that period's log
export type ServiceLog = Record<string, Record<string, PeriodLog>>;

// Tolerate anything on disk, including the pre-period shape: one bucket per
// week holding every service at once, which is transposed here rather than
// dropped so no attendance is lost on upgrade.
function coerce(raw: any): ServiceLog {
  const out: ServiceLog = {};
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out;

  const put = (svc: string, start: string, log: PeriodLog) => {
    (out[svc] ??= {})[start] = log;
  };
  const dates = (v: any) => (Array.isArray(v) ? v.filter((d: any) => typeof d === 'string') : []);

  for (const [k, v] of Object.entries<any>(raw)) {
    if (!v || typeof v !== 'object' || Array.isArray(v)) continue;

    // Legacy: k is a week start, v is { targets, attended, finalized }.
    const legacy = v.targets != null
      || (v.attended != null && !Array.isArray(v.attended) && v.target === undefined);
    if (legacy) {
      const svcs = new Set([...Object.keys(v.targets ?? {}), ...Object.keys(v.attended ?? {})]);
      for (const svc of svcs) {
        const n = Math.floor(Number(v.targets?.[svc]));
        put(svc, k, {
          target: Number.isFinite(n) && n > 0 ? n : 0,
          freq: 'Weekly',
          attended: dates(v.attended?.[svc]),
          finalized: v.finalized === true,
        });
      }
      continue;
    }

    // Current: k is a service key, v is { periodStart: PeriodLog }.
    for (const [start, p] of Object.entries<any>(v)) {
      if (!p || typeof p !== 'object') continue;
      const n = Math.floor(Number(p.target));
      put(k, start, {
        target: Number.isFinite(n) && n > 0 ? n : 0,
        freq: typeof p.freq === 'string' ? p.freq : 'Weekly',
        attended: dates(p.attended),
        finalized: p.finalized === true,
      });
    }
  }
  return out;
}

export async function loadServiceLog(): Promise<ServiceLog> {
  try { return coerce(JSON.parse((await AsyncStorage.getItem(KEY)) ?? '{}')); }
  catch { return {}; }
}

async function save(log: ServiceLog): Promise<void> {
  try {
    const cutoff = dateStr(new Date(Date.now() - KEEP_DAYS * 86400000));
    for (const svc of Object.keys(log)) {
      for (const start of Object.keys(log[svc])) if (start < cutoff) delete log[svc][start];
      if (!Object.keys(log[svc]).length) delete log[svc];
    }
    await AsyncStorage.setItem(KEY, JSON.stringify(log));
  } catch {}
}

// Record the target in force for each committed service's CURRENT period.
// Called on every canon load while in counts mode: it keeps a mid-period target
// change current and guarantees the period exists, so a period the member
// attended nothing in still gets scored as a miss when it closes.
export async function ensurePeriods(
  counts: Record<string, ServiceCount>,
  date = new Date(),
): Promise<ServiceLog> {
  const log = await loadServiceLog();
  let dirty = false;
  for (const [svc, cfg] of Object.entries(counts ?? {})) {
    const { n, freq } = cfg;
    if (!(n > 0)) continue;
    const start = periodStart(freq, date);
    const cur = (log[svc] ??= {})[start];
    if (!cur) {
      log[svc][start] = { target: n, freq, attended: [] };
      dirty = true;
    } else if (cur.target !== n || cur.freq !== freq) {
      cur.target = n;
      cur.freq = freq;
      dirty = true;
    }
  }
  if (dirty) await save(log);
  return log;
}

// How many times each committed service has been logged in ITS current period.
export function periodCounts(
  log: ServiceLog,
  counts: Record<string, ServiceCount>,
  date: Date,
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [svc, cfg] of Object.entries(counts ?? {})) {
    out[svc] = (log[svc]?.[periodStart(cfg.freq, date)]?.attended ?? []).length;
  }
  return out;
}

// Whether this service was logged on `date` itself.
export function loggedOn(log: ServiceLog, serviceKey: string, freq: string, date: Date): boolean {
  return (log[serviceKey]?.[periodStart(freq, date)]?.attended ?? []).includes(dateStr(date));
}

export async function logAttendance(
  serviceKey: string, freq: string, date = new Date(),
): Promise<ServiceLog> {
  const log = await loadServiceLog();
  const start = periodStart(freq, date);
  const day = dateStr(date);
  const period = ((log[serviceKey] ??= {})[start] ??= { target: 0, freq, attended: [] });
  if (!period.attended.includes(day)) {
    period.attended.push(day);
    period.attended.sort();
  }
  await save(log);
  return log;
}

// Remove the most recent attendance for this service in `date`'s period — so a
// mistaken log can always be undone, including one made earlier in the period
// (the row is still shown once its target is met precisely for this).
export async function unlogLatest(
  serviceKey: string, freq: string, date = new Date(),
): Promise<ServiceLog> {
  const log = await loadServiceLog();
  const start = periodStart(freq, date);
  const attended = log[serviceKey]?.[start]?.attended;
  if (Array.isArray(attended) && attended.length) {
    attended.sort();
    attended.pop();
  }
  await save(log);
  return log;
}

export interface ElapsedPeriod {
  serviceKey: string; start: string; freq: string; target: number; done: number;
}

// Periods that have fully elapsed and have not yet been scored into adherence.
export function unfinalizedPeriods(log: ServiceLog, now = new Date()): ElapsedPeriod[] {
  const out: ElapsedPeriod[] = [];
  for (const [serviceKey, periods] of Object.entries(log)) {
    for (const [start, p] of Object.entries(periods)) {
      if (p.finalized || p.target <= 0) continue;
      if (!periodElapsed(p.freq, start, now)) continue;
      out.push({ serviceKey, start, freq: p.freq, target: p.target, done: p.attended.length });
    }
  }
  return out.sort((a, b) => (a.start < b.start ? -1 : a.start > b.start ? 1 : 0));
}

export async function markFinalized(periods: ElapsedPeriod[]): Promise<void> {
  if (!periods.length) return;
  const log = await loadServiceLog();
  for (const { serviceKey, start } of periods) {
    const p = log[serviceKey]?.[start];
    if (p) p.finalized = true;
  }
  await save(log);
}
