// src/data/agpeyaPsalter.ts
// The Psalms and prayers exactly as they appear in the Coptic Agpeya —
// superscriptions omitted, in the Agpeya's own English translation, grouped by
// the canonical hours. Psalm 118 is divided into its 22 traditional sections;
// every other psalm is a single part, as the Agpeya prays it.
//
// Beyond the psalter, each hour carries its own memorization items: the Gospel
// of the hour, its litanies (each one separately), and its absolution — plus
// the First Hour's fixed prayers (Come Let Us Kneel Down, Pauline Epistle,
// Faith of the Church, the Gloria, Trisagion, Hail to You, the Creed with its
// introduction, Holy Holy Holy, and the Conclusion of Every Hour), Graciously
// Accord in the Twelfth Hour, and the Prayer of the Veil. The Midnight Prayer
// is laid out as its three watches — three Gospels, three sets of litanies —
// with one absolution for the hour.

import RAW from './agpeyaPsalms.json';
import PRAYERS_RAW from './agpeyaPrayers.json';
import { classify, CATEGORY_META, PRAYER_KIND_META, CategoryMeta, PrayerKind } from './psalmMeta';

export interface AgpeyaHour {
  key: string;
  name: string;
  psalms: number[];
}

interface PsalmEntry {
  parts: string[];
  hours: string[];
}

const DATA = RAW as unknown as {
  hours: AgpeyaHour[];
  psalms: Record<string, PsalmEntry>;
};

export const HOURS: AgpeyaHour[] = DATA.hours;

export const PSALM_NUMBERS: number[] = Object.keys(DATA.psalms)
  .map(n => parseInt(n, 10))
  .sort((a, b) => a - b);

export function getParts(psalm: number): string[] {
  return DATA.psalms[String(psalm)]?.parts ?? [];
}

export function partCount(psalm: number): number {
  return getParts(psalm).length;
}

// ─── Agpeya prayers (Gospels, litanies, absolutions, fixed prayers) ───────────

export interface AgpeyaPrayer {
  title: string;
  kind: PrayerKind;
  parts: string[];
}

export interface HourSection {
  heading?: string;      // e.g. "First Watch" in the Midnight Prayer
  psalms?: number[];
  prayers?: string[];    // prayer ids, in the order they are prayed
}

export interface AgpeyaHourLayout {
  key: string;
  name: string;
  sections: HourSection[];
}

const PRAYER_DATA = PRAYERS_RAW as unknown as {
  prayers: Record<string, AgpeyaPrayer>;
  hours: AgpeyaHourLayout[];
};

// The full liturgical layout of every hour (including the Veil), used by the
// picker. Prayer items are selected/tracked as "p:<id>".
export const HOUR_LAYOUTS: AgpeyaHourLayout[] = PRAYER_DATA.hours;

const PRAYER_ITEM_PREFIX = 'p:';

export function isPrayerItem(id: string): boolean {
  return id.startsWith(PRAYER_ITEM_PREFIX);
}

export function prayerItemId(prayerId: string): ItemId {
  return PRAYER_ITEM_PREFIX + prayerId;
}

export function getPrayer(id: ItemId): AgpeyaPrayer | null {
  if (!isPrayerItem(id)) return null;
  return PRAYER_DATA.prayers[id.slice(PRAYER_ITEM_PREFIX.length)] ?? null;
}

// Memorization units: each Agpeya part is split into short, phrase-sized
// portions so the learner takes on a small piece at a time. We break at clause
// boundaries (commas, semicolons, colons, and sentence ends) and group up to a
// small word target.
const TARGET_WORDS = 11;
const MIN_TAIL = 4;

function chunk(text: string): string[] {
  // Split into clauses, keeping the trailing punctuation with each clause.
  const clauses = text.match(/[^,;:.!?]+[,;:.!?]*/g) ?? [text];
  const units: string[] = [];
  let cur = '';
  let words = 0;
  for (const clause of clauses) {
    const c = clause.trim();
    if (!c) continue;
    cur = cur ? `${cur} ${c}` : c;
    words += c.split(/\s+/).length;
    if (words >= TARGET_WORDS) { units.push(cur); cur = ''; words = 0; }
  }
  if (cur) {
    if (units.length && cur.split(/\s+/).length < MIN_TAIL) units[units.length - 1] += ` ${cur}`;
    else units.push(cur);
  }
  return units.length ? units : [text];
}

export interface Unit { text: string; part: number; }

