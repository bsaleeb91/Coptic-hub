// src/data/agpeyaPsalter.ts
// The Psalms exactly as they appear in the Coptic Agpeya — superscriptions
// omitted, in the Agpeya's own English translation, grouped by the canonical
// hours. Psalm 118 is divided into its 22 traditional sections; every other
// psalm is a single part, as the Agpeya prays it.

import RAW from './agpeyaPsalms.json';

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

export function getUnitList(psalm: number): Unit[] {
  const out: Unit[] = [];
  getParts(psalm).forEach((p, pi) => {
    for (const t of chunk(p)) out.push({ text: t, part: pi });
  });
  return out;
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

export function psalmHours(psalm: number): string[] {
  return DATA.psalms[String(psalm)]?.hours ?? [];
}

export function hourName(key: string): string {
  return HOURS.find(h => h.key === key)?.name ?? key;
}

// ─── Memorization items ───────────────────────────────────────────────────────
// A selectable/trackable item is either a whole psalm ("5") or a single section
// of Psalm 118 ("118#0" … "118#21"), matching the Agpeya's division of it.

const SECTIONED_PSALM = 118;

export type ItemId = string;

export function itemsForPsalm(psalm: number): ItemId[] {
  if (psalm === SECTIONED_PSALM) {
    return getParts(psalm).map((_, i) => `${psalm}#${i}`);
  }
  return [String(psalm)];
}

export function itemPsalm(id: ItemId): number {
  return parseInt(id.split('#')[0], 10);
}

export function itemSection(id: ItemId): number | null {
  const parts = id.split('#');
  return parts.length > 1 ? parseInt(parts[1], 10) : null;
}

// Phrase-sized memorization units for an item.
export function itemUnits(id: ItemId): string[] {
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
  const psalm = itemPsalm(id);
  const sec = itemSection(id);
  return sec == null ? `Psalm ${psalm}` : `Psalm ${psalm} · Section ${sec + 1}`;
}

// Full readable text of an item (whole-psalm sections, or the one 118 section).
export function itemReaderText(id: ItemId): string[] {
  const psalm = itemPsalm(id);
  const sec = itemSection(id);
  if (sec == null) return getParts(psalm);
  const p = getParts(psalm)[sec];
  return p ? [p] : [];
}
