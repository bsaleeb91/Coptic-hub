// lib/canon/service-log.ts
// Attendance log for church services committed to by COUNT per week
// (RuleConfig.servicesMode === 'counts'). The member logs each service as they
// attend it; the canon shows "1 of 2 this week".
//
// Weeks run Sunday→Saturday, matching the weekday indices used everywhere else
// in the canon (0 = Sunday). Each week stores the TARGETS that were in force
// during it alongside what was attended, so a week is always scored against
// what was actually asked of the member at the time — not against whatever the
// rule happens to say weeks later, and not lost entirely if the member switches
// away from counts mode. `ensureWeek` writes the current week's targets on
// every canon load, which is also what makes a week with ZERO attendance exist
// (and therefore count as a miss) instead of silently vanishing.

// Per-user-scoped storage (see lib/storage.ts) — keeps one account's spiritual
// data from bleeding into another's on a shared device.
import { userStorage as AsyncStorage } from '@/lib/storage';
import { localDateStr } from './postpone';

const KEY = 'poimen.canon.serviceLog';
// Kept just under the 366 days of adherence history, so finalized weeks aren't
// re-added to a history that has already pruned them.
const KEEP_WEEKS = 51;

export interface WeekLog {
  targets: Record<string, number>;        // service key → times/week asked that week
  attended: Record<string, string[]>;     // service key → local dates attended
  finalized?: boolean;                    // already scored into adherence history
}

// weekStart (local YYYY-MM-DD of the Sunday) → that week's log
export type ServiceLog = Record<string, WeekLog>;

// Local Sunday that starts the week containing `date`.
export function weekStartStr(date: Date): string {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  d.setDate(d.getDate() - d.getDay());
  return localDateStr(d);
}

function emptyWeek(): WeekLog { return { targets: {}, attended: {} }; }

// Tolerate anything on disk; older/partial shapes degrade to an empty week.
function coerce(raw: any): ServiceLog {
  const out: ServiceLog = {};
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out;
  for (const [week, v] of Object.entries<any>(raw)) {
    if (!v || typeof v !== 'object' || Array.isArray(v)) continue;
    const attended: Record<string, string[]> = {};
    for (const [k, dates] of Object.entries<any>(v.attended ?? {})) {
      if (Array.isArray(dates)) attended[k] = dates.filter((d: any) => typeof d === 'string');
    }
    const targets: Record<string, number> = {};
    for (const [k, n] of Object.entries<any>(v.targets ?? {})) {
      const num = Math.floor(Number(n));
      if (Number.isFinite(num) && num > 0) targets[k] = num;
    }
    out[week] = { targets, attended, finalized: v.finalized === true };
  }
  return out;
}

export async function loadServiceLog(): Promise<ServiceLog> {
  try { return coerce(JSON.parse((await AsyncStorage.getItem(KEY)) ?? '{}')); }
  catch { return {}; }
}

async function save(log: ServiceLog): Promise<void> {
  try {
    const weeks = Object.keys(log).sort();
    for (const w of weeks.slice(0, Math.max(0, weeks.length - KEEP_WEEKS))) delete log[w];
    await AsyncStorage.setItem(KEY, JSON.stringify(log));
  } catch {}
}

// Record the targets in force for the week containing `date`. Called on every
// canon load while in counts mode: it both keeps a mid-week target change
// current and guarantees the week exists, so a week the member attended
// nothing still gets scored as a miss when it closes.
export async function ensureWeek(
  targets: Record<string, number>,
  date = new Date(),
): Promise<ServiceLog> {
  const log = await loadServiceLog();
  const wk = weekStartStr(date);
  const week = (log[wk] ??= emptyWeek());
  const next = JSON.stringify(targets);
  if (JSON.stringify(week.targets) !== next) {
    week.targets = { ...targets };
    await save(log);
  }
  return log;
}

// How many times each service has been logged in the week containing `date`.
export function weekCounts(log: ServiceLog, date: Date): Record<string, number> {
  const attended = log[weekStartStr(date)]?.attended ?? {};
  const out: Record<string, number> = {};
  for (const [k, dates] of Object.entries(attended)) out[k] = dates.length;
  return out;
}

// Whether this service was logged on `date` itself.
export function loggedOn(log: ServiceLog, serviceKey: string, date: Date): boolean {
  return (log[weekStartStr(date)]?.attended?.[serviceKey] ?? []).includes(localDateStr(date));
}

export async function logAttendance(serviceKey: string, date = new Date()): Promise<ServiceLog> {
  const log = await loadServiceLog();
  const wk = weekStartStr(date);
  const day = localDateStr(date);
  const week = (log[wk] ??= emptyWeek());
  const dates = (week.attended[serviceKey] ??= []);
  if (!dates.includes(day)) { dates.push(day); dates.sort(); }
  await save(log);
  return log;
}

// Remove the most recent attendance for this service in `date`'s week — so a
// mistaken log can always be undone, including one made earlier in the week
// (the row is still shown once its target is met precisely for this).
export async function unlogLatest(serviceKey: string, date = new Date()): Promise<ServiceLog> {
  const log = await loadServiceLog();
  const wk = weekStartStr(date);
  const dates = log[wk]?.attended?.[serviceKey];
  if (Array.isArray(dates) && dates.length) {
    dates.sort();
    dates.pop();
    if (!dates.length) delete log[wk].attended[serviceKey];
  }
  await save(log);
  return log;
}

// Weeks that have fully elapsed and have not yet been scored into adherence.
export function unfinalizedWeeks(log: ServiceLog, now = new Date()): string[] {
  const current = weekStartStr(now);
  return Object.keys(log)
    .filter(w => w < current && !log[w].finalized && Object.keys(log[w].targets).length > 0)
    .sort();
}

export async function markFinalized(weeks: string[]): Promise<void> {
  if (!weeks.length) return;
  const log = await loadServiceLog();
  for (const w of weeks) if (log[w]) log[w].finalized = true;
  await save(log);
}
