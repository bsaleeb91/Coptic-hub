// lib/psalms/store.ts
// Spaced-repetition store for memorizing the Psalms, ported from Nepsis. The
// unit of selection and tracking is an "item" — either a whole psalm ("5") or a
// single section of Psalm 118 ("118#3"). Persisted with AsyncStorage; a summary
// + full snapshot is mirrored to Supabase agent_progress by lib/psalms/sync.ts
// so progress survives a reinstall and can surface to the Father of Confession.

import AsyncStorage from '@react-native-async-storage/async-storage';
import { itemUnitCount as unitCount } from './psalter';

const K_SELECTION = 'poimen.psalm.selection';
const K_CARDS     = 'poimen.psalm.cards';
const K_RECITE    = 'poimen.psalm.recite';
const K_STREAK    = 'poimen.psalm.streak';
const K_NEWPERDAY = 'poimen.psalm.newPerDay';

export const NEW_PER_SESSION = 5;
export const NEW_PER_DAY_OPTIONS = [1, 3, 5, 10, 15, 20];
export const MAX_REVIEWS_PER_SESSION = 20;
export const MASTERED_INTERVAL = 21; // days — a part is considered "mature"

export type Grade = 'again' | 'hard' | 'good' | 'easy';

export interface PartCard {
  item: string;
  part: number;
  reps: number;
  intervalDays: number;
  ease: number;
  due: string;   // YYYY-MM-DD
}

export const cardId = (item: string, part: number) => `${item}:${part}`;

