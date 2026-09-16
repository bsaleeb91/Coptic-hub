// lib/reminders/phrasing.test.ts
// A notification is read on a lock screen, once, by someone who did not ask for
// it at that moment. There is no screen to check it against and no way to fix a
// sentence after the phone has already said it — so the sentence is tested.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatTime, stepTime, cleanLabel, describeItems } from './phrasing.ts';

// ─── formatTime ───────────────────────────────────────────────────────────────

test('midnight and noon are 12, not 0', () => {
  assert.equal(formatTime(0, 0), '12:00 AM');
  assert.equal(formatTime(12, 0), '12:00 PM');
});

test('the minute is always two digits', () => {
  assert.equal(formatTime(20, 0), '8:00 PM');
  assert.equal(formatTime(9, 5), '9:05 AM');
});

test('the AM/PM boundary falls where it should', () => {
  assert.equal(formatTime(11, 59), '11:59 AM');
  assert.equal(formatTime(12, 1), '12:01 PM');
  assert.equal(formatTime(23, 30), '11:30 PM');
});

// ─── stepTime ─────────────────────────────────────────────────────────────────

test('stepping forward crosses the hour', () => {
  assert.deepEqual(stepTime(19, 30, 30), { hour: 20, minute: 0 });
});

test('stepping back before midnight wraps to the end of the day', () => {
  assert.deepEqual(stepTime(0, 0, -30), { hour: 23, minute: 30 });
});

test('stepping forward past midnight wraps to the start of the day', () => {
  assert.deepEqual(stepTime(23, 30, 30), { hour: 0, minute: 0 });
});

test('a whole day of steps returns to where it began', () => {
  let t = { hour: 17, minute: 0 };
  for (let i = 0; i < 48; i++) t = stepTime(t.hour, t.minute, 30);
  assert.deepEqual(t, { hour: 17, minute: 0 });
});

// ─── cleanLabel ───────────────────────────────────────────────────────────────

test('the weekly-count suffix is dropped', () => {
  assert.equal(cleanLabel('Attend Vespers — 1 of 2 this week'), 'Attend Vespers');
});

test('a frequency and weekday suffix is dropped', () => {
  assert.equal(cleanLabel('Visit the sick · Mon, Wed'), 'Visit the sick');
});

test('a label with nothing to strip is left alone', () => {
  assert.equal(cleanLabel('Pray the Sixth Hour'), 'Pray the Sixth Hour');
});

// ─── describeItems ────────────────────────────────────────────────────────────

test('one item is its own sentence', () => {
  assert.equal(describeItems(['Pray the Sixth Hour']), 'Pray the Sixth Hour.');
});

test('two items are joined, and the second loses its capital', () => {
  assert.equal(
    describeItems(['Pray the Sixth Hour', 'Attend Vespers']),
    'Pray the Sixth Hour and attend Vespers.',
  );
});

test('three or more name two and count the rest', () => {
  assert.equal(
    describeItems(['Pray the Sixth Hour', 'Attend Vespers', 'Read 3 chapters', 'Keep the fast']),
    'Pray the Sixth Hour, attend Vespers, and 2 more.',
  );
});

test('the count is of what is left unnamed, not of everything', () => {
  assert.equal(describeItems(['A', 'Bb', 'Cc']), 'A, bb, and 1 more.');
});

// A priest's free-text component arrives verbatim and may be anything at all.
test('an all-caps label keeps its capitals mid-sentence', () => {
  assert.equal(
    describeItems(['Pray the Sixth Hour', 'PRAY FOR YOUR FAMILY']),
    'Pray the Sixth Hour and PRAY FOR YOUR FAMILY.',
  );
});

test('an already-lowercase label is not disturbed', () => {
  assert.equal(
    describeItems(['Pray the Sixth Hour', 'read a psalm']),
    'Pray the Sixth Hour and read a psalm.',
  );
});

test('an empty list produces nothing rather than a stray full stop', () => {
  assert.equal(describeItems([]), '');
});
