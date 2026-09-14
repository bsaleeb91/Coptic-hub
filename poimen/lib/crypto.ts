// End-to-end encryption for pastoral notes, encounter notes, and prayer request bodies.
// Asymmetric keypair (box) for everything — public key stored in profiles,
// private key stays on device. Only the intended recipient's device can decrypt.
// The keypair is recoverable: encryptKeypairWithPIN backs it up to
// profiles.key_backup, so a new device restores the SAME key and can still read
// what the old one wrote (see checkKeyState / completePINRecovery in auth.tsx).
//
// Notes used to have their own symmetric secretbox key (poimen_notes_key_v1)
// that was never backed up or synced. Pastoral notes live in Supabase and
// outlive the device that wrote them, so a priest changing phones was left with
// rows nothing could ever decrypt. Notes now go through the recoverable keypair
// like everything else; the legacy key is kept read-only to migrate what it
// wrote (see migrateLegacyNotes callers) and is never created again.
import nacl from 'tweetnacl';
import { encodeBase64, decodeBase64, encodeUTF8, decodeUTF8 } from 'tweetnacl-util';
import * as SecureStore from 'expo-secure-store';
import * as ExpoCrypto from 'expo-crypto';
import { Platform } from 'react-native';
import { classifyCiphertext, BOX_PREFIX, LEGACY_NOTE_PREFIX } from './crypto-format';

export { classifyCiphertext, needsRewrap } from './crypto-format';

// Hermes (native) has no Web Crypto API, so tweetnacl finds no PRNG at import
// time and every nacl.randomBytes call throws "no PRNG" — encryption silently
// fails on iOS/Android while working on web. Seed nacl from expo-crypto when
// crypto.getRandomValues is missing; on web the browser PRNG is used as before.
if (typeof (globalThis as any).crypto?.getRandomValues !== 'function') {
  nacl.setPRNG((x, n) => {
    x.set(ExpoCrypto.getRandomBytes(n));
  });
}

const LEGACY_KEY_ID = 'poimen_notes_key_v1';
const KEYPAIR_ID = 'poimen_box_keypair_v1';

// Legacy device-local notes key: LOAD ONLY. Deliberately has no save/create
// counterpart — minting a new one would produce fresh unrecoverable ciphertext,
// which is the bug this replaced. It exists solely so migrateLegacyNotes can
// read what earlier installs wrote.
async function loadLegacyKey(): Promise<Uint8Array | null> {
  const stored = Platform.OS === 'web'
    ? localStorage.getItem(LEGACY_KEY_ID)
    : await SecureStore.getItemAsync(LEGACY_KEY_ID);
  return stored ? decodeBase64(stored) : null;
}

// True when this device still holds the legacy key, i.e. it is one of the
// devices that can still rescue enc1: rows.
export async function hasLegacyNotesKey(): Promise<boolean> {
  return (await loadLegacyKey()) !== null;
}

// Decrypt an enc1: value with the legacy device key. null when the value isn't
// legacy ciphertext, the key is gone, or the box doesn't open.
export async function decryptLegacyNote(value: string): Promise<string | null> {
  if (classifyCiphertext(value) !== 'legacy') return null;
  const key = await loadLegacyKey();
  if (!key) return null;
  try {
    const combined = decodeBase64(value.slice(LEGACY_NOTE_PREFIX.length));
    const nonce = combined.slice(0, nacl.secretbox.nonceLength);
    const box = combined.slice(nacl.secretbox.nonceLength);
    const plaintext = nacl.secretbox.open(box, nonce, key);
    return plaintext ? encodeUTF8(plaintext) : null;
  } catch { return null; }
}

// Drop the legacy key once everything it wrote has been re-wrapped. Only safe
// to call after a migration reports nothing left behind — the key is the sole
// way to read any enc1: row that was missed.
export async function clearLegacyNotesKey(): Promise<void> {
  try {
    if (Platform.OS === 'web') { localStorage.removeItem(LEGACY_KEY_ID); return; }
    await SecureStore.deleteItemAsync(LEGACY_KEY_ID);
  } catch {}
}

