// Spiritual canons + daily completions.
import { supabase } from '../supabase';

// Active canons for a congregant (own Canon tab) — full rows.
export async function getActiveCanons(congregantId: string): Promise<any[]> {
  const { data } = await supabase
    .from('spiritual_canons')
    .select('*')
    .eq('congregant_id', congregantId)
    .eq('active', true)
    .order('created_at', { ascending: false });
  return data ?? [];
}

// Past (inactive) canons for a congregant — history list.
export async function getInactiveCanons(congregantId: string): Promise<any[]> {
  const { data } = await supabase
    .from('spiritual_canons')
    .select('id, component, start_date, end_date, frequency')
    .eq('congregant_id', congregantId)
    .eq('active', false)
    .order('created_at', { ascending: false });
  return data ?? [];
}

// Active canons for a member (priest detail view). Includes the structured
// category/payload/created_at so the priest's editor can pre-fill what they've
// already assigned and the member's app can merge it.
export async function getMemberActiveCanons(memberId: string): Promise<any[]> {
  const { data } = await supabase
    .from('spiritual_canons')
    .select('id, component, frequency, start_date, category, payload, created_at')
    .eq('congregant_id', memberId)
    .eq('active', true);
  return data ?? [];
}

// What a specific priest has assigned this member — used to pre-fill the
// priest's own canon editor, so one FOC never edits/removes another's rows.
export async function getMemberActiveCanonsByPriest(memberId: string, priestId: string): Promise<any[]> {
  const { data } = await supabase
    .from('spiritual_canons')
    .select('id, component, frequency, start_date, category, payload, created_at')
    .eq('congregant_id', memberId)
    .eq('priest_id', priestId)
    .eq('active', true);
  return data ?? [];
}

// The member's own view of what their FOC has assigned (read on the member's
// device to merge the priest-assigned, locked parts over their personal rule).
export async function getAssignedCanonsForMember(memberId: string): Promise<any[]> {
  const { data } = await supabase
    .from('spiritual_canons')
    .select('id, component, frequency, start_date, category, payload, created_at, priest_id')
    .eq('congregant_id', memberId)
    .eq('active', true)
    .order('created_at', { ascending: true });
  return data ?? [];
}

// Insert one structured/assigned canon component (priest → member).
export async function insertAssignedCanon(row: {
  congregant_id: string; priest_id: string; category: string;
  component: string; payload: any; frequency?: string; start_date?: string;
}): Promise<{ error: string | null }> {
  const { error } = await supabase.from('spiritual_canons').insert({
    congregant_id: row.congregant_id,
    priest_id: row.priest_id,
    category: row.category,
    component: row.component,
    payload: row.payload ?? null,
    frequency: row.frequency ?? 'Daily',
    start_date: row.start_date ?? new Date().toISOString().slice(0, 10),
    active: true,
  });
  return { error: error?.message ?? null };
}

// Deactivate a whole category's assignment(s) for a member (priest removal /
// re-assign replaces the old rows for that category).
export async function deactivateAssignedCategory(memberId: string, priestId: string, category: string): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from('spiritual_canons')
    .update({ active: false })
    .eq('congregant_id', memberId)
    .eq('priest_id', priestId)
    .eq('category', category)
    .eq('active', true);
  return { error: error?.message ?? null };
}

// Active canons a servant assigned to a student.
export async function getStudentActiveCanons(studentId: string, priestId: string): Promise<any[]> {
  const { data } = await supabase
    .from('spiritual_canons')
    .select('id, component, frequency, start_date')
    .eq('congregant_id', studentId)
    .eq('priest_id', priestId)
    .eq('active', true);
  return data ?? [];
}

// Lightweight active-canon context for the assign screen.
export async function getActiveCanonContext(memberId: string): Promise<{ component: string; frequency: string }[]> {
  const { data } = await supabase
    .from('spiritual_canons')
    .select('component, frequency')
    .eq('congregant_id', memberId)
    .eq('active', true);
  return data ?? [];
}

// Active canons assigned by a priest/servant, used to count canons per member.
// Keyed by congregant_id (spiritual_canons has no user_id column).
export async function getActiveCanonsByPriest(priestId: string): Promise<{ congregant_id: string }[]> {
  const { data } = await supabase
    .from('spiritual_canons')
    .select('congregant_id')
    .eq('priest_id', priestId)
    .eq('active', true);
  return data ?? [];
}

export async function insertCanon(row: Record<string, any>): Promise<{ error: string | null }> {
  const { error } = await supabase.from('spiritual_canons').insert(row);
  return { error: error?.message ?? null };
}

export async function deactivateCanon(canonId: string): Promise<{ error: string | null }> {
  const { error } = await supabase.from('spiritual_canons').update({ active: false }).eq('id', canonId);
  return { error: error?.message ?? null };
}

// ── Completions ──────────────────────────────────────────────
export async function countCanonCompletions(canonId: string): Promise<number> {
  const { count } = await supabase
    .from('canon_completions')
    .select('*', { count: 'exact', head: true })
    .eq('canon_id', canonId);
  return count ?? 0;
}

export async function countCanonCompletionsSince(canonId: string, sinceDate: string): Promise<number> {
  const { count } = await supabase
    .from('canon_completions')
    .select('id', { count: 'exact', head: true })
    .eq('canon_id', canonId)
    .gte('completed_on', sinceDate);
  return count ?? 0;
}

export async function upsertCanonCompletion(canonId: string, userId: string, completedOn: string): Promise<void> {
  await supabase.from('canon_completions').upsert(
    { canon_id: canonId, user_id: userId, completed_on: completedOn },
    { onConflict: 'canon_id,user_id,completed_on' },
  );
}

// Un-checking removes that day's completion so the assigner's weekly counts
// stay honest.
export async function deleteCanonCompletion(canonId: string, userId: string, completedOn: string): Promise<void> {
  await supabase.from('canon_completions').delete()
    .eq('canon_id', canonId)
    .eq('user_id', userId)
    .eq('completed_on', completedOn);
}
