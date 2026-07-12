// Pastoral contact, life-stage profile, children, encounter records, and notes.
import { supabase } from '../supabase';
import { encryptNote, decryptNote } from '../crypto';

export interface PastoralNote {
  id: string;
  author_id: string;
  member_id: string;
  body: string;
  created_at: string;
  updated_at: string;
}

// ── Contact info (shared with FOC) ───────────────────────────
export async function getContact(userId: string): Promise<any | null> {
  const { data } = await supabase.from('pastoral_contacts').select('*').eq('user_id', userId).maybeSingle();
  return data ?? null;
}

export async function upsertContact(row: Record<string, any>): Promise<{ error: string | null }> {
  const { error } = await supabase.from('pastoral_contacts').upsert(row, { onConflict: 'user_id' });
  return { error: error?.message ?? null };
}

// ── Life stage / family ──────────────────────────────────────
export async function getLifeProfile(userId: string): Promise<any | null> {
  const { data } = await supabase.from('pastoral_profile').select('*').eq('user_id', userId).maybeSingle();
  return data ?? null;
}

export async function upsertLifeProfile(row: Record<string, any>): Promise<{ error: string | null }> {
  const { error } = await supabase.from('pastoral_profile').upsert(row, { onConflict: 'user_id' });
  return { error: error?.message ?? null };
}

export async function getChildren(parentId: string): Promise<any[]> {
  const { data } = await supabase
    .from('pastoral_children')
    .select('*')
    .eq('parent_id', parentId)
    .order('birth_year', { ascending: true });
  return data ?? [];
}

export async function deleteChildren(parentId: string): Promise<{ error: string | null }> {
  const { error } = await supabase.from('pastoral_children').delete().eq('parent_id', parentId);
  return { error: error?.message ?? null };
}

export async function insertChildren(rows: Record<string, any>[]): Promise<{ error: string | null }> {
  const { error } = await supabase.from('pastoral_children').insert(rows);
  return { error: error?.message ?? null };
}

// ── Pastoral encounters ──────────────────────────────────────
// Most-recent encounters for a member's timeline (dashboard).
export async function getRecentEncounters(congregantId: string, limit: number): Promise<any[]> {
  const { data } = await supabase
    .from('pastoral_encounters')
    .select('encounter_type, encountered_at, member_note')
    .eq('congregant_id', congregantId)
    .order('encountered_at', { ascending: false })
    .limit(limit);
  return data ?? [];
}

// Confession-type encounters for one member (member detail + history).
export async function getConfessionsForCongregant(congregantId: string): Promise<any[]> {
  const { data } = await supabase
    .from('pastoral_encounters')
    .select('id, encountered_at, member_note')
    .eq('congregant_id', congregantId)
    .eq('encounter_type', 'confession')
    .order('encountered_at', { ascending: false });
  return data ?? [];
}

// All confessions logged by a priest (used to compute days-since per member).
export async function getConfessionsForPriest(priestId: string): Promise<any[]> {
  const { data } = await supabase
    .from('pastoral_encounters')
    .select('congregant_id, encountered_at')
    .eq('priest_id', priestId)
    .eq('encounter_type', 'confession')
    .order('encountered_at', { ascending: false });
  return data ?? [];
}

// ── Pastoral notes (priest + servant) ────────────────────────
export async function getPastoralNotes(authorId: string, memberId: string): Promise<PastoralNote[]> {
  const { data } = await supabase
    .from('pastoral_notes')
    .select('*')
    .eq('author_id', authorId)
    .eq('member_id', memberId)
    .order('created_at', { ascending: false });
  if (!data) return [];
  return Promise.all(data.map(async (n) => ({ ...n, body: await decryptNote(n.body) })));
}

export async function insertPastoralNote(authorId: string, memberId: string, body: string): Promise<{ data: PastoralNote | null; error: string | null }> {
  const encryptedBody = await encryptNote(body);
  const { data, error } = await supabase
    .from('pastoral_notes')
    .insert({ author_id: authorId, member_id: memberId, body: encryptedBody })
    .select()
    .single();
  if (error || !data) return { data: null, error: error?.message ?? null };
  return { data: { ...data, body }, error: null };
}

export async function updatePastoralNote(noteId: string, body: string): Promise<{ error: string | null }> {
  const encryptedBody = await encryptNote(body);
  const { error } = await supabase
    .from('pastoral_notes')
    .update({ body: encryptedBody, updated_at: new Date().toISOString() })
    .eq('id', noteId);
  return { error: error?.message ?? null };
}

export async function deletePastoralNote(noteId: string): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from('pastoral_notes')
    .delete()
    .eq('id', noteId);
  return { error: error?.message ?? null };
}

// ── Pastoral encounters ──────────────────────────────────────
export async function insertEncounter(row: Record<string, any>): Promise<{ error: string | null }> {
  const { private_note, ...encounterRow } = row;
  const { data, error } = await supabase
    .from('pastoral_encounters')
    .insert(encounterRow)
    .select('id')
    .single();
  if (error) return { error: error.message };
  if (data?.id && private_note) {
    const encryptedNote = await encryptNote(private_note);
    const { error: noteError } = await supabase.from('pastoral_encounter_private_notes').insert({
      encounter_id: data.id,
      priest_id: encounterRow.priest_id,
      private_note: encryptedNote,
    });
    if (noteError) return { error: noteError.message };
  }
  return { error: null };
}
