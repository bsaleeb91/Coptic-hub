// lib/last-route.ts
// Remembers the screen the user was last on, so returning to the app lands
// them where they left off instead of back at Home.
//
// Nothing in the app resets navigation on its own — a stack/drawer can only
// lose its state by remounting — so this is really about COLD STARTS: iOS (and
// Expo Go especially) reclaims backgrounded apps, and the JS context restarts
// with a fresh navigator whose state is the initial route. React Navigation
// does not persist that across launches, so we persist it ourselves.
//
// Only param-free routes are remembered: restoring something like the priest's
// member detail without its `id` would land on a broken screen, so those fall
// back to the last plain route (their section root, in practice).

// Per-user-scoped (see lib/storage.ts) — a route like the FOC's member list
// shouldn't leak between accounts sharing a device.
import { userStorage as AsyncStorage } from '@/lib/storage';

const KEY = 'poimen.lastRoute';

// Beyond this, a return feels like a fresh start and Home is the better
// landing place than wherever the app happened to be days ago.
const MAX_AGE_MS = 6 * 60 * 60 * 1000;   // 6 hours

// Screens that can't stand alone without route params.
const NEEDS_PARAMS = new Set(['member', 'assign-canon', 'log-encounter', 'student', 'link-to-foc']);

// Never restore onto these.
const NEVER = new Set(['sign-in', '_sitemap', '+not-found']);

interface Stored { href: string; at: number; }

// True once this launch has shown the sign-in screen. Signing in is a
// deliberate entry and belongs on Home — restoring the account's last screen
// there dropped people straight onto Profile (or wherever they had been), which
// is not what "come back where I left off" means. Only a genuine cold start
// into an already-signed-in session should restore.
//
// Module scope rather than a ref inside RouteMemory: the component unmounts
// across the post-sign-in redirect, so a ref would be back to false by the time
// the restore runs.
let sawSignIn = false;
export function noteSignInScreen(): void { sawSignIn = true; }
export function signedInThisLaunch(): boolean { return sawSignIn; }

// Build an href from expo-router segments, e.g. ['(tabs)','psalms'] → '/(tabs)/psalms'.
// Groups are kept so '(tabs)/index' and '(priest)/index' stay distinct.
export function hrefFromSegments(segments: string[]): string {
  return '/' + segments.join('/');
}

export function isRestorable(segments: string[]): boolean {
  if (!segments.length) return false;
  return !segments.some(s => NEEDS_PARAMS.has(s) || NEVER.has(s));
}

export async function saveLastRoute(href: string): Promise<void> {
  try { await AsyncStorage.setItem(KEY, JSON.stringify({ href, at: Date.now() } satisfies Stored)); } catch {}
}

// The remembered route, or null when there is none, it's stale, or it's no
// longer restorable.
export async function loadLastRoute(now = Date.now()): Promise<string | null> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Stored;
    if (typeof parsed?.href !== 'string' || typeof parsed?.at !== 'number') return null;
    if (now - parsed.at > MAX_AGE_MS) return null;
    const segments = parsed.href.split('/').filter(Boolean);
    return isRestorable(segments) ? parsed.href : null;
  } catch { return null; }
}

export async function clearLastRoute(): Promise<void> {
  try { await AsyncStorage.removeItem(KEY); } catch {}
}
