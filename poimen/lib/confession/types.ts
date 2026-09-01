// lib/confession/types.ts
// Types for the confession journal + examination of conscience, ported from
// Nepsis. Kept local to the confession module.

export type SinCategory =
  | 'tongue'
  | 'thoughts'
  | 'hearing'
  | 'eyes'
  | 'actions'
  | 'neglected_practices';

export type SinFrequency = 'once' | 'few' | 'often';

export interface SinItem {
  id: string;
  category: SinCategory;
  name: string;
  description: string;
  scripture: string;                  // e.g. "Matthew 7:1"
}

// A journal incident sits under one of the six examination domains, or "other".
export type JournalCategory = SinCategory | 'other';

// Incidents may also be filed under the relational examination's categories
// (Poimen's original style — see relationalExamination.ts).
import type { RelationalCategory } from './relationalExamination';
export type IncidentCategory = JournalCategory | RelationalCategory;

export interface JournalIncident {
  id: string;
  category: IncidentCategory;
  sinId?: string;              // optional specific item from the catalogue
  title: string;               // short label (sin name, or first words of the note)
  note: string;                // free-text explanation (encrypted at rest)
  createdAt: number;           // epoch ms
}

// Map of sinId -> frequency for everything currently checked in the examination.
export type ExamChecks = Record<string, SinFrequency>;

// A free-text note for when there's no specific sin to log — a question or
// topic to bring to the Father of Confession for direction instead.
export interface GuidanceNote {
  id: string;
  note: string;                // free-text (encrypted at rest)
  createdAt: number;           // epoch ms
}
