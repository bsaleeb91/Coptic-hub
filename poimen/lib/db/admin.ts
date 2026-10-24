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

// A null church_id/church_name is the synthetic trailing row for
// accounts that never picked a church (get_church_breakdown), not a
// church record with a missing name.
export interface ChurchBreakdown {
  church_id: string | null;
  church_name: string | null;
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

// months: how many months back, including this one; null = all time.
// The one-argument function comes from 20261023010000_monthly_activity_range.sql.
// Until that migration is applied, fall back to the fixed six-month version.
export async function getMonthlyActivity(months: number | null = 6): Promise<MonthlyActivity[]> {
  const { data, error } = await supabase.rpc('get_monthly_activity', { p_months: months });
  if (!error) return (data ?? []) as MonthlyActivity[];
  const fallback = await supabase.rpc('get_monthly_activity');
  return (fallback.data ?? []) as MonthlyActivity[];
}

export async function getChurchBreakdown(): Promise<ChurchBreakdown[]> {
  const { data } = await supabase.rpc('get_church_breakdown');
  return (data ?? []) as ChurchBreakdown[];
}

