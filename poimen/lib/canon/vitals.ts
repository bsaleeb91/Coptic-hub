// lib/canon/vitals.ts
// The Spiritual Vitals math, kept free of storage and React so it can be
// tested directly (see vitals.test.ts). history.ts owns reading and writing
// the day records; this file only scores them, and deliberately imports
// nothing so the test runner can load it without the bundler's path alias.

// Canon item-key shapes. A church service reaches the canon in one of two
// ways: `svc_<service>` (pinned to a weekday, or logged ad-hoc — attendance.ts)
// and `svcw_<service>` (committed to as a number of times per week).
export const weeklyServiceKey = (serviceKey: string) => `svcw_${serviceKey}`;
export const isWeeklyServiceKey = (k: string) => k.startsWith('svcw_');

// The service a canon item key refers to, whichever way it was committed to.
// Returns null for keys that aren't services. Vital categories match on this
// rather than on a `svc_` prefix, which would lump communion in with liturgy.
export function serviceKeyOf(k: string): string | null {
  if (k.startsWith('svcw_')) return k.slice(5);
  if (k.startsWith('svc_')) return k.slice(4);
  return null;
}

export interface DayRecord { due: string[]; done: string[]; }
export type CanonHistory = Record<string, DayRecord>; // local YYYY-MM-DD → record

const localDateStr = (d: Date) => {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

// The vitals categories, mapped from canon item keys. `key` doubles as the
// agent_progress 'vitals' payload field (the original five keys keep their
// meaning for FOC dashboards). Every category always renders — the card is a
// longitudinal picture — showing "—" where nothing was ever due. Fasting only
// accrues on actual fasting days (Wed/Fri outside the Holy Fifty + church
// fasting seasons). Confession is not a canon check-off — it is measured from
// the recorded confession dates against the rule's cadence (see
// confessionVital below), because the rule governing this card is that
// anything shown on it has to be trackable somewhere.
export const VITAL_CATEGORIES: {
  key: string; label: string; match: (k: string) => boolean;
}[] = [
  { key: 'prayer',     label: 'Daily Prayer (Agpeya + Prostrations)', match: (k) => k.startsWith('hour_') || k === 'prostrations' },
  { key: 'quiet',      label: 'Quiet Time',            match: (k) => k === 'quiet' },
  { key: 'scripture',  label: 'Scripture Reading',     match: (k) => k === 'bible' },
  { key: 'book',       label: 'Spiritual Book',        match: (k) => k === 'book' },
  // Liturgy covers every church service EXCEPT communion, which gets its own
  // row — receiving the Eucharist is not the same commitment as showing up.
  { key: 'liturgy',    label: 'Liturgical Services',   match: (k) => { const sk = serviceKeyOf(k); return sk !== null && sk !== 'communion'; } },
  { key: 'communion',  label: 'Holy Communion',        match: (k) => serviceKeyOf(k) === 'communion' },
  { key: 'fasting',    label: 'Fasting',               match: (k) => k === 'fast' },
  { key: 'service',    label: 'Service / Diakonia',    match: (k) => k.startsWith('serve_') },
  // Never matches a canon key — filled in by confessionVital from the recorded
  // confession dates, since confession is logged on the Confession tab.
  { key: 'confession', label: 'Confession',            match: () => false },
];

export interface VitalStat {
  key: string; label: string; due: number; done: number; pct: number | null;
}

// Adherence per category across recorded history, optionally from a reset
// epoch (the user can reset vitals after confession — tracking then reads
// "since that date"). pct stays null where nothing in the window was due.
export function computeVitals(
  history: CanonHistory,
  since?: string | null,
  confession?: ConfessionInput,
): VitalStat[] {
  const stats: VitalStat[] = VITAL_CATEGORIES.map(c => ({ key: c.key, label: c.label, due: 0, done: 0, pct: null }));
  for (const [date, rec] of Object.entries(history)) {
    if (since && date < since) continue;
    VITAL_CATEGORIES.forEach((c, i) => {
      stats[i].due += (rec?.due ?? []).filter(c.match).length;
      stats[i].done += (rec?.done ?? []).filter(c.match).length;
    });
  }
  if (confession) {
    const i = stats.findIndex(s => s.key === 'confession');
    if (i !== -1) stats[i] = { ...stats[i], ...confessionVital(history, since, confession) };
  }
  for (const s of stats) if (s.due > 0) s.pct = Math.round((s.done / s.due) * 100);
  return stats;
}

export interface ConfessionInput {
  dates: string[];    // local YYYY-MM-DD, from lib/confession/dates
  freqDays: number;   // from confessionFrequencyDays(rule.confession)
}

// Confession is the one vital with no canon check-off behind it — you don't
// tick it off daily, you go. So it is scored from the recorded dates against
// the rule's cadence: over the tracked window, how many confessions the rule
// asked for, and how many actually happened.
//
// The window opens at the vitals epoch if one is set, else at the first day
// the canon was recorded — so the card doesn't hold a brand-new member to a
// cadence that predates them. Nothing is "due" until a full interval has
// passed, which keeps a member who confessed yesterday off a 0% reading.
function confessionVital(
  history: CanonHistory,
  since: string | null | undefined,
  { dates, freqDays }: ConfessionInput,
): { due: number; done: number } {
  const recorded = Object.keys(history).sort();
  const start = since ?? recorded[0];
  if (!start || freqDays <= 0) return { due: 0, done: 0 };

  const today = localDateStr(new Date());
  const days = Math.floor(
    (new Date(`${today}T12:00:00`).getTime() - new Date(`${start}T12:00:00`).getTime()) / 86400000,
  );
  if (days < freqDays) return { due: 0, done: 0 };   // first interval still open

  const due = Math.floor(days / freqDays);
  const inWindow = dates.filter(d => d >= start && d <= today).length;
  return { due, done: Math.min(inWindow, due) };     // extra confessions don't exceed 100%
}
