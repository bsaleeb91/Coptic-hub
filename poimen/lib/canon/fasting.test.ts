// lib/canon/fasting.test.ts
// Guards the fasting calendar against the class of bug where a screen hardcodes
// its own fast window and drifts out of step with lib/canon/fasting. Run with:
//   npm test
//
// The dashboard header once read "St. Mary's Fast · Day 1" on Aug 1 — six days
// before the fast opens — because it used the day-of-month as the day number.
// The Apostles' Fast was hardcoded to 2026 and started a week early. Both are
// covered below.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  orthodoxPascha,
  churchFastsForYear,
  currentFast,
  isChurchFast,
  isFastDay,
  isHolyFifty,
  prostrationsAllowed,
} from './fasting.ts';

const at = (y: number, m: number, d: number) => new Date(y, m - 1, d);
const iso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const fastNamed = (y: number, name: string) => {
  const f = churchFastsForYear(y).find(x => x.name === name);
  assert.ok(f, `no fast named ${name} in ${y}`);
  return f;
};

test('Orthodox Pascha matches the known Gregorian dates', () => {
  assert.equal(iso(orthodoxPascha(2026)), '2026-04-12');
  assert.equal(iso(orthodoxPascha(2027)), '2027-05-02');
  assert.equal(iso(orthodoxPascha(2028)), '2028-04-16');
});

test("St. Mary's Fast runs Aug 7-21, and does not start early", () => {
  const f = fastNamed(2026, "St. Mary's Fast");
  assert.equal(iso(f.start), '2026-08-07');
  assert.equal(iso(f.end), '2026-08-21');

  // The original bug: Aug 1 reported "Day 1".
  assert.equal(currentFast(at(2026, 8, 1)), null);
  assert.equal(currentFast(at(2026, 8, 6)), null);

  assert.equal(currentFast(at(2026, 8, 7))?.day, 1);
  assert.equal(currentFast(at(2026, 8, 8))?.day, 2);
  assert.equal(currentFast(at(2026, 8, 21))?.day, 15);
  assert.equal(currentFast(at(2026, 8, 21))?.length, 15);
  // Aug 22 is the Assumption — the fast is over.
  assert.equal(currentFast(at(2026, 8, 22)), null);
});

test("Apostles' Fast follows Pascha, not a hardcoded year", () => {
  // Day after Pentecost (Pascha + 50) through Jul 11; feast is Jul 12.
  assert.equal(iso(fastNamed(2026, "Apostles' Fast").start), '2026-06-01');
  assert.equal(iso(fastNamed(2027, "Apostles' Fast").start), '2027-06-21');
  assert.equal(iso(fastNamed(2028, "Apostles' Fast").start), '2028-06-05');

  for (const y of [2026, 2027, 2028]) {
    assert.equal(iso(fastNamed(y, "Apostles' Fast").end), `${y}-07-11`);
  }

  // The old hardcoded window opened May 25, 2026 — a week early.
  assert.equal(currentFast(at(2026, 5, 25)), null);
  assert.equal(currentFast(at(2026, 6, 1))?.name, "Apostles' Fast");
  assert.equal(currentFast(at(2026, 6, 1))?.day, 1);
  // The year the hardcoded window would have silently vanished.
  assert.equal(currentFast(at(2027, 6, 21))?.name, "Apostles' Fast");
});

test('Nativity Fast spans the new year and keeps counting', () => {
  const f = fastNamed(2026, 'Nativity Fast');
  assert.equal(iso(f.start), '2026-11-25');
  assert.equal(iso(f.end), '2027-01-06');

  assert.equal(currentFast(at(2026, 11, 24)), null);
  assert.equal(currentFast(at(2026, 11, 25))?.day, 1);
  assert.equal(currentFast(at(2026, 12, 25))?.name, 'Nativity Fast');
  // Day numbering must not reset on Jan 1.
  assert.equal(currentFast(at(2027, 1, 1))?.day, 38);
  assert.equal(currentFast(at(2027, 1, 6))?.day, 43);
  assert.equal(currentFast(at(2027, 1, 6))?.length, 43);
  // Jan 7 is the Nativity.
  assert.equal(currentFast(at(2027, 1, 7)), null);
});

test('Great Lent and Holy Week run 55 days up to Holy Saturday', () => {
  const f = fastNamed(2026, 'Great Lent');
  assert.equal(iso(f.start), '2026-02-16');
  assert.equal(iso(f.end), '2026-04-11');
  assert.equal(currentFast(f.start)?.length, 55);
  // Pascha itself is not a fast day.
  assert.equal(currentFast(at(2026, 4, 12)), null);
});

test("Jonah's Fast is the three days ending 67 days before Pascha", () => {
  const f = fastNamed(2026, "Jonah's Fast");
  assert.equal(iso(f.start), '2026-02-02');
  assert.equal(iso(f.end), '2026-02-04');
  assert.equal(currentFast(f.start)?.length, 3);
});

test('fasting seasons never overlap each other', () => {
  for (const y of [2026, 2027, 2028, 2029, 2030]) {
    const all = [...churchFastsForYear(y - 1), ...churchFastsForYear(y)]
      .sort((a, b) => a.start.getTime() - b.start.getTime());
    for (let i = 1; i < all.length; i++) {
      assert.ok(
        all[i].start > all[i - 1].end,
        `${y}: ${all[i].name} starts before ${all[i - 1].name} ends`,
      );
    }
  }
});

test('isChurchFast agrees with currentFast', () => {
  const d = at(2026, 1, 1);
  for (let i = 0; i < 730; i++) {
    assert.equal(isChurchFast(d), currentFast(d) !== null, `mismatch on ${iso(d)}`);
    d.setDate(d.getDate() + 1);
  }
});

test('Wednesdays and Fridays fast outside the Holy Fifty', () => {
  // Aug 5 2026 is a Wednesday, outside any season.
  assert.equal(currentFast(at(2026, 8, 5)), null);
  assert.equal(isFastDay(at(2026, 8, 5)), true);
  // Saturday, no season.
  assert.equal(isFastDay(at(2026, 8, 1)), false);
  // Wednesday inside the Holy Fifty (Pascha Apr 12 → Pentecost May 31).
  assert.equal(isHolyFifty(at(2026, 4, 29)), true);
  assert.equal(isFastDay(at(2026, 4, 29)), false);
});

test('prostrations pause on weekends and through the Holy Fifty', () => {
  assert.equal(prostrationsAllowed(at(2026, 8, 1)), false); // Saturday
  assert.equal(prostrationsAllowed(at(2026, 8, 2)), false); // Sunday
  assert.equal(prostrationsAllowed(at(2026, 8, 3)), true);  // Monday
  assert.equal(prostrationsAllowed(at(2026, 4, 29)), false); // Holy Fifty
});
