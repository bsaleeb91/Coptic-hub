// lib/psalms/sync.ts
// Mirrors the local (AsyncStorage) psalm-memorization state to Supabase
// agent_progress under the slug 'psalm-memorization'. Local storage stays the
// source of truth for the drill loop (fast, offline); the cloud copy is a
// last-write-wins backup so progress survives a reinstall or a new device, and
// exposes a lightweight summary for the Progress surface / Father of Confession.

import * as db from '@/lib/db';
import { exportState, importState, isLocalEmpty, computeStats, masteredItemsCount } from './store';

export const PSALM_SLUG = 'psalm-memorization';

// A small public-ish summary, separate from the full snapshot above, that the
// congregant's Father of Confession and assigned servant may read (RLS in
// 20260713020000_psalm_stats_sharing.sql, gated on the same vitals-consent
// flags as Spiritual Vitals). Keep this payload to counts only — never psalm
// selection or card-level detail, which stay private to the congregant.
export const PSALM_STATS_SLUG = 'psalm-stats';

// Pull the cloud snapshot into local storage IF local is empty (fresh install /
// new device). Returns true when local data was hydrated from the cloud.
export async function hydratePsalmsFromCloud(userId: string): Promise<boolean> {
  try {
    if (!(await isLocalEmpty())) return false;
    const payload = await db.getAgentProgress(userId, PSALM_SLUG);
    if (payload?.snapshot?.selection) {
      await importState(payload.snapshot);
      return true;
    }
  } catch {
    // Offline or no row yet — local stays authoritative.
  }
  return false;
}

// Push the full local snapshot (+ a summary block) to the cloud. Fire-and-forget
// from the screen after each mutation; failures are swallowed so the drill never
// blocks on the network.
export async function pushPsalmsToCloud(userId: string): Promise<void> {
  try {
    const snapshot = await exportState();
    const stats = computeStats(snapshot.selection, snapshot.cards);
    const now = new Date().toISOString();
    await Promise.all([
      db.upsertAgentProgress({
        user_id: userId,
        agent_slug: PSALM_SLUG,
        payload: {
          snapshot,
          summary: {
            totalParts: stats.totalParts,
            mastered: stats.mastered,
            learning: stats.learning,
            newCount: stats.newCount,
            // Whole psalms/passages fully memorized — what the tab's "Memorized"
            // stat shows (mastered above stays portion-level for the progress bar).
            totalItems: stats.totalItems,
            itemsMemorized: stats.itemsMemorized,
            streak: snapshot.streak.current,
          },
        },
        updated_at: now,
      }),
      db.upsertAgentProgress({
        user_id: userId,
        agent_slug: PSALM_STATS_SLUG,
        payload: {
          streak: snapshot.streak.current,
          longestStreak: snapshot.streak.longest,
          mastered: stats.mastered,
          totalParts: stats.totalParts,
          masteredItems: masteredItemsCount(snapshot.selection, snapshot.cards),
        },
        updated_at: now,
      }),
    ]);
  } catch {
    // Best-effort mirror.
  }
}
