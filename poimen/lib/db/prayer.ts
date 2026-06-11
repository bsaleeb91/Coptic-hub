// Prayer requests.
import { supabase } from '../supabase';

// All of a user's requests (own Prayer tab) — split into active/answered by caller.
export async function getPrayerRequests(userId: string): Promise<any[]> {
  const { data } = await supabase
    .from('prayer_requests')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  return data ?? [];
}

// Insert and return the created row (caller may use it to update local state).
export async function insertPrayerRequest(row: Record<string, any>): Promise<{ data: any | null; error: any | null }> {
  const { data, error } = await supabase.from('prayer_requests').insert(row).select().single();
  return { data: data ?? null, error };
}

export async function deletePrayerRequest(id: string): Promise<void> {
  await supabase.from('prayer_requests').delete().eq('id', id);
}

export async function markPrayerAnswered(id: string): Promise<void> {
  await supabase.from('prayer_requests').update({ answered: true }).eq('id', id);
}

// FOC-only, unanswered requests for a member (priest detail view).
export async function getFocPrayerRequests(memberId: string): Promise<{ created_at: string; topic: string }[]> {
  const { data } = await supabase
    .from('prayer_requests')
    .select('created_at, topic')
    .eq('user_id', memberId)
    .eq('visibility', 'foc_only')
    .eq('answered', false)
    .order('created_at', { ascending: false });
  return data ?? [];
}

// Requests a student has explicitly shared with their servant.
export async function getServantSharedPrayer(studentId: string): Promise<{ body: string }[]> {
  const { data } = await supabase
    .from('prayer_requests')
    .select('body')
    .eq('user_id', studentId)
    .eq('shared_with_servant', true)
    .order('created_at', { ascending: false })
    .limit(10);
  return data ?? [];
}
