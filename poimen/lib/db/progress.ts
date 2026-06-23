// agent_progress is a per-user key/value store keyed by (user_id, agent_slug).
// Poimen uses it for spiritual vitals, journal disciplines/entries, and the
// priest/servant private pastoral notes.
import { supabase } from '../supabase';

// Returns the stored payload object (or null if no row exists).
export async function getAgentProgress(userId: string, slug: string): Promise<any | null> {
  const { data } = await supabase
    .from('agent_progress')
    .select('payload')
    .eq('user_id', userId)
    .eq('agent_slug', slug)
    .single();
  return data?.payload ?? null;
}

// Upsert a full row. Callers build the row (user_id, agent_slug, payload, and
// optionally a top-level updated_at) so existing behavior is preserved exactly.
export async function upsertAgentProgress(row: Record<string, any>): Promise<{ error: string | null }> {
  const { error } = await supabase.from('agent_progress').upsert(row, { onConflict: 'user_id,agent_slug' });
  return { error: error?.message ?? null };
}
