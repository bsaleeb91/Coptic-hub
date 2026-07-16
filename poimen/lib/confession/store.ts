// lib/confession/store.ts
// On-device store for the confession journal (incidents) and examination of
// conscience, ported from Nepsis. Per the storage decision, this data is
// ENCRYPTED ON-DEVICE ONLY: the whole payload is serialized and encrypted with
// Poimen's tweetnacl secretbox (device-only key in SecureStore) before it
// touches AsyncStorage, and never syncs to Supabase. Everything is wiped when
// the user permanently deletes their notes after confession.

import AsyncStorage from '@react-native-async-storage/async-storage';
import { encryptNote, decryptNote } from '@/lib/crypto';
import type { JournalIncident, IncidentCategory, ExamChecks } from './types';

const K_INCIDENTS = 'poimen.confession.incidents';
const K_EXAM      = 'poimen.confession.exam';

// A collision-resistant id that doesn't rely on crypto (Hermes-safe).
function makeId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
}

// Read + decrypt a JSON blob; returns the fallback on any error / empty.
async function readEncrypted<T>(key: string, fallback: T): Promise<T> {
  try {
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return fallback;
    const json = await decryptNote(raw);
    const parsed = JSON.parse(json);
    return (parsed ?? fallback) as T;
  } catch {
    return fallback;
  }
}

// Encrypt + write a JSON blob.
async function writeEncrypted(key: string, value: unknown): Promise<void> {
  try {
    const cipher = await encryptNote(JSON.stringify(value));
    await AsyncStorage.setItem(key, cipher);
  } catch (e) {
    // Never throw into the UI, but surface it in dev — a silent failure here
    // means entries vanish on next load (see the "no PRNG" incident).
    console.warn(`[confession] failed to persist ${key}:`, e);
  }
}

// ─── Journal incidents ─────────────────────────────────────────────────────────

export async function loadIncidents(): Promise<JournalIncident[]> {
  const list = await readEncrypted<JournalIncident[]>(K_INCIDENTS, []);
  if (!Array.isArray(list)) return [];
  // Newest first.
  return [...list].sort((a, b) => b.createdAt - a.createdAt);
}

export async function addIncident(
  input: { category: IncidentCategory; sinId?: string; title: string; note: string },
): Promise<JournalIncident[]> {
  const list = await loadIncidents();
  const incident: JournalIncident = {
    id: makeId(),
    category: input.category,
    sinId: input.sinId,
    title: input.title.trim() || 'Untitled',
    note: input.note.trim(),
    createdAt: Date.now(),
  };
  const next = [incident, ...list];
  await writeEncrypted(K_INCIDENTS, next);
  return next;
}

export async function deleteIncident(id: string): Promise<JournalIncident[]> {
  const list = await loadIncidents();
  const next = list.filter(i => i.id !== id);
  await writeEncrypted(K_INCIDENTS, next);
  return next;
}

export async function clearIncidents(): Promise<void> {
  try { await AsyncStorage.removeItem(K_INCIDENTS); } catch {}
}

// ─── Examination of conscience ─────────────────────────────────────────────────

export async function loadExam(): Promise<ExamChecks> {
  const obj = await readEncrypted<ExamChecks>(K_EXAM, {});
  return obj && typeof obj === 'object' ? obj : {};
}

export async function saveExam(checks: ExamChecks): Promise<void> {
  await writeEncrypted(K_EXAM, checks);
}

export async function clearExam(): Promise<void> {
  try { await AsyncStorage.removeItem(K_EXAM); } catch {}
}

// ─── Examination style ─────────────────────────────────────────────────────────
// Which organization of the examination the user prefers: the Nepsis
// senses-based sin catalogue, or Poimen's original relational questions
// (Toward God / Others / Self / Omissions). A plain UI preference — not
// encrypted. Checks from both styles share the exam store above.

const K_EXAM_STYLE = 'poimen.confession.examStyle';
export type ExamStyle = 'senses' | 'relational';

export async function loadExamStyle(): Promise<ExamStyle> {
  try {
    return (await AsyncStorage.getItem(K_EXAM_STYLE)) === 'relational' ? 'relational' : 'senses';
  } catch { return 'senses'; }
}

export async function saveExamStyle(style: ExamStyle): Promise<void> {
  try { await AsyncStorage.setItem(K_EXAM_STYLE, style); } catch {}
}
