// End-to-end encryption for pastoral notes, encounter notes, and prayer request bodies.
// Symmetric key (secretbox) for notes — lives only on device, never sent to Supabase.
// Asymmetric keypair (box) for prayer bodies — public key stored in profiles,
// private key stays on device. Only the intended recipient's device can decrypt.
import nacl from 'tweetnacl';
import { encodeBase64, decodeBase64, encodeUTF8, decodeUTF8 } from 'tweetnacl-util';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

const KEY_ID = 'poimen_notes_key_v1';
const KEYPAIR_ID = 'poimen_box_keypair_v1';
const ENC_PREFIX = 'enc1:';
const BOX_PREFIX = 'box1:';

async function loadKey(): Promise<string | null> {
  if (Platform.OS === 'web') return localStorage.getItem(KEY_ID);
  return AsyncStorage.getItem(KEY_ID);
}

async function saveKey(key: string): Promise<void> {
  if (Platform.OS === 'web') { localStorage.setItem(KEY_ID, key); return; }
  await AsyncStorage.setItem(KEY_ID, key);
}

async function getOrCreateKey(): Promise<Uint8Array> {
  const stored = await loadKey();
  if (stored) return decodeBase64(stored);
  const key = nacl.randomBytes(nacl.secretbox.keyLength);
  await saveKey(encodeBase64(key));
  return key;
}

// ── Asymmetric box (prayer bodies) ───────────────────────────

async function loadBoxKeypair(): Promise<nacl.BoxKeyPair | null> {
  const stored = Platform.OS === 'web'
    ? localStorage.getItem(KEYPAIR_ID)
    : await AsyncStorage.getItem(KEYPAIR_ID);
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
  await AsyncStorage.setItem(KEYPAIR_ID, encoded);
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

// Decrypt a box1: value sent by senderPublicKey, using our private key.
export async function decryptFromSender(value: string, senderPublicKeyB64: string): Promise<string> {
  if (!value.startsWith(BOX_PREFIX)) return value;
  const kp = await getOrCreateBoxKeypair();
  const senderPK = decodeBase64(senderPublicKeyB64);
  const combined = decodeBase64(value.slice(BOX_PREFIX.length));
  const nonce = combined.slice(0, nacl.box.nonceLength);
  const ciphertext = combined.slice(nacl.box.nonceLength);
  const plaintext = nacl.box.open(ciphertext, nonce, senderPK, kp.secretKey);
  if (!plaintext) return '[could not decrypt]';
  return encodeUTF8(plaintext);
}

// Decrypt self-encrypted body (sender = self).
export async function decryptSelf(value: string): Promise<string> {
  const kp = await getOrCreateBoxKeypair();
  return decryptFromSender(value, encodeBase64(kp.publicKey));
}

// ── Symmetric secretbox (pastoral / encounter notes) ─────────

export async function encryptNote(plaintext: string): Promise<string> {
  const key = await getOrCreateKey();
  const nonce = nacl.randomBytes(nacl.secretbox.nonceLength);
  const box = nacl.secretbox(decodeUTF8(plaintext), nonce, key);
  const combined = new Uint8Array(nonce.length + box.length);
  combined.set(nonce);
  combined.set(box, nonce.length);
  return ENC_PREFIX + encodeBase64(combined);
}

// Decrypts an encrypted note. Passes plaintext through unchanged so existing
// unencrypted rows (e.g. demo data, pre-encryption records) render correctly.
export async function decryptNote(value: string): Promise<string> {
  if (!value.startsWith(ENC_PREFIX)) return value;
  const key = await getOrCreateKey();
  const combined = decodeBase64(value.slice(ENC_PREFIX.length));
  const nonce = combined.slice(0, nacl.secretbox.nonceLength);
  const box = combined.slice(nacl.secretbox.nonceLength);
  const plaintext = nacl.secretbox.open(box, nonce, key);
  if (!plaintext) return '[note could not be decrypted]';
  return encodeUTF8(plaintext);
}
