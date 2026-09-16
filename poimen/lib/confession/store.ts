// lib/confession/store.ts
// On-device store for the confession journal (incidents) and examination of
// conscience, ported from Nepsis. Per the storage decision, this data is
// ENCRYPTED ON-DEVICE ONLY: the whole payload is serialized and encrypted with
// Nepsis's tweetnacl secretbox (device-only key in SecureStore) before it
// touches AsyncStorage, and never syncs to Supabase. Everything is wiped when
// the user permanently deletes their notes after confession.

// Per-user-scoped storage (see lib/storage.ts) — keeps one account's spiritual
// data from bleeding into another's on a shared device.
import { userStorage as AsyncStorage } from '@/lib/storage';
import { encryptNote, decryptNote, rewrapLegacyNote, needsRewrap } from '@/lib/crypto';
import type { JournalIncident, IncidentCategory, ExamChecks, GuidanceNote, ConfessionRecord } from './types';

const K_INCIDENTS = 'poimen.confession.incidents';
const K_EXAM      = 'poimen.confession.exam';
const K_GUIDANCE  = 'poimen.confession.guidance';
const K_HISTORY   = 'poimen.confession.history';

// Every key holding a blob sealed under the notes key. Used by the migration
// below; keep in step with the four constants above. K_HISTORY has no legacy
// blobs to rewrap — it is newer than the re-wrap — but it is sealed the same
// way, so it belongs in the list rather than being a silent exception.
const ENCRYPTED_KEYS = [K_INCIDENTS, K_EXAM, K_GUIDANCE, K_HISTORY];

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

// ─── Legacy re-wrap ────────────────────────────────────────────────────────────
// These blobs never leave the device, so the old device-local key losing them
// was never a sync problem — but it did mean a restored install could not read
// its own journal back. Re-wrapping under the recoverable keypair fixes that
// and leaves exactly one key to look after.
//
// Only rewrites a key we successfully decrypted; anything unreadable is left
// untouched rather than replaced with an empty blob.
export async function migrateLegacyConfessionStore(): Promise<number> {
  let rewrapped = 0;
  for (const key of ENCRYPTED_KEYS) {
    try {
      const raw = await AsyncStorage.getItem(key);
      if (!raw || !needsRewrap(raw)) continue;
      const next = await rewrapLegacyNote(raw);
      if (next === null) continue;
      await AsyncStorage.setItem(key, next);
      rewrapped++;
    } catch {}
  }
  return rewrapped;
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

// ─── Guidance notes ─────────────────────────────────────────────────────────────
// For when there's nothing specific to confess but you want your Father of
// Confession's direction on something. Same on-device-only encryption as the
// journal — never syncs to Supabase.

export async function loadGuidance(): Promise<GuidanceNote[]> {
  const list = await readEncrypted<GuidanceNote[]>(K_GUIDANCE, []);
  if (!Array.isArray(list)) return [];
  // Oldest first: questions are asked in the order they came to mind.
  // `note` is the pre-2026-09-15 spelling of `text`; read across it so a
  // question written then is not shown as an empty row.
  return [...list]
    .map(g => ({ ...g, text: g.text ?? g.note ?? '' }))
    .sort((a, b) => a.createdAt - b.createdAt);
}

export async function addGuidance(text: string): Promise<GuidanceNote[]> {
  const clean = text.trim();
  const list = await loadGuidance();
  if (!clean) return list;
  const next = [...list, { id: makeId(), text: clean, createdAt: Date.now() }];
  await writeEncrypted(K_GUIDANCE, next);
  return next;
}

export async function deleteGuidance(id: string): Promise<GuidanceNote[]> {
  const list = await loadGuidance();
  const next = list.filter(g => g.id !== id);
  await writeEncrypted(K_GUIDANCE, next);
  return next;
}

export async function clearGuidance(): Promise<void> {
  try { await AsyncStorage.removeItem(K_GUIDANCE); } catch {}
}

// ─── Confession history ────────────────────────────────────────────────────────
// Snapshots taken at "Record this confession". Encrypted like everything else
// here and NEVER synced — this is the one place a pattern of sins is written
// down over time, and it stays on the phone. Deleting the period's notes
// after a confession does not touch it; the user removes records here.

const localDay = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export async function loadHistory(): Promise<ConfessionRecord[]> {
  const list = await readEncrypted<ConfessionRecord[]>(K_HISTORY, []);
  if (!Array.isArray(list)) return [];
  // Newest first.
  return [...list].sort((a, b) => b.recordedAt - a.recordedAt);
}

// Snapshot the notes as they stand right now. One record per calendar day:
// tapping Record twice in a day replaces rather than duplicates, matching how
// the confession-dates store collapses same-day entries.
export async function archiveConfession(): Promise<ConfessionRecord[]> {
  const [exam, incidents, guidance, list] = await Promise.all([
    loadExam(), loadIncidents(), loadGuidance(), loadHistory(),
  ]);
  const now = new Date();
  const record: ConfessionRecord = {
    id: makeId(), date: localDay(now), recordedAt: now.getTime(),
    exam, incidents, guidance,
  };
  const next = [record, ...list.filter(r => r.date !== record.date)];
  await writeEncrypted(K_HISTORY, next);
  return next;
}

export async function deleteHistoryRecord(id: string): Promise<ConfessionRecord[]> {
  const list = await loadHistory();
  const next = list.filter(r => r.id !== id);
  await writeEncrypted(K_HISTORY, next);
  return next;
}

// ─── Examination style ─────────────────────────────────────────────────────────
// Which organization of the examination the user prefers: the Nepsis
// senses-based sin catalogue, or Nepsis's original relational questions
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
