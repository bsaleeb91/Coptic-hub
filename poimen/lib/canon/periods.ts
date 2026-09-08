// lib/canon/periods.ts
// Cadence periods for commitments counted "n times per <period>".
//
// Church services were once countable per week only, while Heart of Service
// commitments, priest-assigned components and confession all took the fuller
// set (Weekly … Quarterly). That left communion — a service — unable to express
// the rhythm most people actually keep it at. This module is the shared period
// arithmetic that lets every counted commitment use the same frequencies.
//
// Deliberately imports nothing, so it can be unit-tested without the bundler's
// path alias (see periods.test.ts).

export type Freq = 'Weekly' | 'Every 2 weeks' | 'Monthly' | 'Every 2 months' | 'Quarterly';

// Multi-week and multi-month periods need a fixed anchor, or "every 2 weeks"
// would mean something different depending on when you asked. 2000-01-02 was a
// Sunday, which also makes it a clean start for week-based periods.
const ANCHOR_Y = 2000, ANCHOR_M = 0, ANCHOR_D = 2;

const pad = (n: number) => String(n).padStart(2, '0');
export const dateStr = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const parseDate = (s: string) => new Date(`${s}T12:00:00`);

const midnight = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const DAY = 86400000;

// How the period reads in a label: "2 of 3 this month".
export function periodNoun(freq: string): string {
  switch (freq) {
    case 'Every 2 weeks':  return 'fortnight';
    case 'Monthly':        return 'month';
    case 'Every 2 months': return '2 months';
    case 'Quarterly':      return 'quarter';
    default:               return 'week';
  }
}

// "× / week", "× / month" — the unit shown beside a stepper.
export function periodUnit(freq: string): string {
  switch (freq) {
    case 'Every 2 weeks':  return '× / 2 weeks';
    case 'Monthly':        return '× / month';
    case 'Every 2 months': return '× / 2 months';
    case 'Quarterly':      return '× / quarter';
    default:               return '× / week';
  }
}

// The most times a commitment can sensibly be logged in one period — one per
// day, since attendance is logged by date and a date can only be logged once.
export function maxPerPeriod(freq: string): number {
  switch (freq) {
    case 'Every 2 weeks':  return 14;
    case 'Monthly':        return 31;
    case 'Every 2 months': return 62;
    case 'Quarterly':      return 92;
    default:               return 7;
  }
}

const sundayOf = (d: Date) => {
  const x = midnight(d);
  x.setDate(x.getDate() - x.getDay());
  return x;
};

// The local YYYY-MM-DD the period containing `date` begins on. Every function
// that buckets attendance agrees on this, so a logged date always lands in
// exactly one period.
export function periodStart(freq: string, date: Date): string {
  switch (freq) {
    case 'Every 2 weeks': {
      const sun = sundayOf(date);
      const anchor = new Date(ANCHOR_Y, ANCHOR_M, ANCHOR_D);
      const weeks = Math.floor((sun.getTime() - anchor.getTime()) / (7 * DAY));
      // Two-week blocks counted from the anchor; odd weeks belong to the block
      // that opened the week before.
      if (((weeks % 2) + 2) % 2 === 1) sun.setDate(sun.getDate() - 7);
      return dateStr(sun);
    }
    case 'Monthly':
      return dateStr(new Date(date.getFullYear(), date.getMonth(), 1));
    case 'Every 2 months': {
      const months = (date.getFullYear() - ANCHOR_Y) * 12 + date.getMonth() - ANCHOR_M;
      const m = date.getMonth() - (((months % 2) + 2) % 2);
      return dateStr(new Date(date.getFullYear(), m, 1));
    }
    case 'Quarterly':
      return dateStr(new Date(date.getFullYear(), Math.floor(date.getMonth() / 3) * 3, 1));
    default:
      return dateStr(sundayOf(date));
  }
}

// The start of the period after the one beginning at `start`.
export function nextPeriodStart(freq: string, start: string): string {
  const d = parseDate(start);
  switch (freq) {
    case 'Every 2 weeks':  d.setDate(d.getDate() + 14); break;
    case 'Monthly':        d.setMonth(d.getMonth() + 1); break;
    case 'Every 2 months': d.setMonth(d.getMonth() + 2); break;
    case 'Quarterly':      d.setMonth(d.getMonth() + 3); break;
    default:               d.setDate(d.getDate() + 7); break;
  }
  return dateStr(new Date(d.getFullYear(), d.getMonth(), d.getDate()));
}

// The last day of the period beginning at `start` — where an elapsed period's
// adherence is written, so it lands inside the window it describes.
export function periodEnd(freq: string, start: string): string {
  const next = parseDate(nextPeriodStart(freq, start));
  next.setDate(next.getDate() - 1);
  return dateStr(new Date(next.getFullYear(), next.getMonth(), next.getDate()));
}

// Whether the period beginning at `start` has fully elapsed as of `now`.
export function periodElapsed(freq: string, start: string, now = new Date()): boolean {
  return dateStr(midnight(now)) >= nextPeriodStart(freq, start);
}
