// lib/canon/keys.ts
// Canon item-key helpers. Defined in vitals.ts (which imports nothing, so the
// test runner can load it) and re-exported here, where callers expect them.
export { weeklyServiceKey, isWeeklyServiceKey, serviceKeyOf } from './vitals';
