// lib/journal.ts
// Shared type + helpers for the Spiritual Journal (agent_progress slug
// 'journal-entries'), so the Confession module can read entries flagged
// "bring this up with Abouna" and clear those flags without duplicating the
// entry shape or the slug string.
import * as db from '@/lib/db';

export interface JournalEntry {
  id: string;
  created_at: string;
  title: string;
  reflection: string;
  scripture?: string;
  prayer_intention?: string;
  // Congregant marked this to bring up at their next confession — e.g. a
  // blessing or answered prayer they want to share with their FOC.
  flaggedForConfession?: boolean;
  // Congregant marked this as a blessing / answered prayer — something
  // good God is doing, distinct from a general reflection. Independent of
  // flaggedForConfession: a blessing need not be brought to confession, and
  // vice versa.
  isBlessing?: boolean;
}

const SLUG = 'journal-entries';

export async function getJournalEntries(userId: string): Promise<JournalEntry[]> {
  const data = await db.getAgentProgress(userId, SLUG);
  return data?.entries ?? [];
}

export async function saveJournalEntries(userId: string, entries: JournalEntry[]): Promise<void> {
  await db.upsertAgentProgress({ user_id: userId, agent_slug: SLUG, payload: { entries }, updated_at: new Date().toISOString() });
}

// Entries currently flagged to bring up with the Father of Confession —
// surfaced in the Confession module's in-session notes.
export async function getFlaggedForConfession(userId: string): Promise<JournalEntry[]> {
  const entries = await getJournalEntries(userId);
  return entries.filter(e => e.flaggedForConfession);
}

// Un-flag every currently-flagged entry. The entries themselves are kept —
// only the "bring to confession" marker clears. Called from the Confession
// module's "Delete my confession notes" action so a flag doesn't linger
// forever once it's been brought up.
export async function clearConfessionFlags(userId: string): Promise<void> {
  const entries = await getJournalEntries(userId);
  if (!entries.some(e => e.flaggedForConfession)) return;
  await saveJournalEntries(userId, entries.map(e => e.flaggedForConfession ? { ...e, flaggedForConfession: false } : e));
}
