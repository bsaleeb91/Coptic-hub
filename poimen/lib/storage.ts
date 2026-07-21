// lib/storage.ts
// Per-user-scoped AsyncStorage. All of a person's on-device spiritual data
// (confession dates + journal, canon rule/history/checks, psalm memorization)
// used GLOBAL keys, so switching accounts on one device made the next account
// read the previous person's data — e.g. a priest's personal view showing a
// congregant's confession history and psalm progress.
//
// This wraps AsyncStorage and namespaces every key by the active scope (the
// signed-in user's id, or 'demo'). Each account gets its own isolated local
// cache; because the hydrate helpers pull from that user's cloud mirror when
// their local namespace is empty, switching accounts restores the right data
// rather than losing it.
//
// Device-level settings (theme, demo flags, dashboard layout, lectionary
// cache, encryption keypair) keep using AsyncStorage directly — they are not
// per-user spiritual data.

import AsyncStorage from '@react-native-async-storage/async-storage';

let scope = 'anon';

// Set the active storage scope. Returns true if it changed. Call this
// synchronously (before screens read their stores) whenever the signed-in
// user or demo state changes.
export function setStorageScope(next: string | null): boolean {
  const s = next && next.length ? next : 'anon';
  if (s === scope) return false;
  scope = s;
  return true;
}

export function getStorageScope(): string {
  return scope;
}

const nk = (key: string) => `u:${scope}:${key}`;

export const userStorage = {
  getItem: (key: string) => AsyncStorage.getItem(nk(key)),
  setItem: (key: string, value: string) => AsyncStorage.setItem(nk(key), value),
  removeItem: (key: string) => AsyncStorage.removeItem(nk(key)),
};
