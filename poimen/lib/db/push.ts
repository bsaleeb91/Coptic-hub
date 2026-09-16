// lib/db/push.ts
// Push tokens and push preferences.
//
// Both tables are owner-only under RLS (20260915010000_push_notifications.sql),
// so every query here is implicitly scoped to the signed-in member — there is
// no path by which one account reads another's device token or reminder hour.
//
// Nothing in this module sends anything. Sending is the outbox's job, and the
// outbox is invisible to clients on purpose.

import { supabase } from '@/lib/supabase';

export type PushCategory = 'appointments' | 'assignments' | 'canon_nudge' | 'reengagement';

export interface PushPrefs {
  timezone: string;
  nudge_hour: number;
  quiet_from: number;
  quiet_to: number;
  appointments: boolean;
  assignments: boolean;
  canon_nudge: boolean;
  reengagement: boolean;
}

// Matches the column defaults in the migration. Used when no row exists yet,
// so the settings screen can render before the first write rather than
// flashing empty switches.
export const DEFAULT_PUSH_PREFS: PushPrefs = {
  timezone: 'UTC',
  nudge_hour: 20,
  quiet_from: 21,
  quiet_to: 7,
  appointments: true,
  assignments: true,
  canon_nudge: false,
  reengagement: false,
};

// ─── Tokens ──────────────────────────────────────────────────────────────────

// Upsert on the token itself, not on the user: one member may have several
// devices, and the same device reinstalled gets a new token rather than
// mutating the old row. `disabled_at: null` is set explicitly so a token the
// worker retired — then re-registered by a reinstall — comes back to life.
export async function registerPushToken(params: {
  userId: string;
  token: string;
  platform: 'ios' | 'android';
  deviceLabel?: string | null;
}): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from('push_tokens')
    .upsert({
      user_id: params.userId,
      expo_token: params.token,
      platform: params.platform,
      device_label: params.deviceLabel ?? null,
      last_seen_at: new Date().toISOString(),
      disabled_at: null,
    }, { onConflict: 'expo_token' });
  return { error: error?.message ?? null };
}

// Called when the member turns push off, or when the OS reports permission has
// been revoked. Deleted rather than disabled: `disabled_at` means "Expo told us
// this is dead", and conflating that with "the member said no" would lose the
// distinction the worker's receipt handling depends on.
export async function removePushToken(token: string): Promise<{ error: string | null }> {
  const { error } = await supabase.from('push_tokens').delete().eq('expo_token', token);
  return { error: error?.message ?? null };
}

export async function listMyPushTokens(userId: string): Promise<
  { expo_token: string; platform: string; device_label: string | null; disabled_at: string | null }[]
> {
  const { data, error } = await supabase
    .from('push_tokens')
    .select('expo_token, platform, device_label, disabled_at')
    .eq('user_id', userId);
  if (error) return [];
  return data ?? [];
}

// ─── Preferences ─────────────────────────────────────────────────────────────

// Null means "no row yet", which the caller shows as the defaults above. It is
// deliberately distinct from an error: a member who has never opened the push
// settings has no row, and that is not a failure.
export async function getPushPrefs(userId: string): Promise<PushPrefs | null> {
  const { data, error } = await supabase
    .from('push_prefs')
    .select('timezone, nudge_hour, quiet_from, quiet_to, appointments, assignments, canon_nudge, reengagement')
    .eq('user_id', userId)
    .maybeSingle();
  if (error || !data) return null;
  return data as PushPrefs;
}

export async function savePushPrefs(
  userId: string,
  prefs: Partial<PushPrefs>,
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from('push_prefs')
    .upsert({ user_id: userId, ...prefs, updated_at: new Date().toISOString() }, { onConflict: 'user_id' });
  return { error: error?.message ?? null };
}

// ─── Canon day state ─────────────────────────────────────────────────────────

// COUNTS ONLY — never which items. The server needs exactly enough to know
// whether a canon nudge would be wrong, and "2 of 5" is that. See the migration
// for why the finer-grained version is not on offer.
//
// `day` is the member's LOCAL calendar day as the phone computed it; the server
// never derives it from a timestamp, because the phone is the authority on what
// day it is for the person holding it.
export async function syncCanonDayState(params: {
  userId: string;
  day: string;          // YYYY-MM-DD, local
  dueCount: number;
  doneCount: number;
}): Promise<void> {
  try {
    await supabase.from('canon_day_state').upsert({
      user_id: params.userId,
      day: params.day,
      due_count: params.dueCount,
      done_count: params.doneCount,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id,day' });
  } catch {
    // Best-effort. A missed sync means the server declines to nudge, which is
    // the safe direction: silence rather than a reminder that might be wrong.
  }
}
