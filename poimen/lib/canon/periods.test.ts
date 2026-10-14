// lib/canon/periods.test.ts
// Period bucketing has to be total and disjoint: every date falls in exactly
// one period, and consecutive periods abut with no gap. Everything that counts
// attendance depends on that.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  periodStart, nextPeriodStart, periodEnd, periodElapsed,
  periodNoun, periodUnit, maxPerPeriod, dateStr, parseDate,
} from './periods.ts';

const FREQS = ['Weekly', 'Every 2 weeks', 'Monthly', 'Every 2 months', 'Quarterly'];
const d = (s: string) => parseDate(s);

test('weekly periods start on Sunday', () => {
  assert.equal(periodStart('Weekly', d('2026-09-07')), '2026-09-06'); // Mon → Sun
  assert.equal(periodStart('Weekly', d('2026-09-06')), '2026-09-06'); // Sun → itself
  assert.equal(periodStart('Weekly', d('2026-09-12')), '2026-09-06'); // Sat → same week
});

test('monthly and quarterly periods align to the calendar', () => {
  assert.equal(periodStart('Monthly', d('2026-09-30')), '2026-09-01');
  assert.equal(periodStart('Quarterly', d('2026-09-30')), '2026-07-01');
  assert.equal(periodStart('Quarterly', d('2026-01-01')), '2026-01-01');
  assert.equal(periodStart('Quarterly', d('2026-12-31')), '2026-10-01');
});

test('every-2-weeks periods are anchored, not relative to today', () => {
  // Two dates 14 days apart must land in different periods; 7 days apart, same
  // period only if they share the block.
  const a = periodStart('Every 2 weeks', d('2026-09-07'));
  const b = periodStart('Every 2 weeks', d('2026-09-21'));
  assert.notEqual(a, b);
  assert.equal(nextPeriodStart('Every 2 weeks', a), b);
});

test('every-2-months periods pair up consistently', () => {
  const a = periodStart('Every 2 months', d('2026-09-15'));
  const b = periodStart('Every 2 months', d('2026-10-15'));
  assert.equal(a, b);                                   // same 2-month block
  assert.notEqual(a, periodStart('Every 2 months', d('2026-11-15')));
});

test('periods abut exactly — end is the day before the next start', () => {
  for (const f of FREQS) {
    const start = periodStart(f, d('2026-09-07'));
    const end = periodEnd(f, start);
    const next = nextPeriodStart(f, start);
    const afterEnd = parseDate(end);
    afterEnd.setDate(afterEnd.getDate() + 1);
    assert.equal(dateStr(afterEnd), next, f);
  }
});

test('every day of a year lands in exactly one period, and it contains that day', () => {
  for (const f of FREQS) {
    for (let i = 0; i < 365; i++) {
      const day = new Date(2026, 0, 1 + i);
      const start = periodStart(f, day);
      const end = periodEnd(f, start);
      const s = dateStr(day);
      assert.ok(s >= start && s <= end, `${f} ${s} not in ${start}..${end}`);
    }
  }
});

test('period membership is stable — any day in a period yields the same start', () => {
  for (const f of FREQS) {
    const start = periodStart(f, d('2026-05-20'));
    const end = periodEnd(f, start);
    for (let c = parseDate(start); dateStr(c) <= end; c.setDate(c.getDate() + 1)) {
      assert.equal(periodStart(f, new Date(c)), start, f);
    }
  }
});

test('a period is elapsed only once the next one has begun', () => {
  const start = periodStart('Monthly', d('2026-08-15'));
  assert.equal(periodElapsed('Monthly', start, d('2026-08-31')), false);
  assert.equal(periodElapsed('Monthly', start, d('2026-09-01')), true);
});

test('labels and caps are defined for every frequency', () => {
  for (const f of FREQS) {
    assert.ok(periodNoun(f).length > 0, f);
    assert.ok(periodUnit(f).startsWith('×'), f);
    assert.ok(maxPerPeriod(f) >= 7, f);
  }
  assert.equal(maxPerPeriod('Weekly'), 7);
  assert.equal(maxPerPeriod('Monthly'), 31);
});
