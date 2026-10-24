// Run: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { distanceKm, sortByDistance } from './geo.ts';

const fairfax = { latitude: 38.8304818, longitude: -77.357211 };
const arlington = { latitude: 38.8449272, longitude: -77.0844489 };
const westlake = { latitude: 41.462785, longitude: -81.9059449 };

test('distance between two nearby churches is about right', () => {
  const km = distanceKm(fairfax, arlington);
  assert.ok(km > 23 && km < 25, `got ${km}`);
  assert.equal(distanceKm(fairfax, fairfax), 0);
});

test('nearest church comes first', () => {
  const churches = [
    { name: 'Westlake', ...westlake },
    { name: 'Arlington', ...arlington },
    { name: 'Fairfax', ...fairfax },
  ];
  const here = { latitude: 38.85, longitude: -77.1 }; // near Arlington
  assert.deepEqual(sortByDistance(churches, here).map(c => c.name), ['Arlington', 'Fairfax', 'Westlake']);
});

test('churches without coordinates stay in the list, alphabetically, at the end', () => {
  const churches = [
    { name: 'Zeta', latitude: null, longitude: null },
    { name: 'Westlake', ...westlake },
    { name: 'Alpha', latitude: null, longitude: null },
  ];
  assert.deepEqual(sortByDistance(churches, fairfax).map(c => c.name), ['Westlake', 'Alpha', 'Zeta']);
});

test('does not change the list it was given', () => {
  const churches = [{ name: 'B', ...westlake }, { name: 'A', ...fairfax }];
  sortByDistance(churches, fairfax);
  assert.deepEqual(churches.map(c => c.name), ['B', 'A']);
});
