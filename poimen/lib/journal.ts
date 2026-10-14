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
  // DEPRECATED. Blessings used to be a flag on a reflection; they are now
  // their own dated list (see Blessing below), because marking an essay as a
  // blessing and wanting to write down one line are different acts. Read only
  // by migrateBlessingFlags, which moves any still carrying it across and
  // clears it. Nothing writes it.
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


// ─── Blessings ───────────────────────────────────────────────────────────────

// Something God did, dated, kept so it can be read back in a harder season.
// Deliberately one field — a line, not an essay — so the bar to writing one
// down stays low. Its own row (agent_progress slug 'journal-blessings') rather
// than a field on an entry: the entries payload keeps its shape, and a
// blessing does not need a title, a scripture and a prayer intention to exist.
export interface Blessing {
  id: string;
  created_at: string;
  text: string;
}

const BLESSINGS_SLUG = 'journal-blessings';

export async function getBlessings(userId: string): Promise<Blessing[]> {
  const data = await db.getAgentProgress(userId, BLESSINGS_SLUG);
  return Array.isArray(data?.blessings) ? data.blessings : [];
}

export async function saveBlessings(userId: string, blessings: Blessing[]): Promise<void> {
  await db.upsertAgentProgress({ user_id: userId, agent_slug: BLESSINGS_SLUG, payload: { blessings }, updated_at: new Date().toISOString() });
}

// Carry across anything marked with the old isBlessing flag, then clear it.
//
// Without this, replacing the flag with the list would silently un-mark every
// blessing anyone has recorded since the feature shipped — the entry itself
// survives, but the fact that they called it a blessing does not, and that is
// the part they chose. The entry's own words become the blessing's text.
//
// Idempotent: it only acts when a flag is still set, and clearing them is what
// stops it running again.
export async function migrateBlessingFlags(userId: string): Promise<Blessing[] | null> {
  const entries = await getJournalEntries(userId);
  const flagged = entries.filter(e => e.isBlessing);
  if (flagged.length === 0) return null;

  const existing = await getBlessings(userId);
  const already = new Set(existing.map(b => b.id));
  const carried: Blessing[] = flagged
    .map(e => ({
      id: `entry-${e.id}`,
      created_at: e.created_at,
      text: e.title && e.title !== 'Untitled' ? `${e.title} — ${e.reflection}` : e.reflection,
    }))
    .filter(b => !already.has(b.id));

  const merged = [...carried, ...existing]
    .sort((a, b) => (a.created_at < b.created_at ? 1 : -1));

  await saveBlessings(userId, merged);
  await saveJournalEntries(userId, entries.map(({ isBlessing, ...rest }) => rest));
  return merged;
}
