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

// Unanswered requests shared with FOC (foc_only or foc_and_servant) — priest detail view.
export async function getFocPrayerRequests(memberId: string): Promise<{ created_at: string; category: string }[]> {
  const { data } = await supabase
    .from('prayer_requests')
    .select('created_at, category')
    .eq('user_id', memberId)
    .in('visibility', ['foc_only', 'foc_and_servant'])
    .eq('answered', false)
    .order('created_at', { ascending: false });
  return data ?? [];
}

// Unanswered requests shared with a servant (servant_only or foc_and_servant) — servant detail view.
export async function getServantSharedPrayer(studentId: string): Promise<{ created_at: string; category: string }[]> {
  const { data } = await supabase
    .from('prayer_requests')
    .select('created_at, category')
    .eq('user_id', studentId)
    .in('visibility', ['servant_only', 'foc_and_servant'])
    .eq('answered', false)
    .order('created_at', { ascending: false });
  return data ?? [];
}