// ── Asymmetric box (prayer bodies) ───────────────────────────

async function loadBoxKeypair(): Promise<nacl.BoxKeyPair | null> {
  const stored = Platform.OS === 'web'
    ? localStorage.getItem(KEYPAIR_ID)
    : await SecureStore.getItemAsync(KEYPAIR_ID);
  if (!stored) return null;
  const bytes = decodeBase64(stored);
  return { secretKey: bytes.slice(0, 32), publicKey: bytes.slice(32, 64) };
}

async function saveBoxKeypair(kp: nacl.BoxKeyPair): Promise<void> {
  const combined = new Uint8Array(64);
  combined.set(kp.secretKey);
  combined.set(kp.publicKey, 32);
  const encoded = encodeBase64(combined);
  if (Platform.OS === 'web') { localStorage.setItem(KEYPAIR_ID, encoded); return; }
  await SecureStore.setItemAsync(KEYPAIR_ID, encoded);
}

export async function getOrCreateBoxKeypair(): Promise<nacl.BoxKeyPair> {
  const existing = await loadBoxKeypair();
  if (existing) return existing;
  const kp = nacl.box.keyPair();
  await saveBoxKeypair(kp);
  return kp;
}

export async function hasLocalKeypair(): Promise<boolean> {
  return (await loadBoxKeypair()) !== null;
}

export { saveBoxKeypair };

export async function createAndSaveFreshKeypair(): Promise<nacl.BoxKeyPair> {
  const kp = nacl.box.keyPair();
  await saveBoxKeypair(kp);
  return kp;
}

// ── PIN-protected keypair backup ──────────────────────────────
// Key derivation: SHA-512(UTF8(pin) ++ salt), first 32 bytes → secretbox key.
// Not as strong as PBKDF2 but acceptable for this threat model (lost device, not DB breach).
// Format: "pinbak1:" + base64(salt[16] + nonce[24] + secretbox_ciphertext)
const PIN_BACKUP_PREFIX = 'pinbak1:';

export function encryptKeypairWithPIN(pin: string, kp: nacl.BoxKeyPair): string {
  const salt = nacl.randomBytes(16);
  const pinBytes = decodeUTF8(pin);
  const material = new Uint8Array(pinBytes.length + salt.length);
  material.set(pinBytes);
  material.set(salt, pinBytes.length);
  const pinKey = nacl.hash(material).slice(0, nacl.secretbox.keyLength);
  const payload = new Uint8Array(64);
  payload.set(kp.secretKey);
  payload.set(kp.publicKey, 32);
  const nonce = nacl.randomBytes(nacl.secretbox.nonceLength);
  const box = nacl.secretbox(payload, nonce, pinKey);
  const result = new Uint8Array(16 + nonce.length + box.length);
  result.set(salt);
  result.set(nonce, 16);
  result.set(box, 16 + nonce.length);
  return PIN_BACKUP_PREFIX + encodeBase64(result);
}

export function decryptKeypairWithPIN(pin: string, backup: string): nacl.BoxKeyPair | null {
  if (!backup.startsWith(PIN_BACKUP_PREFIX)) return null;
  const bytes = decodeBase64(backup.slice(PIN_BACKUP_PREFIX.length));
  const salt = bytes.slice(0, 16);
  const nonce = bytes.slice(16, 16 + nacl.secretbox.nonceLength);
  const box = bytes.slice(16 + nacl.secretbox.nonceLength);
  const pinBytes = decodeUTF8(pin);
  const material = new Uint8Array(pinBytes.length + salt.length);
  material.set(pinBytes);
  material.set(salt, pinBytes.length);
  const pinKey = nacl.hash(material).slice(0, nacl.secretbox.keyLength);
  const payload = nacl.secretbox.open(box, nonce, pinKey);
  if (!payload) return null;
  return { secretKey: payload.slice(0, 32), publicKey: payload.slice(32, 64) };
}

export async function getPublicKeyBase64(): Promise<string> {
  const kp = await getOrCreateBoxKeypair();
  return encodeBase64(kp.publicKey);
}

