// lib/journal.ts
// Shared type + helpers for the Spiritual Journal (agent_progress slug
// 'journal-entries'), so the Confession module can read entries flagged
// "bring this up with Abouna" and clear those flags without duplicating the
// entry shape or the slug string.
//
// Both journal rows are sealed to the member's own keypair — payload
// { sealed: 'box1:…' } — so the server holds nothing readable. Rows written
// before that ({ entries } / { blessings } in the clear) still read, and are
// resealed the first time they are read on a device that has the key.
import { supabase } from '@/lib/supabase';
import { sealForSelf, openForSelf } from '@/lib/crypto';

// The key that opens the journal isn't on this device (PIN recovery pending, or
// the account started fresh), or the journal couldn't be fetched. Callers must
// not save on top of a journal they couldn't read — that would replace it.
export class JournalUnavailableError extends Error {
  constructor(public reason: 'locked' | 'offline') {
    super(reason === 'locked' ? 'journal locked' : 'journal could not be loaded');
  }
}

// Not db.getAgentProgress: it returns null for a failed request as well as for
// a missing row, and reading a network error as "empty journal" is how the next
// save would wipe it.
async function readList<T>(userId: string, slug: string, field: string): Promise<T[]> {
  const { data, error } = await supabase
    .from('agent_progress')
    .select('payload')
    .eq('user_id', userId)
    .eq('agent_slug', slug)
    .maybeSingle();
  if (error) throw new JournalUnavailableError('offline');
  const payload = data?.payload;
  if (!payload) return [];
  if (typeof payload.sealed === 'string') {
    const json = await openForSelf(payload.sealed);
    if (json === null) throw new JournalUnavailableError('locked');
    const list = JSON.parse(json)?.[field];
    return Array.isArray(list) ? list : [];
  }
  const list: T[] = Array.isArray(payload[field]) ? payload[field] : [];
  // Legacy plaintext row: seal it now so the readable copy doesn't linger on
  // the server. Best effort — without a key it stays as it is until one exists.
  if (list.length) await writeList(userId, slug, field, list).catch(() => {});
  return list;
}

async function writeList<T>(userId: string, slug: string, field: string, list: T[]): Promise<void> {
  const sealed = await sealForSelf(JSON.stringify({ [field]: list }));
  if (sealed === null) throw new JournalUnavailableError('locked');
  const { error } = await supabase.from('agent_progress').upsert(
    { user_id: userId, agent_slug: slug, payload: { sealed }, updated_at: new Date().toISOString() },
    { onConflict: 'user_id,agent_slug' },
  );
  if (error) throw new Error(error.message);
}

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
  return readList<JournalEntry>(userId, SLUG, 'entries');
}

export async function saveJournalEntries(userId: string, entries: JournalEntry[]): Promise<void> {
  await writeList(userId, SLUG, 'entries', entries);
}

// Entries currently flagged to bring up with the Father of Confession —
// surfaced in the Confession module's in-session notes. A journal that can't
// be opened contributes nothing rather than breaking the Confession screen.
export async function getFlaggedForConfession(userId: string): Promise<JournalEntry[]> {
  try {
    const entries = await getJournalEntries(userId);
    return entries.filter(e => e.flaggedForConfession);
  } catch {
    return [];
  }
}

// Un-flag every currently-flagged entry. The entries themselves are kept —
// only the "bring to confession" marker clears. Called from the Confession
// module's "Delete my confession notes" action so a flag doesn't linger
// forever once it's been brought up.
export async function clearConfessionFlags(userId: string): Promise<void> {
  let entries: JournalEntry[];
  try {
    entries = await getJournalEntries(userId);
  } catch {
    return;
  }
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
  return readList<Blessing>(userId, BLESSINGS_SLUG, 'blessings');
}

export async function saveBlessings(userId: string, blessings: Blessing[]): Promise<void> {
  await writeList(userId, BLESSINGS_SLUG, 'blessings', blessings);
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
