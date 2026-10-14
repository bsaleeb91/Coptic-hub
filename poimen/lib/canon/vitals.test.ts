// lib/canon/vitals.test.ts
// The rule this file guards: anything shown in Spiritual Vitals must be
// trackable in the Canon. Each test below pins one way that used to fail.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { VITAL_CATEGORIES, computeVitals, type CanonHistory } from './vitals.ts';
import { serviceKeyOf, weeklyServiceKey } from './vitals.ts';


const cat = (key: string) => VITAL_CATEGORIES.find(c => c.key === key)!;
const day = (due: string[], done: string[]) => ({ due, done });

test('serviceKeyOf recovers the service from either commitment style', () => {
  assert.equal(serviceKeyOf('svc_liturgy'), 'liturgy');
  assert.equal(serviceKeyOf(weeklyServiceKey('communion')), 'communion');
  assert.equal(serviceKeyOf('hour_prime'), null);
  assert.equal(serviceKeyOf('fast'), null);
});

test('communion does not get absorbed into the liturgy vital', () => {
  // The bug: liturgy matched on a `svc_` prefix, so svc_communion counted as
  // liturgical attendance and communion could never read separately.
  assert.equal(cat('liturgy').match('svc_communion'), false);
  assert.equal(cat('communion').match('svc_communion'), true);
  assert.equal(cat('liturgy').match('svc_liturgy'), true);
  assert.equal(cat('communion').match('svc_liturgy'), false);
});

test('liturgy still covers the other services, both commitment styles', () => {
  for (const k of ['matins', 'church_vespers', 'midnight_praise']) {
    assert.equal(cat('liturgy').match(`svc_${k}`), true, k);
    assert.equal(cat('liturgy').match(weeklyServiceKey(k)), true, k);
  }
});

test('an attendance logged separately from liturgy scores separately', () => {
  const history: CanonHistory = {
    '2026-09-06': day(['svc_liturgy', 'svc_communion'], ['svc_liturgy']),
  };
  const stats = computeVitals(history);
  const liturgy = stats.find(s => s.key === 'liturgy')!;
  const communion = stats.find(s => s.key === 'communion')!;
  assert.deepEqual([liturgy.due, liturgy.done, liturgy.pct], [1, 1, 100]);
  assert.deepEqual([communion.due, communion.done, communion.pct], [1, 0, 0]);
});

test('confession reads null, not a permanent dash, and scores from dates', () => {
  const history: CanonHistory = {};
  for (let i = 0; i < 70; i++) {
    const d = new Date(Date.now() - i * 86400000).toISOString().slice(0, 10);
    history[d] = day([], []);
  }
  const start = Object.keys(history).sort()[0];
  const conf = (dates: string[]) =>
    computeVitals(history, null, { dates, freqDays: 31 }).find(s => s.key === 'confession')!;

  // ~69 days tracked at a monthly cadence → 2 confessions expected.
  assert.equal(conf([]).due, 2);
  assert.equal(conf([]).done, 0);
  assert.equal(conf([]).pct, 0);

  const both = conf([start, new Date(Date.now() - 5 * 86400000).toISOString().slice(0, 10)]);
  assert.equal(both.done, 2);
  assert.equal(both.pct, 100);
});

test('a new member is not held to a cadence that predates them', () => {
  const today = new Date().toISOString().slice(0, 10);
  const stats = computeVitals({ [today]: day([], []) }, null, { dates: [], freqDays: 31 });
  const confession = stats.find(s => s.key === 'confession')!;
  assert.equal(confession.due, 0);
  assert.equal(confession.pct, null);   // renders "—", not 0%
});

test('confessing more often than the rule asks cannot exceed 100%', () => {
  const history: CanonHistory = {};
  const dates: string[] = [];
  for (let i = 0; i < 40; i++) {
    const d = new Date(Date.now() - i * 86400000).toISOString().slice(0, 10);
    history[d] = day([], []);
    if (i % 5 === 0) dates.push(d);        // far more often than monthly
  }
  const confession = computeVitals(history, null, { dates, freqDays: 31 })
    .find(s => s.key === 'confession')!;
  assert.equal(confession.pct, 100);
  assert.ok(confession.done <= confession.due);
});