// Encrypt plaintext so only the holder of recipientPublicKey's private key can decrypt.
export async function encryptForRecipient(plaintext: string, recipientPublicKeyB64: string): Promise<string> {
  const kp = await getOrCreateBoxKeypair();
  const recipientPK = decodeBase64(recipientPublicKeyB64);
  const nonce = nacl.randomBytes(nacl.box.nonceLength);
  const ciphertext = nacl.box(decodeUTF8(plaintext), nonce, recipientPK, kp.secretKey);
  const combined = new Uint8Array(nonce.length + ciphertext.length);
  combined.set(nonce);
  combined.set(ciphertext, nonce.length);
  return BOX_PREFIX + encodeBase64(combined);
}

// Encrypt for self (congregant reads their own prayer body).
export async function encryptForSelf(plaintext: string): Promise<string> {
  const kp = await getOrCreateBoxKeypair();
  return encryptForRecipient(plaintext, encodeBase64(kp.publicKey));
}

// Open a box1: value, or null if it won't open. Callers choose their own
// failure text, so a note that can't be read says so in the note's own words
// rather than borrowing the prayer wording.
async function openFromSender(value: string, senderPublicKeyB64: string): Promise<string | null> {
  if (classifyCiphertext(value) !== 'box') return null;
  try {
    const kp = await getOrCreateBoxKeypair();
    const senderPK = decodeBase64(senderPublicKeyB64);
    const combined = decodeBase64(value.slice(BOX_PREFIX.length));
    const nonce = combined.slice(0, nacl.box.nonceLength);
    const ciphertext = combined.slice(nacl.box.nonceLength);
    const plaintext = nacl.box.open(ciphertext, nonce, senderPK, kp.secretKey);
    return plaintext ? encodeUTF8(plaintext) : null;
  } catch { return null; }
}

// Decrypt a box1: value sent by senderPublicKey, using our private key.
// Non-box values pass through unchanged (pre-encryption rows, demo fixtures).
export async function decryptFromSender(value: string, senderPublicKeyB64: string): Promise<string> {
  if (classifyCiphertext(value) !== 'box') return value;
  return (await openFromSender(value, senderPublicKeyB64)) ?? '[could not decrypt]';
}

// Decrypt self-encrypted body (sender = self).
export async function decryptSelf(value: string): Promise<string> {
  const kp = await getOrCreateBoxKeypair();
  return decryptFromSender(value, encodeBase64(kp.publicKey));
}

// ── Notes (pastoral, encounter, confession journal) ──────────
// Sealed to our own keypair, so a restored device reads them back.

export async function encryptNote(plaintext: string): Promise<string> {
  return encryptForSelf(plaintext);
}

// Decrypts a note written under either scheme. Plaintext passes through
// unchanged so pre-encryption rows and demo fixtures render correctly.
//
// The legacy branch is what a priest who has not yet migrated hits: their
// device still holds poimen_notes_key_v1 and the row still opens. Once
// migrateLegacyNotes has run, nothing reaches it — but a row the migration
// never saw (written on a device that has since been wiped) must not read as
// though it were corrupt, so the failure names the real cause.
export async function decryptNote(value: string): Promise<string> {
  switch (classifyCiphertext(value)) {
    case 'box': {
      const kp = await getOrCreateBoxKeypair();
      return (await openFromSender(value, encodeBase64(kp.publicKey)))
        ?? '[note could not be decrypted]';
    }
    case 'legacy':
      return (await decryptLegacyNote(value))
        ?? '[note is locked to the device it was written on]';
    default:
      return value;
  }
}

// Re-wrap one legacy value under the keypair. Returns the new ciphertext, or
// null when the value isn't legacy or can't be read here — callers treat null
// as "leave this row exactly as it is", never as "write something else".
export async function rewrapLegacyNote(value: string): Promise<string | null> {
  const plaintext = await decryptLegacyNote(value);
  if (plaintext === null) return null;
  return encryptNote(plaintext);
}