function unitsFromParts(parts: string[]): Unit[] {
  const out: Unit[] = [];
  parts.forEach((p, pi) => {
    for (const t of chunk(p)) out.push({ text: t, part: pi });
  });
  return out;
}

export function getUnitList(psalm: number): Unit[] {
  return unitsFromParts(getParts(psalm));
}

export function getUnits(psalm: number): string[] {
  return getUnitList(psalm).map(u => u.text);
}

export function unitCount(psalm: number): number {
  return getUnitList(psalm).length;
}

// The text of the current section up to (but not including) the given unit —
// the "lead-up" shown as context during review.
export function leadUp(psalm: number, unitIndex: number): string {
  const units = getUnitList(psalm);
  const cur = units[unitIndex];
  if (!cur) return '';
  return units
    .slice(0, unitIndex)
    .filter(u => u.part === cur.part)
    .map(u => u.text)
    .join(' ');
}

export function hourName(key: string): string {
  return HOUR_LAYOUTS.find(h => h.key === key)?.name
    ?? HOURS.find(h => h.key === key)?.name
    ?? key;
}

// ─── Memorization items ───────────────────────────────────────────────────────
// A selectable/trackable item is a whole psalm ("5"), a single section of
// Psalm 118 ("118#0" … "118#21"), or an Agpeya prayer ("p:gospel_prime") —
// a Gospel, litany, absolution, or fixed prayer of an hour.

const SECTIONED_PSALM = 118;

export type ItemId = string;

export function itemsForPsalm(psalm: number): ItemId[] {
  if (psalm === SECTIONED_PSALM) {
    return getParts(psalm).map((_, i) => `${psalm}#${i}`);
  }
  return [String(psalm)];
}

export function itemPsalm(id: ItemId): number {
  if (isPrayerItem(id)) return NaN;
  return parseInt(id.split('#')[0], 10);
}

export function itemSection(id: ItemId): number | null {
  if (isPrayerItem(id)) return null;
  const parts = id.split('#');
  return parts.length > 1 ? parseInt(parts[1], 10) : null;
}

// Phrase-sized memorization units for an item.
export function itemUnits(id: ItemId): string[] {
  const prayer = getPrayer(id);
  if (prayer) return unitsFromParts(prayer.parts).map(u => u.text);
  const psalm = itemPsalm(id);
  const sec = itemSection(id);
  if (sec == null) return getUnits(psalm);
  return getUnitList(psalm).filter(u => u.part === sec).map(u => u.text);
}

export function itemUnitCount(id: ItemId): number {
  return itemUnits(id).length;
}

// Lead-up (context) shown before the clozed unit.
export function itemLeadUp(id: ItemId, unitIndex: number): string {
  return itemUnits(id).slice(0, unitIndex).join(' ');
}

export function itemLabel(id: ItemId): string {
  const prayer = getPrayer(id);
  if (prayer) return prayer.title;
  const psalm = itemPsalm(id);
  const sec = itemSection(id);
  return sec == null ? `Psalm ${psalm}` : `Psalm ${psalm} · Section ${sec + 1}`;
}

// Full readable text of an item (whole-psalm sections, one 118 section, or a
// prayer's paragraphs).
export function itemReaderText(id: ItemId): string[] {
  const prayer = getPrayer(id);
  if (prayer) return prayer.parts;
  const psalm = itemPsalm(id);
  const sec = itemSection(id);
  if (sec == null) return getParts(psalm);
  const p = getParts(psalm)[sec];
  return p ? [p] : [];
}

// Category metadata for the list tag and reader blurb: psalm genre for psalms,
// prayer kind (Gospel / Litany / Absolution / …) for prayers.
export function itemMeta(id: ItemId): CategoryMeta {
  const prayer = getPrayer(id);
  if (prayer) return PRAYER_KIND_META[prayer.kind];
  return CATEGORY_META[classify(itemPsalm(id))];
}

// The hours in which an item is prayed, derived from the hour layouts (so the
// Midnight watches and the Veil count too).
export function itemHours(id: ItemId): string[] {
  const keys: string[] = [];
  const prayer = isPrayerItem(id) ? id.slice(PRAYER_ITEM_PREFIX.length) : null;
  const psalm = prayer == null ? itemPsalm(id) : null;
  for (const h of HOUR_LAYOUTS) {
    const hit = h.sections.some(s =>
      prayer != null
        ? (s.prayers ?? []).includes(prayer)
        : (s.psalms ?? []).includes(psalm as number));
    if (hit) keys.push(h.key);
  }
  return keys;
}

export function psalmHours(psalm: number): string[] {
  return itemHours(String(psalm));
}
