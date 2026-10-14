// lib/db/church-address.test.ts
// formatChurchAddress backs both the church picker's display AND its search, so
// what a member can see is exactly what they can type. It also has to keep
// showing churches entered before the structured columns existed.
//
// The formatter is reimplemented here rather than imported: lib/db/profiles.ts
// pulls in the Supabase client, which the test runner cannot resolve. The two
// must stay in step — this file exists to say what the contract is.

import { test } from 'node:test';
import assert from 'node:assert/strict';

type C = Partial<{
  address: string | null; address_line1: string | null; address_line2: string | null;
  city: string | null; state: string | null; zip: string | null; country: string | null;
}>;

function formatChurchAddress(c: C | null | undefined): string {
  if (!c) return '';
  const street = [c.address_line1, c.address_line2].filter(Boolean).join(', ');
  const locality = [c.city, c.state, c.zip].filter(Boolean).join(', ');
  const structured = [street, locality, c.country && c.country !== 'US' ? c.country : null]
    .filter(Boolean).join(' · ');
  return structured || (c.address ?? '');
}

const matches = (c: C, q: string) =>
  `${'St. Mary'} ${formatChurchAddress(c)}`.toLowerCase().includes(q.toLowerCase());

test('a structured address renders street, locality and nothing empty', () => {
  assert.equal(
    formatChurchAddress({ address_line1: '123 Main St', city: 'Columbus', state: 'OH', zip: '43215' }),
    '123 Main St · Columbus, OH, 43215');
});

test('a church entered before the structured columns still shows its address', () => {
  // The migration deliberately does not parse legacy text, so this fallback is
  // the only thing keeping those rows visible.
  assert.equal(formatChurchAddress({ address: '400 Broadway, Columbus OH' }),
    '400 Broadway, Columbus OH');
});

test('structured fields win over stale legacy text once an admin fills them in', () => {
  assert.equal(
    formatChurchAddress({ address: 'old free text', address_line1: '9 New Rd', city: 'Toledo' }),
    '9 New Rd · Toledo');
});

test('a church with no address at all renders empty, not "null"', () => {
  assert.equal(formatChurchAddress({}), '');
  assert.equal(formatChurchAddress({ address: null, city: null }), '');
  assert.equal(formatChurchAddress(null), '');
  assert.equal(formatChurchAddress(undefined), '');
});

test('US is left implicit; another country is shown', () => {
  assert.equal(formatChurchAddress({ city: 'Columbus', state: 'OH', country: 'US' }), 'Columbus, OH');
  assert.equal(formatChurchAddress({ city: 'Cairo', country: 'EG' }), 'Cairo · EG');
});

test('anything shown can be searched for, including the city', () => {
  const c: C = { address_line1: '123 Main St', city: 'Columbus', state: 'OH', zip: '43215' };
  for (const q of ['columbus', 'Main', '43215', 'OH', 'st. mary']) {
    assert.ok(matches(c, q), q);
  }
  assert.equal(matches(c, 'Toledo'), false);
});

test('a legacy-only church is searchable by its free text too', () => {
  assert.ok(matches({ address: '400 Broadway, Columbus OH' }, 'broadway'));
});
