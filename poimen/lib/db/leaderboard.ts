// lib/db/leaderboard.ts
// The class psalm leaderboard.
//
// Reads go through the psalm_leaderboard() RPC rather than a table query: a
// member has no rights over another member's profile or agent_progress, and
// this feature must not grant any. The function returns a finished board and
// nothing queryable behind it. See 20260907030000_psalm_leaderboard.sql.

import { supabase } from '@/lib/supabase';

export interface LeaderboardRow {
  user_id: string;
  display_name: string;   // "Mina G." — classmates know each other; full names aren't needed
  streak: number;
  longest: number;
  mastered: number;
  is_self: boolean;
}

// Empty means any of: not opted in, no servant/class, or nobody in the class
// has opted in yet. The screen tells those apart using the member's own
// consent flag rather than guessing from an empty list.
export async function getPsalmLeaderboard(): Promise<LeaderboardRow[]> {
  const { data, error } = await supabase.rpc('psalm_leaderboard');
  if (error) return [];
  return (data as LeaderboardRow[]) ?? [];
}

export async function setLeaderboardConsent(
  userId: string,
  consent: boolean,
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from('profiles')
    .update({ psalm_leaderboard_consent: consent })
    .eq('id', userId);
  return { error: error?.message ?? null };
}
