// lib/psalms/sync.ts
// Mirrors the local (AsyncStorage) psalm-memorization state to Supabase
// agent_progress under the slug 'psalm-memorization'. Local storage stays the
// source of truth for the drill loop (fast, offline); the cloud copy is a
// last-write-wins backup so progress survives a reinstall or a new device, and
// exposes a lightweight summary for the Progress surface / Father of Confession.

import * as db from '@/lib/db';
import { exportState, importState, isLocalEmpty, computeStats } from './store';

export const PSALM_SLUG = 'psalm-memorization';

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
    await db.upsertAgentProgress({
      user_id: userId,
      agent_slug: PSALM_SLUG,
      payload: {
        snapshot,
        summary: {
          totalParts: stats.totalParts,
          mastered: stats.mastered,
          learning: stats.learning,
          newCount: stats.newCount,
          streak: snapshot.streak.current,
        },
      },
      updated_at: new Date().toISOString(),
    });
  } catch {
    // Best-effort mirror.
  }
}
