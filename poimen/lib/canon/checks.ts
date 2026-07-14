// lib/canon/checks.ts
// Today's spiritual-canon check-offs, persisted on-device and keyed by the
// local calendar date so they reset automatically each morning. Shared by the
// Canon tab (reads + writes) and the Home "canon today" tile (reads).

import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'poimen.canon.checks';

// Local (not UTC) YYYY-MM-DD, so the daily reset happens at local midnight.
function localToday(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

interface Stored { date: string; keys: string[]; }

export async function loadTodayChecks(): Promise<Set<string>> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw) as Stored;
    if (parsed?.date !== localToday() || !Array.isArray(parsed.keys)) return new Set();
    return new Set(parsed.keys);
  } catch {
    return new Set();
  }
}

export async function saveTodayChecks(keys: Set<string>): Promise<void> {
  try {
    const stored: Stored = { date: localToday(), keys: [...keys] };
    await AsyncStorage.setItem(KEY, JSON.stringify(stored));
  } catch {}
}
