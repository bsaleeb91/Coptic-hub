// lib/confession/patterns.ts
// Reads the confession history for patterns: which sins keep coming back,
// which have fallen away, which appeared for the first time. Pure — takes the
// records, returns a list; nothing here touches storage.
//
// "Same sin" means: the same catalogue item (examination check or a journal
// incident filed under it), or for free-text incidents, the same title after
// trimming and lower-casing. That is deliberately simple — the user wrote
// both, and a looser match would start inventing patterns.

import { SIN_CATALOGUE } from './sinCatalogue';
import { RELATIONAL_EXAMINATION } from './relationalExamination';
import type { ConfessionRecord, IncidentCategory } from './types';

export type PatternStatus = 'recurring' | 'first' | 'faded';

export interface PatternItem {
  key: string;
  name: string;
  category: IncidentCategory;
  appearances: number;      // confessions this appeared in
  total: number;            // confessions considered
  inLatest: boolean;
  lastDate: string;         // local YYYY-MM-DD of the most recent appearance
  status: PatternStatus;
}

// Every distinct sin in one record, keyed the way appearances are counted.
// Exported so the history screen lists a record's contents by the same rule
// the pattern counts use.
export function recordItems(record: ConfessionRecord): Map<string, { name: string; category: IncidentCategory }> {
  const out = new Map<string, { name: string; category: IncidentCategory }>();
  for (const id of Object.keys(record.exam ?? {})) {
    const sin = SIN_CATALOGUE.find(s => s.id === id);
    if (sin) { out.set(`sin:${id}`, { name: sin.name, category: sin.category }); continue; }
    const q = RELATIONAL_EXAMINATION.find(r => r.id === id);
    if (q) out.set(`sin:${id}`, { name: q.text, category: q.category });
  }
  for (const inc of record.incidents ?? []) {
    if (inc.sinId) {
      const sin = SIN_CATALOGUE.find(s => s.id === inc.sinId);
      const q = !sin ? RELATIONAL_EXAMINATION.find(r => r.id === inc.sinId) : undefined;
      const name = sin?.name ?? q?.text ?? inc.title;
      out.set(`sin:${inc.sinId}`, { name, category: inc.category });
    } else {
      const t = inc.title.trim().toLowerCase();
      if (t) out.set(`text:${t}`, { name: inc.title.trim(), category: inc.category });
    }
  }
  return out;
}

// Records must be newest-first (as loadHistory returns them).
//   recurring — in the latest confession AND at least one earlier one
//   first     — only in the latest confession
//   faded     — confessed before, but not in the latest one
// Sorted: recurring by how often (most persistent first), then first, then
// faded by how recently they were last seen.
export function analyzeHistory(records: ConfessionRecord[]): PatternItem[] {
  const total = records.length;
  if (total === 0) return [];
  const acc = new Map<string, PatternItem>();
  records.forEach((rec, idx) => {
    for (const [key, meta] of recordItems(rec)) {
      const cur = acc.get(key);
      if (cur) {
        cur.appearances += 1;
      } else {
        acc.set(key, {
          key, name: meta.name, category: meta.category,
          appearances: 1, total, inLatest: idx === 0, lastDate: rec.date, status: 'first',
        });
      }
    }
  });
  const out = [...acc.values()].map(p => ({
    ...p,
    status: (p.inLatest ? (p.appearances > 1 ? 'recurring' : 'first') : 'faded') as PatternStatus,
  }));
  const rank: Record<PatternStatus, number> = { recurring: 0, first: 1, faded: 2 };
  return out.sort((a, b) =>
    rank[a.status] - rank[b.status]
    || (a.status === 'faded' ? b.lastDate.localeCompare(a.lastDate) : b.appearances - a.appearances)
    || a.name.localeCompare(b.name));
}
