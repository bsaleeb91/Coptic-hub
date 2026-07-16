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

// Active canons for a member (priest detail view) — includes items the
// congregant added themselves (priest_id null), not just ones this priest assigned.
export async function getMemberActiveCanons(memberId: string): Promise<any[]> {
  const { data } = await supabase
    .from('spiritual_canons')
    .select('id, component, frequency, start_date, priest_id')
    .eq('congregant_id', memberId)
    .eq('active', true);
  return data ?? [];
}

// Active canons for a student (servant detail view) — includes items the
// student added themselves (priest_id null), not just ones this servant assigned.
export async function getStudentActiveCanons(studentId: string): Promise<any[]> {
  const { data } = await supabase
    .from('spiritual_canons')
    .select('id, component, frequency, start_date, priest_id')
    .eq('congregant_id', studentId)
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
  const { error } = await supabase
    .from('spiritual_canons')
    .update({ active: false, end_date: new Date().toISOString().slice(0, 10) })
    .eq('id', canonId);
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
