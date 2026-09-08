// lib/survey/store.ts
// Device-local record of when the survey was last offered.
//
// This lives on the device rather than the server because the survey rows
// carry no identity (see lib/db/survey.ts). That makes "already answered" a
// soft guarantee — reinstalling, or a second device, resets it. Accepted
// deliberately: the alternative is attaching a user id to the answers, which
// is the thing being given up on purpose.

// Per-user-scoped storage (see lib/storage.ts) — keeps one account's state
// from bleeding into another's on a shared device.
import { userStorage as AsyncStorage } from '@/lib/storage';
import { dayStr, type SurveyState } from './schedule';

const KEY = 'poimen.survey.state';

// NB: the key keeps the historical `poimen.` prefix that every other store on
// the device uses. Renaming the prefix would strand existing data for no gain
// a member could see — see lib/brand.ts.

export async function loadSurveyState(): Promise<SurveyState> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    const p = raw ? JSON.parse(raw) : {};
    return {
      firstSeen: typeof p?.firstSeen === 'string' ? p.firstSeen : null,
      lastPrompted: typeof p?.lastPrompted === 'string' ? p.lastPrompted : null,
    };
  } catch {
    return { firstSeen: null, lastPrompted: null };
  }
}

async function write(next: SurveyState): Promise<void> {
  try { await AsyncStorage.setItem(KEY, JSON.stringify(next)); } catch {}
}

// Stamp the first-seen date once, from the account's creation date where we
// have it (so a member who has used the app for months on another device is
// not treated as brand new) and otherwise from today.
export async function ensureFirstSeen(accountCreatedAt?: string | null): Promise<SurveyState> {
  const state = await loadSurveyState();
  if (state.firstSeen) return state;
  const seeded = accountCreatedAt ? dayStr(new Date(accountCreatedAt)) : dayStr(new Date());
  const next = { ...state, firstSeen: seeded };
  await write(next);
  return next;
}

// Called when the survey is SHOWN, not when it is submitted — dismissing must
// buy the same 5 days of quiet as answering, or dismissing is the punished
// choice and the prompt becomes a nag.
export async function markPrompted(now = new Date()): Promise<void> {
  const state = await loadSurveyState();
  await write({ ...state, lastPrompted: dayStr(now) });
}
