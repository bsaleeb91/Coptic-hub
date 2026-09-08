// lib/canon/service-count.test.ts
// Counted service commitments gained a per-service frequency, so communion can
// be monthly while liturgy stays weekly. Two things must hold: saves written
// before that change keep their meaning, and each service is scored in its own
// period rather than a shared week.
//
// normalizeServiceCounts and the log both live behind the storage alias, so the
// shapes are exercised through the pure period arithmetic they are built on.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { periodStart, periodEnd, nextPeriodStart, maxPerPeriod, parseDate, dateStr } from './periods.ts';

// Mirror of normalizeServiceCounts' migration branch — a bare number meant
// "per week" before frequencies existed.
const FREQS = ['Weekly', 'Every 2 weeks', 'Monthly', 'Every 2 months', 'Quarterly'];
function migrate(raw: any): Record<string, { n: number; freq: string }> {
  const out: Record<string, { n: number; freq: string }> = {};
  for (const [k, v] of Object.entries<any>(raw ?? {})) {
    const legacy = typeof v === 'number' || typeof v === 'string';
    const n = Math.floor(Number(legacy ? v : v?.n));
    if (!Number.isFinite(n) || n <= 0) continue;
    const rawFreq = legacy ? 'Weekly' : String(v?.freq ?? 'Weekly');
    const freq = FREQS.includes(rawFreq) ? rawFreq : 'Weekly';
    out[k] = { n: Math.min(n, maxPerPeriod(freq)), freq };
  }
  return out;
}

test('a pre-frequency save keeps its meaning as a weekly count', () => {
  const migrated = migrate({ liturgy: 2, matins: 1 });
  assert.deepEqual(migrated.liturgy, { n: 2, freq: 'Weekly' });
  assert.deepEqual(migrated.matins, { n: 1, freq: 'Weekly' });
});

test('zero and junk counts are dropped, not migrated to a phantom commitment', () => {
  const migrated = migrate({ liturgy: 0, matins: null, communion: 'x', vespers: {} });
  assert.deepEqual(Object.keys(migrated), []);
});

test('an unknown frequency falls back to weekly rather than breaking bucketing', () => {
  assert.deepEqual(migrate({ communion: { n: 1, freq: 'Fortnightly-ish' } }).communion,
    { n: 1, freq: 'Weekly' });
});

test('a count is capped at one per day of its own period', () => {
  assert.equal(migrate({ communion: { n: 99, freq: 'Weekly' } }).communion.n, 7);
  assert.equal(migrate({ communion: { n: 99, freq: 'Monthly' } }).communion.n, 31);
  assert.equal(migrate({ liturgy: 99 }).liturgy.n, 7);   // legacy → weekly cap
});

test('services with different cadences bucket independently on the same day', () => {
  // The bug this prevents: one shared week bucket, so a monthly communion
  // commitment would be scored and reset every week.
  const day = parseDate('2026-09-17');
  const weekly = periodStart('Weekly', day);
  const monthly = periodStart('Monthly', day);
  assert.notEqual(weekly, monthly);
  assert.equal(monthly, '2026-09-01');
  assert.equal(periodEnd('Monthly', monthly), '2026-09-30');
});

test('a monthly commitment stays open across week boundaries', () => {
  const freq = 'Monthly';
  const start = periodStart(freq, parseDate('2026-09-03'));
  // Four dates spread across four different weeks, all one monthly period.
  for (const s of ['2026-09-03', '2026-09-10', '2026-09-17', '2026-09-28']) {
    assert.equal(periodStart(freq, parseDate(s)), start, s);
  }
  // ...and the next month is a different one, so it closes and rescores.
  assert.notEqual(periodStart(freq, parseDate('2026-10-01')), start);
  assert.equal(nextPeriodStart(freq, start), '2026-10-01');
});

test('a period that has elapsed is scored on its own last day, inside itself', () => {
  for (const f of FREQS) {
    const start = periodStart(f, parseDate('2026-04-15'));
    const end = periodEnd(f, start);
    assert.ok(end >= start, f);
    assert.equal(periodStart(f, parseDate(end)), start, f);  // the day scored on belongs to the period
  }
});

test('weekly behaviour is unchanged for anyone who never sets a frequency', () => {
  const day = parseDate('2026-09-09');            // a Wednesday
  assert.equal(periodStart('Weekly', day), '2026-09-06');
  assert.equal(periodEnd('Weekly', '2026-09-06'), '2026-09-12');
  const sat = parseDate(periodEnd('Weekly', '2026-09-06'));
  assert.equal(sat.getDay(), 6);                   // still scored on the Saturday
  assert.equal(dateStr(sat), '2026-09-12');
});
