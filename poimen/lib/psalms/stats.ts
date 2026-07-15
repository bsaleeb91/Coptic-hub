// lib/psalms/stats.ts
// Publishes a small psalm-memorization summary to agent_progress under the
// 'psalm-stats' slug so the Father of Confession and servant can see it
// (consent-gated by RLS — same vitals_consent flag as spiritual vitals).
// The spaced-repetition state itself stays on device; this is a snapshot of
// the fruit, never the per-card review history.
import * as db from '../db';
import {
  PartCard, ReciteCard, Streak,
  computeStats, learningItem, reciteState,
} from './psalmStore';
import { itemLabel } from './agpeyaPsalter';

export interface PsalmStatsSnapshot {
  streak: number;
  counts: { mastered: number; learning: number; notStarted: number; dueToday: number };
  currentlyLearning: string | null;
  memorized: string[];   // item labels, recited in full at least once
  totalSelected: number; // items chosen to memorize
  updatedAt: string;
}

export function buildSnapshot(
  selection: string[],
  cards: Record<string, PartCard>,
  streak: Streak,
  recite: Record<string, ReciteCard>,
): PsalmStatsSnapshot {
  const stats = computeStats(selection, cards);
  const lp = learningItem(selection, cards);
  const memorized = selection
    .filter(item => {
      const st = reciteState(item, cards, recite);
      return st === 'memorized' || st === 'retest';
    })
    .map(itemLabel);
  return {
    streak: streak.current,
    counts: {
      mastered: stats.mastered,
      learning: stats.learning,
      notStarted: stats.newCount,
      dueToday: stats.dueToday,
    },
    currentlyLearning: lp ? itemLabel(lp) : null,
    memorized,
    totalSelected: selection.length,
    updatedAt: new Date().toISOString(),
  };
}

// Fire-and-forget upsert. Callers skip this in demo mode / signed out.
export async function publishPsalmStats(
  userId: string,
  selection: string[],
  cards: Record<string, PartCard>,
  streak: Streak,
  recite: Record<string, ReciteCard>,
): Promise<void> {
  try {
    await db.upsertAgentProgress({
      user_id: userId,
      agent_slug: 'psalm-stats',
      payload: buildSnapshot(selection, cards, streak, recite),
      updated_at: new Date().toISOString(),
    });
  } catch {
    // Non-fatal — the snapshot republishes on the next session.
  }
}
