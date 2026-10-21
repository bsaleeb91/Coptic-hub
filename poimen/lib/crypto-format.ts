// lib/crypto-format.ts
// How to read a stored secret: which scheme wrote it. Kept free of storage,
// expo, and tweetnacl imports so the test runner can load it directly (the
// same constraint lib/canon/vitals.ts is written under).
//
// Three schemes have written data that is still on disk or in Supabase:
//
//   box1:    nacl.box sealed to a keypair. The keypair is recoverable from
//            profiles.key_backup with the member's PIN, so this survives a
//            device change. This is what everything writes today.
//   enc1:    nacl.secretbox under a device-local key (poimen_notes_key_v1)
//            that was never backed up or synced. LEGACY — readable only on
//            the device that wrote it, and only until that install is gone.
//   plain    Pre-encryption rows, demo fixtures, and seeded data.
//
// Nothing writes enc1: any more, but we must go on reading it: a priest's
// pastoral notes from before the migration are sitting in Supabase in that
// form, and dropping the path would orphan them permanently.

export const BOX_PREFIX = 'box1:';
export const LEGACY_NOTE_PREFIX = 'enc1:';

export type CipherScheme = 'box' | 'legacy' | 'plaintext';

// Which scheme wrote `value`. Non-strings and empty values read as plaintext
// so a malformed row renders as itself rather than throwing into the UI.
export function classifyCiphertext(value: unknown): CipherScheme {
  if (typeof value !== 'string' || value.length === 0) return 'plaintext';
  if (value.startsWith(BOX_PREFIX)) return 'box';
  if (value.startsWith(LEGACY_NOTE_PREFIX)) return 'legacy';
  return 'plaintext';
}

// True when `value` still needs re-wrapping under the recoverable keypair.
// Drives the one-time migration: anything answering true here is readable
// only on this device, so it must be re-encrypted while we can still read it.
export function needsRewrap(value: unknown): boolean {
  return classifyCiphertext(value) === 'legacy';
}

// Where the keypair lives on the device. Every account used to share one slot,
// so signing a second account in on the same phone reused the first account's
// key, and deleting either account erased the key the other still needed.
// Each account now has its own slot; the shared one is only read, to hand an
// existing key to the account it belongs to (see claimSharedKeypair).
export const SHARED_KEYPAIR_SLOT = 'poimen_box_keypair_v1';

// SecureStore keys allow only letters, digits, ".", "-" and "_".
export function keypairSlot(userId: string): string {
  if (!/^[A-Za-z0-9_-]+$/.test(userId)) throw new Error('Invalid user id for keypair slot');
  return `${SHARED_KEYPAIR_SLOT}.${userId}`;
}
