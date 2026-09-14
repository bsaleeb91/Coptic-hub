// Run: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  legacyContact, legacyChild, byBirthYear, needsSealing,
  type OpenedChild,
} from './pastoral-shape.ts';

const child = (id: string, birth_year: number | null): OpenedChild => ({ id, name: id, birth_year });

// ── legacy fallback ──────────────────────────────────────────

test('reads the pre-encryption plaintext columns', () => {
  const c = legacyContact({ phone: '555-0100', city: 'Jersey City', country: 'US' });
  assert.equal(c?.phone, '555-0100');
  assert.equal(c?.city, 'Jersey City');
  assert.equal(c?.address_line1, null);
});

// The column defaults to 'US', so every empty row carries one. Treating that
// as contact information would make the backfill re-seal empty rows forever.
test('a row holding only the country default is not contact information', () => {
  assert.equal(legacyContact({ country: 'US' }), null);
  assert.equal(legacyContact({ country: 'US', phone: null, city: null }), null);
});

test('an empty string is not a value', () => {
  assert.equal(legacyContact({ phone: '', city: '' }), null);
});

test('no row at all is not an empty row', () => {
  assert.equal(legacyContact(null), null);
});

test('a child needs only one of name or birth year to be real', () => {
  assert.deepEqual(legacyChild({ name: 'Mina', birth_year: 2015 }), { name: 'Mina', birth_year: 2015 });
  assert.deepEqual(legacyChild({ name: 'Mina' }), { name: 'Mina', birth_year: null });
  assert.deepEqual(legacyChild({ birth_year: 2015 }), { name: null, birth_year: 2015 });
  assert.equal(legacyChild({}), null);
});

// ── ordering ─────────────────────────────────────────────────

test('children sort oldest first, as the database used to order them', () => {
  const sorted = [child('c', 2018), child('a', 2010), child('b', 2015)].sort(byBirthYear);
  assert.deepEqual(sorted.map(c => c.id), ['a', 'b', 'c']);
});

test('an unknown birth year sorts last, not as year zero', () => {
  const sorted = [child('unknown', null), child('a', 2010), child('b', 2015)].sort(byBirthYear);
  assert.deepEqual(sorted.map(c => c.id), ['a', 'b', 'unknown']);
});

// ── sealing state ────────────────────────────────────────────

test('an unsealed row needs sealing', () => {
  assert.equal(needsSealing({ phone: '555-0100' }, null), true);
  assert.equal(needsSealing({ payload_self: null }, null), true);
});

test('a row sealed to the current FOC is left alone', () => {
  assert.equal(needsSealing({ payload_self: 'box1:x', payload_foc: 'box1:y', payload_foc_for: 'foc-1' }, 'foc-1'), false);
});

// The case that silently breaks the priest's view if missed: the member
// switched FOC, so payload_foc is sealed to someone who is no longer their
// priest. Both payloads look identical from outside.
test('a row sealed to a previous FOC must be re-sealed', () => {
  assert.equal(needsSealing({ payload_self: 'box1:x', payload_foc: 'box1:y', payload_foc_for: 'old-foc' }, 'foc-2'), true);
});

test('gaining a first FOC re-seals a row that had none', () => {
  assert.equal(needsSealing({ payload_self: 'box1:x', payload_foc: null, payload_foc_for: null }, 'foc-1'), true);
});

test('with no FOC, a self-sealed row is complete', () => {
  assert.equal(needsSealing({ payload_self: 'box1:x', payload_foc: null, payload_foc_for: null }, null), false);
});

test('a missing row needs nothing', () => {
  assert.equal(needsSealing(null, 'foc-1'), false);
});
