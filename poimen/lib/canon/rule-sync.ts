// lib/canon/rule-sync.ts
// Mirrors the personal prayer rule to Supabase agent_progress under the slug
// 'personal-rule'. Local (AsyncStorage) stays authoritative; the cloud copy is a
// last-write-wins backup so the rule survives a reinstall / new device.

import * as db from '@/lib/db';
import { RuleConfig, hasStoredRule, importRule, loadRule } from './rule-store';

export const RULE_SLUG = 'personal-rule';

// If no rule is stored on this device yet, pull one from the cloud. Returns the
// hydrated rule, or null if there was nothing to hydrate.
export async function hydrateRuleFromCloud(userId: string): Promise<RuleConfig | null> {
  try {
    if (await hasStoredRule()) return null;
    const payload = await db.getAgentProgress(userId, RULE_SLUG);
    if (payload?.rule) return await importRule(payload.rule);
  } catch {
    // Offline or no row yet — local default stands.
  }
  return null;
}

// Push the current local rule to the cloud. Fire-and-forget after each save.
export async function pushRuleToCloud(userId: string, rule?: RuleConfig): Promise<void> {
  try {
    const r = rule ?? (await loadRule());
    await db.upsertAgentProgress({
      user_id: userId,
      agent_slug: RULE_SLUG,
      payload: { rule: r },
      updated_at: new Date().toISOString(),
    });
  } catch {
    // Best-effort mirror.
  }
}
