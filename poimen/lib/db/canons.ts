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
    .select('id, component, start_date, frequency')
    .eq('congregant_id', congregantId)
    .eq('active', false)
    .order('created_at', { ascending: false });
  return data ?? [];
}

// Active canons for a member (priest detail view).
export async function getMemberActiveCanons(memberId: string): Promise<any[]> {
  const { data } = await supabase
    .from('spiritual_canons')
    .select('id, component, frequency, start_date')
    .eq('congregant_id', memberId)
    .eq('active', true);
  return data ?? [];
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

export async function insertCanon(row: Record<string, any>): Promise<void> {
  await supabase.from('spiritual_canons').insert(row);
}

export async function deactivateCanon(canonId: string): Promise<void> {
  await supabase.from('spiritual_canons').update({ active: false }).eq('id', canonId);
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
