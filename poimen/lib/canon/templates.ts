// lib/canon/templates.ts
// Priest canon templates: a named snapshot of the assign-canon editor, so a
// rule prescribed often doesn't have to be rebuilt from scratch for each
// member. Building from scratch is untouched — a template only fills the
// editor in, and nothing reaches the member until the priest saves.
//
// A template stores the SAME payloads an assignment stores, so applying one
// runs through the existing applyCategoryToRule and can't drift from how a
// real assignment behaves.
//
// Cloud-backed per priest (see the 20260811 migration). In demo mode — where
// there is no account — a local key stands in so the flow can be exercised.

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as db from '@/lib/db';
import { AssignedCategory } from './assigned';

const DEMO_KEY = 'poimen.demo.canonTemplates';

export interface TemplatePart {
  category: AssignedCategory;   // a structured category ('custom' lives below)
  component: string;            // the human-readable summary, for display
  payload: any;                 // exactly what assignCategory would write
}

export interface TemplateCustom {
  text: string;
  freq: string;
  days: number[];
}

export interface CanonTemplateBody {
  parts: TemplatePart[];
  custom: TemplateCustom[];
}

export interface CanonTemplate {
  id: string;
  name: string;
  body: CanonTemplateBody;
  createdAt: string;
}

// Tolerate anything on disk or in the column; a malformed template reads as
// empty rather than throwing inside the editor.
function coerceBody(raw: any): CanonTemplateBody {
  const parts = Array.isArray(raw?.parts)
    ? raw.parts.filter((p: any) => p && typeof p.category === 'string')
        .map((p: any) => ({ category: p.category, component: String(p.component ?? ''), payload: p.payload ?? null }))
    : [];
  const custom = Array.isArray(raw?.custom)
    ? raw.custom.filter((c: any) => c && typeof c.text === 'string' && c.text.trim())
        .map((c: any) => ({
          text: String(c.text), freq: String(c.freq ?? 'Daily'),
          days: Array.isArray(c.days) ? c.days.filter((d: any) => Number.isInteger(d)) : [],
        }))
    : [];
  return { parts, custom };
}

const coerce = (r: any): CanonTemplate => ({
  id: String(r?.id ?? ''),
  name: String(r?.name ?? 'Untitled'),
  body: coerceBody(r?.body),
  createdAt: String(r?.created_at ?? r?.createdAt ?? ''),
});

// ─── Demo store ───────────────────────────────────────────────────────────────

async function loadDemo(): Promise<CanonTemplate[]> {
  try {
    const raw = await AsyncStorage.getItem(DEMO_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr.map(coerce) : [];
  } catch { return []; }
}

async function saveDemo(list: CanonTemplate[]): Promise<void> {
  try { await AsyncStorage.setItem(DEMO_KEY, JSON.stringify(list)); } catch {}
}

// ─── API ──────────────────────────────────────────────────────────────────────

export async function loadTemplates(priestId: string, demoMode: boolean): Promise<CanonTemplate[]> {
  if (demoMode) return loadDemo();
  if (!priestId) return [];
  return (await db.getCanonTemplates(priestId)).map(coerce);
}

export async function saveTemplate(
  priestId: string, demoMode: boolean, name: string, body: CanonTemplateBody,
): Promise<{ error: string | null }> {
  const clean = name.trim();
  if (!clean) return { error: 'Give the template a name.' };
  if (!body.parts.length && !body.custom.length) {
    return { error: 'Turn on at least one part of the canon first.' };
  }
  if (demoMode) {
    const list = await loadDemo();
    await saveDemo([{ id: `tpl-${Date.now()}`, name: clean, body, createdAt: new Date().toISOString() }, ...list]);
    return { error: null };
  }
  return db.createCanonTemplate(priestId, clean, body);
}

export async function replaceTemplate(
  id: string, demoMode: boolean, body: CanonTemplateBody,
): Promise<{ error: string | null }> {
  if (demoMode) {
    const list = await loadDemo();
    await saveDemo(list.map(t => (t.id === id ? { ...t, body } : t)));
    return { error: null };
  }
  return db.updateCanonTemplate(id, { body });
}

export async function renameTemplate(
  id: string, demoMode: boolean, name: string,
): Promise<{ error: string | null }> {
  const clean = name.trim();
  if (!clean) return { error: 'Give the template a name.' };
  if (demoMode) {
    const list = await loadDemo();
    await saveDemo(list.map(t => (t.id === id ? { ...t, name: clean } : t)));
    return { error: null };
  }
  return db.updateCanonTemplate(id, { name: clean });
}

export async function deleteTemplate(id: string, demoMode: boolean): Promise<{ error: string | null }> {
  if (demoMode) {
    const list = await loadDemo();
    await saveDemo(list.filter(t => t.id !== id));
    return { error: null };
  }
  return db.deleteCanonTemplate(id);
}

// A one-line description of what a template sets, for the picker rows.
export function describeTemplate(t: CanonTemplate): string {
  const bits = t.body.parts.map(p => p.component).filter(Boolean);
  if (t.body.custom.length) {
    bits.push(`${t.body.custom.length} custom component${t.body.custom.length === 1 ? '' : 's'}`);
  }
  return bits.length ? bits.join(' · ') : 'Empty template';
}
