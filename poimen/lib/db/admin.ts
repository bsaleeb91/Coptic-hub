import { supabase } from '../supabase';

export interface AdminSummary {
  total_users: number;
  priests: number;
  servants: number;
  congregants: number;
  active_week: number;
  active_month: number;
  churches: number;
  foc_linked: number;
  total_prayers: number;
  answered_prayers: number;
  total_confessions: number;
  total_encounters: number;
  active_canons: number;
  canon_completions: number;
  journal_users: number;
  new_this_month: number;
  new_last_month: number;
}

export interface MonthlyActivity {
  month: string;
  signups: number;
  prayers: number;
  confessions: number;
  canon_completions: number;
  journal_active: number;
}

export interface ChurchBreakdown {
  church_id: string;
  church_name: string;
  priests: number;
  servants: number;
  congregants: number;
  foc_linked: number;
}

export async function getAdminSummary(): Promise<AdminSummary | null> {
  const { data, error } = await supabase.rpc('get_admin_summary');
  if (error) return null;
  return data as AdminSummary;
}

export async function getMonthlyActivity(): Promise<MonthlyActivity[]> {
  const { data } = await supabase.rpc('get_monthly_activity');
  return (data ?? []) as MonthlyActivity[];
}

export async function getChurchBreakdown(): Promise<ChurchBreakdown[]> {
  const { data } = await supabase.rpc('get_church_breakdown');
  return (data ?? []) as ChurchBreakdown[];
}

export interface PriestRequest {
  id: string;
  full_name: string | null;
  church_name: string | null;
  email: string | null;
}

// null = the RPC failed (missing migration, network), which the UI must
// not present as an empty queue.
export async function getPriestRequests(): Promise<PriestRequest[] | null> {
  const { data, error } = await supabase.rpc('get_priest_requests');
  if (error) return null;
  return (data ?? []) as PriestRequest[];
}

// The RPCs return the affected row count; 0 means the request was no
// longer pending (handled in another session), which is not a success.
export async function approvePriestRequest(userId: string): Promise<boolean> {
  const { data, error } = await supabase.rpc('approve_priest_request', { target: userId });
  return !error && typeof data === 'number' && data > 0;
}

export async function denyPriestRequest(userId: string): Promise<boolean> {
  const { data, error } = await supabase.rpc('deny_priest_request', { target: userId });
  return !error && typeof data === 'number' && data > 0;
}
