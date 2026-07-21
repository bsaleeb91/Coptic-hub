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

// ── Pastoral visit requests ──────────────────────────────────
// A congregant flags that they'd like a visit; their FOC sees it on the flock
// list. Stored in agent_progress (slug 'visit-request'); the congregant writes
// their own row, the FOC reads flock rows via a consent-gated policy.
const VISIT_REQUEST_SLUG = 'visit-request';

export async function getVisitRequest(userId: string): Promise<{ active: boolean; requestedAt: string | null }> {
  const payload = await getAgentProgress(userId, VISIT_REQUEST_SLUG);
  return { active: !!payload?.active, requestedAt: payload?.requestedAt ?? null };
}

export async function setVisitRequest(userId: string, active: boolean): Promise<{ error: string | null }> {
  return upsertAgentProgress({
    user_id: userId,
    agent_slug: VISIT_REQUEST_SLUG,
    payload: { active, requestedAt: active ? new Date().toISOString() : null },
    updated_at: new Date().toISOString(),
  });
}

// FOC batch read: which flock members currently have an active visit request,
// mapped member_id → requestedAt ISO.
export async function getFlockVisitRequests(memberIds: string[]): Promise<Record<string, string>> {
  if (!memberIds.length) return {};
  const { data } = await supabase
    .from('agent_progress')
    .select('user_id, payload')
    .eq('agent_slug', VISIT_REQUEST_SLUG)
    .in('user_id', memberIds);
  const out: Record<string, string> = {};
  for (const row of data ?? []) {
    if ((row as any).payload?.active) out[(row as any).user_id] = (row as any).payload?.requestedAt ?? '';
  }
  return out;
}