// LOCAL calendar date (not UTC) — reviews unlock on the next local calendar
// day, not 24h after the moment a portion was learned. Using toISOString here
// mixed UTC (todayStr) with local (setDate), which pushed evening-learned
// portions a day late in timezones behind UTC.
function localStr(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
function todayStr(): string { return localStr(new Date()); }
function addDaysStr(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return localStr(d);
}

async function readJSON<T>(key: string, fallback: T): Promise<T> {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}
async function writeJSON(key: string, value: unknown): Promise<void> {
  try { await AsyncStorage.setItem(key, JSON.stringify(value)); } catch {}
}

// ─── Selection (which items, in what order) ───────────────────────────────────

export async function loadSelection(): Promise<string[]> {
  const arr = await readJSON<any[]>(K_SELECTION, []);
  return arr.map(String); // migrate legacy number[] → string ids
}

export async function saveSelection(items: string[]): Promise<void> {
  await writeJSON(K_SELECTION, items);
}

// ─── Cards ────────────────────────────────────────────────────────────────────

let _cards: Record<string, PartCard> | null = null;

async function cards(): Promise<Record<string, PartCard>> {
  if (!_cards) _cards = await readJSON<Record<string, PartCard>>(K_CARDS, {});
  return _cards;
}

export async function loadCards(): Promise<Record<string, PartCard>> {
  return { ...(await cards()) };
}

export async function review(item: string, part: number, existing: PartCard | undefined, grade: Grade): Promise<PartCard> {
  let reps = existing?.reps ?? 0;
  let prev = existing?.intervalDays ?? 0;
  let ease = existing?.ease ?? 2.5;
  const isNew = reps === 0;

  let intervalDays: number;
  switch (grade) {
    case 'again':
      ease = Math.max(1.3, ease - 0.2);
      reps = 0;
      intervalDays = 1;
      break;
    case 'hard':
      ease = Math.max(1.3, ease - 0.15);
      intervalDays = isNew ? 1 : Math.max(1, Math.round(prev * 1.2));
      reps += 1;
      break;
    case 'good':
      intervalDays = isNew ? 1 : Math.max(1, Math.round(prev * ease));
      reps += 1;
      break;
    case 'easy':
    default:
      ease = ease + 0.15;
      intervalDays = isNew ? 3 : Math.max(1, Math.round(prev * ease * 1.5));
      reps += 1;
      break;
  }

  const card: PartCard = { item, part, reps, intervalDays, ease, due: addDaysStr(intervalDays) };
  const map = await cards();
  map[cardId(item, part)] = card;
  await writeJSON(K_CARDS, map);
  return card;
}

// ─── Queue & stats (scoped to the selected items) ─────────────────────────────

export function isDue(card: PartCard): boolean {
  return card.due <= todayStr();
}

export interface PsalmStats {
  totalParts: number;
  newCount: number;
  learning: number;
  mastered: number;
  dueToday: number;
}

export function computeStats(selection: string[], cardMap: Record<string, PartCard>): PsalmStats {
  let totalParts = 0, learning = 0, mastered = 0, dueToday = 0, started = 0;
  for (const it of selection) {
    const parts = unitCount(it);
    totalParts += parts;
    for (let i = 0; i < parts; i++) {
      const c = cardMap[cardId(it, i)];
      if (!c) continue;
      started++;
      if (c.intervalDays >= MASTERED_INTERVAL) mastered++; else learning++;
      if (isDue(c)) dueToday++;
    }
  }
  return { totalParts, newCount: totalParts - started, learning, mastered, dueToday };
}

export function portionsMature(item: string, cardMap: Record<string, PartCard>): { mature: number; total: number } {
  const total = unitCount(item);
  let mature = 0;
  for (let i = 0; i < total; i++) {
    const c = cardMap[cardId(item, i)];
    if (c && c.intervalDays >= MASTERED_INTERVAL) mature++;
  }
  return { mature, total };
}

// An item is "worked through" once every portion has been answered correctly at
// least once (reps >= 1). New cards for the next item don't begin until then.
export function workedThrough(item: string, cardMap: Record<string, PartCard>): boolean {
  const total = unitCount(item);
  if (total === 0) return true;
  for (let i = 0; i < total; i++) {
    const c = cardMap[cardId(item, i)];
    if (!c || c.reps < 1) return false;
  }
  return true;
}

// The item currently being learned: the first in order not yet worked through.
export function learningItem(selection: string[], cardMap: Record<string, PartCard>): string | null {
  for (const it of selection) {
    if (!workedThrough(it, cardMap)) return it;
  }
  return null;
}

// Every portion of an item has reached the mature interval — the item graduates
// from portion review to whole-passage recitation.
export function isFullyMature(item: string, cardMap: Record<string, PartCard>): boolean {
  const { mature, total } = portionsMature(item, cardMap);
  return total > 0 && mature === total;
}

// Due portion reviews. A portion is reviewable only once it has been *learned*
// (answered correctly at least once, reps >= 1) and its scheduled date has
// arrived — so a portion learned today (due tomorrow at the earliest) is never
// reviewed the same day, and a portion still being learned (no card, or graded
// "Wrong" so reps is still 0) stays in the learning queue, not here. Fully
// mature passages are excluded: they are reviewed as a whole recitation instead.
export function dueQueue(selection: string[], cardMap: Record<string, PartCard>): { item: string; part: number }[] {
  const due: { item: string; part: number }[] = [];
  for (const it of selection) {
    if (isFullyMature(it, cardMap)) continue;
    const parts = unitCount(it);
    for (let i = 0; i < parts; i++) {
      const c = cardMap[cardId(it, i)];
      if (c && c.reps >= 1 && isDue(c)) due.push({ item: it, part: i });
    }
  }
  return due.slice(0, MAX_REVIEWS_PER_SESSION);
}

// Brand-new cards, only from the one item currently being learned, in order, up
// to the daily budget — you learn one passage at a time. A portion counts as
// still-to-learn until it has been answered correctly once (no card, or reps <
// 1 after a "Wrong"), so a passage isn't finished — and the next one doesn't
// begin — until every portion has been graded Hard/Good/Easy at least once.
export function newQueue(selection: string[], cardMap: Record<string, PartCard>, newLimit: number = NEW_PER_SESSION): { item: string; part: number }[] {
  const fresh: { item: string; part: number }[] = [];
  const lp = learningItem(selection, cardMap);
  if (lp != null) {
    const parts = unitCount(lp);
    for (let i = 0; i < parts && fresh.length < newLimit; i++) {
      const c = cardMap[cardId(lp, i)];
      if (!c || c.reps < 1) fresh.push({ item: lp, part: i });
    }
  }
  return fresh;
}

export function buildQueue(
  selection: string[],
  cardMap: Record<string, PartCard>,
  newLimit: number = NEW_PER_SESSION,
): { item: string; part: number }[] {
  return [...dueQueue(selection, cardMap), ...newQueue(selection, cardMap, newLimit)];
}

// ─── Whole-item recitation test ───────────────────────────────────────────────

export type ReciteState = 'learning' | 'ready' | 'memorized' | 'retest';

export interface ReciteCard {
  item: string;
  reps: number;
  intervalDays: number;
  due: string;
  last: string;
}

export function reciteState(item: string, cardMap: Record<string, PartCard>, recite: Record<string, ReciteCard>): ReciteState {
  const { mature, total } = portionsMature(item, cardMap);
  if (total === 0 || mature < total) return 'learning';
  const r = recite[item];
  if (!r || r.reps === 0) return 'ready';
  return r.due <= todayStr() ? 'retest' : 'memorized';
}

export async function loadRecite(): Promise<Record<string, ReciteCard>> {
  return readJSON<Record<string, ReciteCard>>(K_RECITE, {});
}

const RECITE_LADDER = [1, 3, 7, 16, 35, 75, 150, 365];
export type ReciteGrade = 'pass' | 'partial' | 'fail';
const ladderInterval = (reps: number) =>
  reps <= 0 ? 0 : RECITE_LADDER[Math.min(reps - 1, RECITE_LADDER.length - 1)];

export async function reviewRecite(item: string, existing: ReciteCard | undefined, grade: ReciteGrade): Promise<ReciteCard> {
  let reps = existing?.reps ?? 0;
  let intervalDays: number;
  if (grade === 'pass') {
    reps += 1;
    intervalDays = ladderInterval(reps);
  } else if (grade === 'partial') {
    reps = Math.max(1, reps - 1);
    intervalDays = ladderInterval(reps);
  } else {
    reps = 0;
    intervalDays = 0;
  }
  const card: ReciteCard = {
    item, reps, intervalDays,
    due: intervalDays <= 0 ? todayStr() : addDaysStr(intervalDays),
    last: todayStr(),
  };
  const map = await loadRecite();
  map[item] = card;
  await writeJSON(K_RECITE, map);
  return card;
}

// ─── Unified review queue (portion clozes + whole-passage recitations) ────────
// A review unit is either a single due portion (cloze) of a passage still being
// matured, or a whole-passage recitation for a passage whose portions are all
// mature (reviewed in full, not portion by portion). Passages are visited in
// selection order so each one's review comes up as a unit in turn.

export type ReviewUnit =
  | { item: string; kind: 'portion'; part: number }
  | { item: string; kind: 'recite' };

export function reviewQueue(
  selection: string[],
  cardMap: Record<string, PartCard>,
  reciteMap: Record<string, ReciteCard>,
): ReviewUnit[] {
  const units: ReviewUnit[] = [];
  for (const it of selection) {
    const st = reciteState(it, cardMap, reciteMap);
    if (st === 'ready' || st === 'retest') {
      units.push({ item: it, kind: 'recite' });          // recite the whole passage
    } else if (st === 'learning') {
      for (const { part } of dueQueue([it], cardMap)) {   // due portions only
        units.push({ item: it, kind: 'portion', part });
      }
    }
    // 'memorized' — recited recently, nothing due now
  }
  return units.slice(0, MAX_REVIEWS_PER_SESSION);
}

// ─── Streak ───────────────────────────────────────────────────────────────────

export interface Streak { current: number; last: string | null; }

export async function loadStreak(): Promise<Streak> {
  return readJSON<Streak>(K_STREAK, { current: 0, last: null });
}

export async function recordReviewDay(): Promise<Streak> {
  const today = todayStr();
  const cur = await loadStreak();
  if (cur.last === today) return cur;
  const yesterday = addDaysStr(-1);
  const next: Streak = { current: cur.last === yesterday ? cur.current + 1 : 1, last: today };
  await writeJSON(K_STREAK, next);
  return next;
}

// ─── New-cards-per-day setting ────────────────────────────────────────────────

export async function loadNewPerDay(): Promise<number> {
  const n = await readJSON<number>(K_NEWPERDAY, NEW_PER_SESSION);
  return Number.isFinite(n) ? n : NEW_PER_SESSION;
}

export async function saveNewPerDay(n: number): Promise<void> {
  await writeJSON(K_NEWPERDAY, n);
}

// ─── Snapshot import/export (for cloud sync in lib/psalms/sync.ts) ─────────────

export interface PsalmSnapshot {
  selection: string[];
  cards: Record<string, PartCard>;
  recite: Record<string, ReciteCard>;
  streak: Streak;
  newPerDay: number;
}

export async function exportState(): Promise<PsalmSnapshot> {
  const [selection, cardMap, recite, streak, newPerDay] = await Promise.all([
    loadSelection(), loadCards(), loadRecite(), loadStreak(), loadNewPerDay(),
  ]);
  return { selection, cards: cardMap, recite, streak, newPerDay };
}

// Overwrite local state with a snapshot (last-write-wins from the cloud). Resets
// the in-memory card cache so subsequent reads reflect the imported data.
export async function importState(snap: PsalmSnapshot): Promise<void> {
  _cards = snap.cards ?? {};
  await Promise.all([
    writeJSON(K_SELECTION, snap.selection ?? []),
    writeJSON(K_CARDS, snap.cards ?? {}),
    writeJSON(K_RECITE, snap.recite ?? {}),
    writeJSON(K_STREAK, snap.streak ?? { current: 0, last: null }),
    writeJSON(K_NEWPERDAY, snap.newPerDay ?? NEW_PER_SESSION),
  ]);
}

export async function isLocalEmpty(): Promise<boolean> {
  const sel = await loadSelection();
  const c = await loadCards();
  return sel.length === 0 && Object.keys(c).length === 0;
}
