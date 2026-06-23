// End-to-end encryption for pastoral notes and private encounter notes.
// Key lives only in SecureStore on device — never leaves, never goes to Supabase.
// Encrypted values are prefixed with "enc1:" for versioning and plaintext detection.
import nacl from 'tweetnacl';
import { encodeBase64, decodeBase64, encodeUTF8, decodeUTF8 } from 'tweetnacl-util';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const KEY_ID = 'poimen_notes_key_v1';
const ENC_PREFIX = 'enc1:';

async function loadKey(): Promise<string | null> {
  if (Platform.OS === 'web') return localStorage.getItem(KEY_ID);
  return SecureStore.getItemAsync(KEY_ID);
}

async function saveKey(key: string): Promise<void> {
  if (Platform.OS === 'web') { localStorage.setItem(KEY_ID, key); return; }
  await SecureStore.setItemAsync(KEY_ID, key);
}

async function getOrCreateKey(): Promise<Uint8Array> {
  const stored = await loadKey();
  if (stored) return decodeBase64(stored);
  const key = nacl.randomBytes(nacl.secretbox.keyLength);
  await saveKey(encodeBase64(key));
  return key;
}

export async function encryptNote(plaintext: string): Promise<string> {
  const key = await getOrCreateKey();
  const nonce = nacl.randomBytes(nacl.secretbox.nonceLength);
  const box = nacl.secretbox(encodeUTF8(plaintext), nonce, key);
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
  return decodeUTF8(plaintext);
}
