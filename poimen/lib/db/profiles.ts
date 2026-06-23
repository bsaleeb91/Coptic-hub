// Profiles + flock/student roster queries.
import { supabase } from '../supabase';

export interface Profile {
  id: string;
  full_name: string | null;
  church_name: string | null;
  role: 'congregant' | 'priest' | 'servant' | 'admin';
  avatar_url: string | null;
  foc_id: string | null;
  servant_id: string | null;
  foc_consent_at: string | null;
  invite_code: string | null;
  vitals_consent: boolean | null;
  last_confession_at: string | null;
}

export async function getProfile(userId: string): Promise<Profile | null> {
  const { data } = await supabase
    .from('profiles')
    .select('id, full_name, church_name, role, avatar_url, foc_id, servant_id, foc_consent_at, invite_code, vitals_consent, last_confession_at')
    .eq('id', userId)
    .single();
  return data ?? null;
}

export async function getProfileByInviteCode(
  code: string,
): Promise<{ id: string; full_name: string | null; church_name: string | null; role: string } | null> {
  const { data } = await supabase
    .from('profiles')
    .select('id, full_name, church_name, role')
    .eq('invite_code', code.trim().toUpperCase())
    .single();
  return data ?? null;
}

export async function linkToFOC(userId: string, priestId: string): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from('profiles')
    .update({ foc_id: priestId })
    .eq('id', userId);
  return { error: error?.message ?? null };
}

export async function linkToServant(userId: string, servantId: string): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from('profiles')
    .update({ servant_id: servantId })
    .eq('id', userId);
  return { error: error?.message ?? null };
}

export async function unlinkFOC(userId: string): Promise<void> {
  await supabase.from('profiles').update({ foc_id: null }).eq('id', userId);
}

export async function unlinkServant(userId: string): Promise<void> {
  await supabase.from('profiles').update({ servant_id: null }).eq('id', userId);
}

export async function setFocConsent(userId: string): Promise<void> {
  await supabase
    .from('profiles')
    .update({ foc_consent_at: new Date().toISOString() })
    .eq('id', userId);
}

export async function setLastConfession(userId: string, isoDate: string): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from('profiles')
    .update({ last_confession_at: isoDate })
    .eq('id', userId);
  return { error: error?.message ?? null };
}

export async function setVitalsConsent(userId: string, consent: boolean): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from('profiles')
    .update({ vitals_consent: consent })
    .eq('id', userId);
  return { error: error?.message ?? null };
}

export async function updateAccount(
  userId: string,
  fields: { full_name: string; church_name: string },
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from('profiles')
    .update({ ...fields, updated_at: new Date().toISOString() })
    .eq('id', userId);
  return { error: error?.message ?? null };
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
export async function getMemberProfile(memberId: string): Promise<{ full_name: string | null; created_at: string; role: string; foc_consent_at: string | null } | null> {
  const { data } = await supabase
    .from('profiles')
    .select('full_name, created_at, role, foc_consent_at')
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

// All profiles — admin use only.
export async function getAllProfiles(): Promise<Profile[]> {
  const { data } = await supabase
    .from('profiles')
    .select('id, full_name, church_name, role, avatar_url, foc_id')
    .order('role')
    .order('full_name');
  return data ?? [];
}
