// Profiles + flock/student roster queries.
import { supabase } from '../supabase';

export interface Profile {
  id: string;
  full_name: string | null;
  church_name: string | null;
  role: 'congregant' | 'priest' | 'admin';
  avatar_url: string | null;
  foc_id: string | null;
}

export async function getProfile(userId: string): Promise<Profile | null> {
  const { data } = await supabase
    .from('profiles')
    .select('id, full_name, church_name, role, avatar_url, foc_id')
    .eq('id', userId)
    .single();
  return data ?? null;
}

export async function updateAccount(
  userId: string,
  fields: { full_name: string; church_name: string },
): Promise<void> {
  await supabase
    .from('profiles')
    .update({ ...fields, updated_at: new Date().toISOString() })
    .eq('id', userId);
}

// Father of Confession card (dashboard).
export async function getFocProfile(focId: string): Promise<{ full_name: string | null; church_name: string | null } | null> {
  const { data } = await supabase
    .from('profiles')
    .select('full_name, church_name')
    .eq('id', focId)
    .single();
  return data ?? null;
}

// Member detail header (priest view).
export async function getMemberProfile(memberId: string): Promise<{ full_name: string | null; created_at: string; role: string } | null> {
  const { data } = await supabase
    .from('profiles')
    .select('full_name, created_at, role')
    .eq('id', memberId)
    .single();
  return data ?? null;
}

// Members who list this priest as their Father of Confession.
export async function getFlock(focId: string, opts?: { ordered?: boolean }): Promise<{ id: string; full_name: string | null }[]> {
  let query = supabase.from('profiles').select('id, full_name').eq('foc_id', focId);
  if (opts?.ordered) query = query.order('full_name');
  const { data } = await query;
  return data ?? [];
}

// Students who list this servant.
export async function getServantStudents(servantId: string): Promise<{ id: string; full_name: string | null }[]> {
  const { data } = await supabase
    .from('profiles')
    .select('id, full_name')
    .eq('servant_id', servantId);
  return data ?? [];
}
