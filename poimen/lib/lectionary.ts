// lib/lectionary.ts
// The Gospel of the day from the Coptic lectionary (Katameros), via the
// community Katameros API (NKJV text), cached per local date on-device.
// Nothing is computed locally — the reading follows the Church's actual
// lectionary, including all movable seasons, so we never risk fabricating a
// reading. If the API is unreachable, a cached reading from a PREVIOUS day is
// deliberately not reused (readings are day-specific); callers fall back to a
// static prompt instead.
//
// Note: the API sends no CORS headers, so this works on native but not from a
// web browser — web builds show the fallback. (A small proxy, e.g. a Supabase
// Edge Function, would lift that if web needs it.)

import AsyncStorage from '@react-native-async-storage/async-storage';

const CACHE_KEY = 'poimen.lectionary.gospel';
const API = 'https://api.katameros.app/readings/gregorian';
const NKJV_BIBLE_ID = 2;

export interface GospelVerse { number: number; text: string; }
export interface GospelPassage { book: string; chapter: number; ref: string; verses: GospelVerse[]; }
export interface DayGospel {
  date: string;       // local YYYY-MM-DD this reading belongs to
  reference: string;  // e.g. "Matthew 4:23-25; 5:1-16"
  passages: GospelPassage[];
}

function localDateStr(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function ddmmyyyy(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getDate())}-${p(d.getMonth() + 1)}-${d.getFullYear()}`;
}

// The day's Liturgy Gospel: cached if already fetched today, else fetched.
export async function fetchDayGospel(date: Date = new Date()): Promise<DayGospel | null> {
  const key = localDateStr(date);
  try {
    const raw = await AsyncStorage.getItem(CACHE_KEY);
    if (raw) {
      const cached = JSON.parse(raw) as DayGospel;
      if (cached?.date === key && cached.passages?.length) return cached;
    }
  } catch {}

  try {
    const res = await fetch(`${API}/${ddmmyyyy(date)}?bibleId=${NKJV_BIBLE_ID}`);
    if (!res.ok) return null;
    const data = await res.json();
    const liturgy = (data?.sections ?? []).find((s: any) => s?.title === 'Liturgy');
    const psalmGospel = (liturgy?.subSections ?? []).find((ss: any) => String(ss?.title ?? '').includes('Gospel'));

    const passages: GospelPassage[] = [];
    for (const reading of psalmGospel?.readings ?? []) {
      for (const p of reading?.passages ?? []) {
        const book = String(p?.bookTranslation ?? '');
        if (!book || book.startsWith('Psalm')) continue; // skip the psalm before the Gospel
        const verses: GospelVerse[] = (p?.verses ?? [])
          .map((v: any) => ({ number: Number(v?.number), text: String(v?.text ?? '').trim() }))
          .filter((v: GospelVerse) => v.text && Number.isFinite(v.number));
        if (verses.length) passages.push({ book, chapter: Number(p?.chapter), ref: String(p?.ref ?? ''), verses });
      }
    }
    if (!passages.length) return null;

    const reference = passages
      .map((p, i) => (i === 0 || passages[i - 1].book !== p.book ? `${p.book} ${p.ref}` : p.ref))
      .join('; ');
    const result: DayGospel = { date: key, reference, passages };
    try { await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(result)); } catch {}
    return result;
  } catch {
    return null;
  }
}

// A short excerpt for meditation: the CLOSING verses of the Gospel reading —
// a pericope's teaching usually lands at its end ("let your light so shine…",
// "will He really find faith on the earth?"), where its opening is often
// scene-setting narrative.
export function gospelExcerpt(g: DayGospel, maxVerses = 3): { text: string; ref: string } {
  const p = g.passages[g.passages.length - 1];
  const verses = p.verses.slice(-maxVerses);
  const first = verses[0];
  const last = verses[verses.length - 1];
  const ref = `${p.book} ${p.chapter}:${first.number}${last.number > first.number ? `–${last.number}` : ''}`;
  return { text: verses.map(v => v.text).join(' '), ref };
}
