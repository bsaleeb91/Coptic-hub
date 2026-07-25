// lib/canon/assigned.ts
// Priest-assigned canon: the Father of Confession builds parts of a member's
// personal rule from the member detail view. Each assigned part names a canon
// category and carries a structured payload; the member's app merges the
// assigned (locked) parts over their own self-set rule.
//
// Lock model — an active assigned category is READ-ONLY for the member until:
//   • their first confession STRICTLY AFTER the day it was assigned (a same-day
//     confession — the meeting where it was given — does not release it), at
//     which point its value is folded into the member's own rule to edit; or
//   • the priest removes/replaces it.
// Dates are compared as the member's LOCAL calendar day.
// Storage is Bishoy's cross-account `spiritual_canons` table (see the db layer
// and the 20260717 migration). In demo mode — where priest and member are the
// same device — a local key stands in so the whole flow can be exercised.

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as db from '@/lib/db';
import { RuleConfig, ServiceCommitment, ReadMode, loadRule, saveRule } from './rule-store';
import { pushRuleToCloud } from './rule-sync';
import { lastConfessionDate } from '@/lib/confession/dates';

export type AssignedCategory =
  | 'prostrations' | 'quiet' | 'fasting' | 'bible' | 'book' | 'confession'
  | 'agpeya_hours' | 'services' | 'heart_of_service' | 'custom';

// Categories that map to an editable field of the personal rule (custom does not).
export const STRUCTURED_CATEGORIES: AssignedCategory[] = [
  'prostrations', 'quiet', 'fasting', 'bible', 'book', 'confession',
  'agpeya_hours', 'services', 'heart_of_service',
];

export const CATEGORY_LABEL: Record<AssignedCategory, string> = {
  prostrations:     'Prostrations',
  quiet:            'Quiet time',
  fasting:          'Fasting',
  bible:            'Bible reading',
  book:             'Spiritual book',
  confession:       'Confession frequency',
  agpeya_hours:     'Agpeya hours',
  services:         'Church services',
  heart_of_service: 'Heart of Service',
  custom:           'Custom',
};

export interface AssignedCanon {
  id: string;
  category: AssignedCategory;
  component: string;   // human-readable label, or the free text for 'custom'
  payload: any;        // structured value for the category (see migration)
  frequency: string;
  startDate: string;
  createdAt: string;   // ISO — used to compute the lock against last confession
  priestId: string | null;  // who assigned it (null = the member's own self-assigned row)
}

export interface CustomComponent {
  id: string;
  text: string;
  frequency: string;
  days: number[] | null;   // weekday indices (0 = Sunday); null/empty = every day
  locked: boolean;
}

// The three categories the member configures per weekday. A priest can lock
// only the specific weekdays they set for these, leaving the member's other
// days untouched and editable.
export const DAY_CATEGORIES: AssignedCategory[] = ['agpeya_hours', 'services', 'heart_of_service'];

export interface CanonOverlay {
  rule: RuleConfig;                          // personal rule with locked parts overlaid
  lockedCategories: Set<AssignedCategory>;   // "every day" categories currently priest-locked
  // For day-based categories, which weekday indices (0=Sun..6=Sat) the priest locked.
  lockedDays: Record<'agpeya_hours' | 'services' | 'heart_of_service', Set<number>>;
  customComponents: CustomComponent[];       // priest-added free-text lines
  hasAssignment: boolean;                    // any active assignment at all
}

function emptyLockedDays(): CanonOverlay['lockedDays'] {
  return { agpeya_hours: new Set(), services: new Set(), heart_of_service: new Set() };
}

// ─── Normalization ────────────────────────────────────────────────────────────

export function normalizeAssigned(rows: any[]): AssignedCanon[] {
  return (rows ?? []).map(r => ({
    id: String(r.id),
    category: (r.category ?? 'custom') as AssignedCategory,
    component: String(r.component ?? ''),
    payload: r.payload ?? null,
    frequency: String(r.frequency ?? 'Daily'),
    startDate: String(r.start_date ?? r.startDate ?? ''),
    createdAt: String(r.created_at ?? r.createdAt ?? new Date().toISOString()),
    priestId: (r.priest_id ?? r.priestId ?? null) as string | null,
  }));
}

