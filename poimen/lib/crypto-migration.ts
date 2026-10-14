// lib/crypto-migration.ts
// One-time re-wrap of notes sealed under the old device-local key.
//
// Why this is per-DEVICE, not per-account: the legacy key was minted randomly
// on each install and never synced, so notes written on a priest's phone were
// unreadable on their tablet even then. Each device can therefore only rescue
// what it wrote itself, and every device has to run this once. A device with no
// legacy key has nothing to contribute and exits immediately.
//
// The run is idempotent and non-destructive — see migrateLegacyPastoralNotes.
// It marks itself complete only on a CLEAN sweep: if anything was left behind
// (a row that would not open, or a write that failed), the flag stays unset so
// the next launch tries again rather than stranding data.

import { userStorage as AsyncStorage } from '@/lib/storage';
import { hasLegacyNotesKey } from '@/lib/crypto';
import { migrateLegacyConfessionStore } from '@/lib/confession/store';
import * as db from '@/lib/db';

const DONE_KEY = 'poimen.crypto.legacyNotesMigrated.v1';

export interface MigrationSummary {
  ran: boolean;
  serverRewrapped: number;
  localRewrapped: number;
  leftBehind: number;
}

const NOT_RUN: MigrationSummary = { ran: false, serverRewrapped: 0, localRewrapped: 0, leftBehind: 0 };

export async function runLegacyNotesMigration(userId: string): Promise<MigrationSummary> {
  try {
    if (await AsyncStorage.getItem(DONE_KEY)) return NOT_RUN;
    if (!(await hasLegacyNotesKey())) {
      // Nothing on this device to rescue. Record it so we stop checking.
      await AsyncStorage.setItem(DONE_KEY, new Date().toISOString());
      return NOT_RUN;
    }

    const server = await db.migrateLegacyPastoralNotes(userId);
    const localRewrapped = await migrateLegacyConfessionStore();
    const leftBehind = server.unreadable + server.failed;

    if (leftBehind === 0) await AsyncStorage.setItem(DONE_KEY, new Date().toISOString());

    return { ran: true, serverRewrapped: server.rewrapped, localRewrapped, leftBehind };
  } catch {
    // Never block sign-in on this. An un-set flag means we retry next launch.
    return NOT_RUN;
  }
}
