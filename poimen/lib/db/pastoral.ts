// Pastoral contact, life-stage profile, children, and encounter records.
import { supabase } from '../supabase';

// ── Contact info (shared with FOC) ───────────────────────────
export async function getContact(userId: string): Promise<any | null> {
  const { data } = await supabase.from('pastoral_contacts').select('*').eq('user_id', userId).maybeSingle();
  return data ?? null;
}

export async function upsertContact(row: Record<string, any>): Promise<void> {
  await supabase.from('pastoral_contacts').upsert(row, { onConflict: 'user_id' });
}

// ── Life stage / family ──────────────────────────────────────
export async function getLifeProfile(userId: string): Promise<any | null> {
  const { data } = await supabase.from('pastoral_profile').select('*').eq('user_id', userId).maybeSingle();
  return data ?? null;
}

export async function upsertLifeProfile(row: Record<string, any>): Promise<void> {
  await supabase.from('pastoral_profile').upsert(row, { onConflict: 'user_id' });
}

export async function getChildren(parentId: string): Promise<any[]> {
  const { data } = await supabase
    .from('pastoral_children')
    .select('*')
    .eq('parent_id', parentId)
    .order('birth_year', { ascending: true });
  return data ?? [];
}

export async function deleteChildren(parentId: string): Promise<void> {
  await supabase.from('pastoral_children').delete().eq('parent_id', parentId);
}

export async function insertChildren(rows: Record<string, any>[]): Promise<void> {
  await supabase.from('pastoral_children').insert(rows);
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

export async function insertEncounter(row: Record<string, any>): Promise<void> {
  await supabase.from('pastoral_encounters').insert(row);
}
