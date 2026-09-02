// lib/scheduling/calendly.ts
// A priest's Calendly link, offered to his flock as another way to book —
// alongside the in-app slots, never instead of them. The link lives on the
// priest's profile row (see the 20260828 migration); in demo mode a local key
// stands in so the priest→member flow can be walked on one device.

import AsyncStorage from '@react-native-async-storage/async-storage';
import type { SchedulingMode } from '@/lib/db/scheduling';

const DEMO_KEY = 'poimen.demo.calendlyUrl';
const DEMO_MODE_KEY = 'poimen.demo.schedulingMode';

// Accept what a priest is likely to paste — "calendly.com/fr-bishoy", a full
// https URL, an event link with a path — and return it canonicalized to https,
// or null when it isn't a Calendly address at all. Parsed by hand rather than
// with URL(), which React Native's runtime doesn't implement fully.
export function normalizeCalendlyUrl(input: string): string | null {
  const raw = input.trim();
  if (!raw) return null;
  const withScheme = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  const m = withScheme.match(/^https?:\/\/([^/?#]+)([/?#].*)?$/i);
  if (!m) return null;
  const host = m[1].toLowerCase();
  if (host !== 'calendly.com' && host !== 'www.calendly.com' && !host.endsWith('.calendly.com')) return null;
  return `https://${host}${m[2] ?? ''}`;
}

// ─── Demo store ───────────────────────────────────────────────────────────────
// Plain AsyncStorage (not the per-user store): the demo priest sets the link
// and the demo congregant reads it, and both must land on the same key.

export async function loadDemoCalendly(): Promise<string | null> {
  try { return await AsyncStorage.getItem(DEMO_KEY); } catch { return null; }
}

export async function saveDemoCalendly(url: string | null): Promise<void> {
  try {
    if (url) await AsyncStorage.setItem(DEMO_KEY, url);
    else await AsyncStorage.removeItem(DEMO_KEY);
  } catch {}
}

export async function loadDemoSchedulingMode(): Promise<SchedulingMode> {
  try { return (await AsyncStorage.getItem(DEMO_MODE_KEY)) === 'calendly' ? 'calendly' : 'app'; }
  catch { return 'app'; }
}

export async function saveDemoSchedulingMode(mode: SchedulingMode): Promise<void> {
  try { await AsyncStorage.setItem(DEMO_MODE_KEY, mode); } catch {}
}