// The member's LOCAL calendar day (YYYY-MM-DD) for an assignment's timestamp.
// created_at is stored in UTC; confession dates are the member's local day, so
// we convert to the local day to compare on the same basis.
function createdLocalDay(a: AssignedCanon): string {
  const d = new Date(a.createdAt);
  if (isNaN(d.getTime())) return a.createdAt.slice(0, 10);
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

// A local YYYY-MM-DD or null (from confession/dates.lastConfessionDate). An
// assignment is locked until the member confesses STRICTLY AFTER the day it was
// assigned — a confession on the same day (the meeting where it was given)
// doesn't release it, and with no confession on record it stays locked.
// Unlocked iff lastConfession > createdAt-local-day.
export function isLocked(a: AssignedCanon, lastConfession: string | null): boolean {
  if (!lastConfession) return true;
  return createdLocalDay(a) >= lastConfession;
}

// Weekday indices (0=Sun..6=Sat) the priest actually set for a day-based
// category — only these are locked; days left empty stay the member's own.
function assignedDayIndices(a: AssignedCanon): number[] {
  const map = a.payload?.days ?? {};
  const out: number[] = [];
  for (let i = 0; i < 7; i++) {
    const v = map[i] ?? map[String(i)];
    const nonEmpty = a.category === 'heart_of_service'
      ? Array.isArray(v) && v.some((e: any) => String(e?.text ?? '').trim())
      : Array.isArray(v) && v.length > 0;
    if (nonEmpty) out.push(i);
  }
  return out;
}

// ─── Overlay (member's effective canon) ───────────────────────────────────────

function cloneRule(rule: RuleConfig): RuleConfig {
  return {
    ...rule,
    bible: { ...rule.bible },
    book: rule.book ? { ...rule.book } : null,
    days: rule.days.map(d => ({
      hours: [...d.hours],
      services: [...d.services],
      serving: d.serving.map(s => ({ ...s })),
    })),
  };
}

function daysFromPayload<T>(payload: any, fallback: () => T): T[] {
  const map = payload?.days ?? {};
  return Array.from({ length: 7 }, (_, i) => (map[i] ?? map[String(i)] ?? fallback()) as T);
}

// Write one assigned category's value into a (cloned) rule.
export function applyCategoryToRule(rule: RuleConfig, a: AssignedCanon): void {
  const p = a.payload ?? {};
  switch (a.category) {
    case 'prostrations': rule.prostrations = Number(p.count ?? 0); break;
    case 'quiet':        rule.quietMinutes = Number(p.minutes ?? 0); break;
    case 'fasting':      rule.fastUntil = String(p.until ?? rule.fastUntil); break;
    case 'bible':        rule.bible = { mode: (p.mode ?? 'chapters') as ReadMode, amount: Number(p.amount ?? 1) }; break;
    case 'book':
      rule.book = p && p.title != null
        ? { title: String(p.title ?? ''), mode: (p.mode ?? 'chapters') as ReadMode, amount: Number(p.amount ?? 1) }
        : null;
      break;
    case 'confession':   rule.confession = String(p.frequency ?? rule.confession); break;
    // Day-based categories MERGE per weekday: only the days the priest actually
    // set (non-empty) override the member's — days left empty keep the member's
    // own value, so assigning one weekday never wipes the others.
    case 'agpeya_hours': {
      const days = daysFromPayload<string[]>(p, () => []);
      rule.days = rule.days.map((d, i) => (days[i].length > 0 ? { ...d, hours: days[i] } : d));
      break;
    }
    case 'services': {
      const days = daysFromPayload<string[]>(p, () => []);
      rule.days = rule.days.map((d, i) => (days[i].length > 0 ? { ...d, services: days[i] } : d));
      break;
    }
    case 'heart_of_service': {
      const days = daysFromPayload<ServiceCommitment[]>(p, () => []);
      rule.days = rule.days.map((d, i) => (
        days[i].some(e => String(e?.text ?? '').trim()) ? { ...d, serving: days[i] } : d
      ));
      break;
    }
  }
}

export function applyOverlay(rule: RuleConfig, assigned: AssignedCanon[], lastConfession: string | null): CanonOverlay {
  const eff = cloneRule(rule);
  const lockedCategories = new Set<AssignedCategory>();
  const lockedDays = emptyLockedDays();
  const customComponents: CustomComponent[] = [];
  for (const a of assigned) {
    const locked = isLocked(a, lastConfession);
    if (a.category === 'custom') {
      const days = Array.isArray(a.payload?.days)
        ? a.payload.days.filter((d: any) => Number.isInteger(d) && d >= 0 && d <= 6)
        : null;
      customComponents.push({ id: a.id, text: a.component, frequency: a.frequency, days, locked });
      continue;
    }
    if (!locked) continue;   // member has confessed since — their own (folded) value stands
    if (DAY_CATEGORIES.includes(a.category)) {
      applyCategoryToRule(eff, a);
      const set = lockedDays[a.category as 'agpeya_hours' | 'services' | 'heart_of_service'];
      for (const i of assignedDayIndices(a)) set.add(i);
    } else {
      lockedCategories.add(a.category);
      applyCategoryToRule(eff, a);
    }
  }
  return { rule: eff, lockedCategories, lockedDays, customComponents, hasAssignment: (assigned ?? []).length > 0 };
}

// Map a today's-canon item key (from lib/canon/today) back to the assigned
// category it belongs to, so the Canon list can badge priest-locked items.
export function categoryForItemKey(key: string): AssignedCategory | null {
  if (key === 'prostrations') return 'prostrations';
  if (key === 'quiet') return 'quiet';
  if (key === 'fast') return 'fasting';
  if (key === 'bible') return 'bible';
  if (key === 'book') return 'book';
  if (key.startsWith('hour_')) return 'agpeya_hours';
  if (key.startsWith('svc_')) return 'services';
  if (key.startsWith('serve_')) return 'heart_of_service';
  return null;
}

// Fold the assignments RELEASED by this confession permanently into the personal
// rule (so the member then owns and can edit them). "Released" means it was
// locked before this confession (createdAt-day >= oldLatest) but is unlocked
// after it (createdAt-day < newLatest) — i.e. this confession is the first one
// strictly after it was assigned. Anything still locked, or already folded, is
// left alone, so a back-dated confession that doesn't advance the latest date
// folds nothing. Custom free-text components have no rule field and are skipped.
export function foldReleasedIntoRule(
  rule: RuleConfig, assigned: AssignedCanon[], oldLatest: string | null, newLatest: string | null,
): RuleConfig {
  const next = cloneRule(rule);
  let changed = false;
  for (const a of assigned) {
    if (a.category === 'custom') continue;
    const wasLocked = isLocked(a, oldLatest);
    const nowLocked = isLocked(a, newLatest);
    if (wasLocked && !nowLocked) { applyCategoryToRule(next, a); changed = true; }
  }
  return changed ? next : rule;
}

// ─── Loading / writing (demo-aware) ───────────────────────────────────────────
// Demo mode keeps assignments in one local key so the priest→member flow can be
// walked on a single device. `member` is ignored in demo (the demo congregant
// is generic), so any assign shows up in the demo member's own Canon.

const DEMO_KEY = 'poimen.demo.assignedCanon';

async function loadDemoAssigned(): Promise<AssignedCanon[]> {
  try {
    const raw = await AsyncStorage.getItem(DEMO_KEY);
    return raw ? normalizeAssigned(JSON.parse(raw)) : [];
  } catch { return []; }
}
async function saveDemoAssigned(list: AssignedCanon[]): Promise<void> {
  try { await AsyncStorage.setItem(DEMO_KEY, JSON.stringify(list)); } catch {}
}

// The member reads what their FOC has assigned them. The live spiritual_canons
// table also holds the member's own self-assigned rows (priest_id null) and
// Sunday-school servant assignments (priest_id = the servant) — only rows from
// the member's actual Father of Confession lock the personal rule, so filter
// by focId. With no FOC on the profile nothing is treated as assigned.
export async function loadAssignedForMember(memberId: string, demoMode: boolean, focId?: string | null): Promise<AssignedCanon[]> {
  if (demoMode) return loadDemoAssigned();
  try {
    const rows = normalizeAssigned(await db.getAssignedCanonsForMember(memberId));
    return focId ? rows.filter(a => a.priestId === focId) : [];
  } catch { return []; }
}

// The priest reads what THEY have already assigned this member (editor pre-fill),
// scoped to their own priest_id so one FOC never sees/removes another's rows.
export async function loadAssignedForPriest(memberId: string, priestId: string, demoMode: boolean): Promise<AssignedCanon[]> {
  if (demoMode) return loadDemoAssigned();
  try { return normalizeAssigned(await db.getMemberActiveCanonsByPriest(memberId, priestId)); }
  catch { return []; }
}

// Priest assigns/updates one category (replacing any prior assignment for it).
export async function assignCategory(params: {
  memberId: string; priestId: string; demoMode: boolean;
  category: AssignedCategory; component: string; payload: any; frequency?: string;
}): Promise<void> {
  const { memberId, priestId, demoMode, category, component, payload, frequency } = params;
  if (demoMode) {
    const list = await loadDemoAssigned();
    // Custom components accumulate; structured categories replace.
    const kept = category === 'custom' ? list : list.filter(a => a.category !== category);
    kept.push({
      // Uniquified: two customs saved in the same millisecond must not share
      // an id — removeAssignment filters by id and would delete both.
      id: `demo-${category}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      category, component, payload: payload ?? null,
      frequency: frequency ?? 'Daily',
      startDate: new Date().toISOString().slice(0, 10),
      createdAt: new Date().toISOString(),
      priestId: priestId || null,
    });
    await saveDemoAssigned(kept);
    return;
  }
  if (category !== 'custom') {
    await db.deactivateAssignedCategory(memberId, priestId, category);
  }
  await db.insertAssignedCanon({ congregant_id: memberId, priest_id: priestId, category, component, payload, frequency });
}

// Priest removes a category's assignment (or a single custom component by id).
export async function removeAssignment(params: {
  memberId: string; priestId: string; demoMode: boolean;
  category: AssignedCategory; id?: string;
}): Promise<void> {
  const { memberId, priestId, demoMode, category, id } = params;
  if (demoMode) {
    const list = await loadDemoAssigned();
    const next = category === 'custom' && id
      ? list.filter(a => a.id !== id)
      : list.filter(a => a.category !== category);
    await saveDemoAssigned(next);
    return;
  }
  if (category === 'custom' && id) {
    await db.deactivateCanon(id);
  } else {
    await db.deactivateAssignedCategory(memberId, priestId, category);
  }
}

// At the member's confession, fold the parts RELEASED by it into their own rule,
// so those parts are now theirs to edit. Call this AFTER the new confession has
// been recorded; pass the confession date that was on record BEFORE it as
// `previousLastConfession`. The new latest date is read from the store, so a
// back-dated ("forgot to log") confession that doesn't advance the latest folds
// nothing. Best-effort — anything still locked folds at a later confession.
export async function foldOnConfession(params: {
  memberId: string; userId: string | null; demoMode: boolean; previousLastConfession: string | null;
  focId?: string | null;
}): Promise<void> {
  try {
    const { memberId, userId, demoMode, previousLastConfession, focId } = params;
    const assigned = await loadAssignedForMember(memberId, demoMode, focId);
    if (!assigned.length) return;
    const newLatest = await lastConfessionDate();   // reflects the just-recorded confession
    const rule = await loadRule();
    const next = foldReleasedIntoRule(rule, assigned, previousLastConfession, newLatest);
    if (next === rule) return;
    await saveRule(next);
    if (userId && !demoMode) await pushRuleToCloud(userId, next);
  } catch {
    // Best-effort — the fold retries on the next confession.
  }
}
