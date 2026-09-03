// lib/avatar.ts
// Profile-photo capture + upload. Photos are square-cropped and compressed by
// the picker, uploaded to the public "avatars" storage bucket, and referenced
// by cache-busted public URL (RN's Image caches by URL, so each upload gets a
// fresh ?v=). Two path families, enforced by storage RLS:
//   self/<uid>.jpg            the user's own picture (profiles.avatar_url)
//   flock/<owner>/<subject>.jpg  a shepherd's photo of a flock/class member
//                                (member_photos table, owner-only visibility)

import { Platform } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from './supabase';

export type PhotoSource = 'camera' | 'library';

// Camera capture isn't supported by the picker on web — hide that option.
export const cameraAvailable = Platform.OS !== 'web';

const PICKER_OPTS: ImagePicker.ImagePickerOptions = {
  mediaTypes: ['images'],
  allowsEditing: true,     // square crop UI
  aspect: [1, 1],
  quality: 0.4,            // avatars stay small
  base64: true,
};

// Ask for permission and open the camera or library. Returns the image as
// base64, or null if denied/cancelled.
export async function pickPhoto(source: PhotoSource): Promise<string | null> {
  if (source === 'camera') {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) return null;
    const res = await ImagePicker.launchCameraAsync(PICKER_OPTS);
    return res.canceled ? null : res.assets[0]?.base64 ?? null;
  }
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) return null;
  const res = await ImagePicker.launchImageLibraryAsync(PICKER_OPTS);
  return res.canceled ? null : res.assets[0]?.base64 ?? null;
}

// Base64 → bytes without relying on global atob (not guaranteed on Hermes).
const B64_LOOKUP = (() => {
  const t = new Int8Array(128).fill(-1);
  const alpha = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  for (let i = 0; i < alpha.length; i++) t[alpha.charCodeAt(i)] = i;
  return t;
})();

export function base64ToBytes(b64: string): Uint8Array {
  const len = b64.length;
  const out = new Uint8Array(Math.floor((len * 3) / 4) + 3);
  let o = 0, buf = 0, bits = 0;
  for (let i = 0; i < len; i++) {
    const v = B64_LOOKUP[b64.charCodeAt(i) & 0x7f];
    if (v < 0) continue;   // padding, whitespace
    buf = (buf << 6) | v;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      out[o++] = (buf >> bits) & 0xff;
    }
  }
  return out.slice(0, o);
}

// Upload to the avatars bucket (overwriting any previous photo at the path)
// and return a cache-busted public URL.
export async function uploadAvatarImage(
  path: string,
  base64: string,
): Promise<{ url: string | null; error: string | null }> {
  try {
    const bytes = base64ToBytes(base64);
    if (bytes.length === 0) return { url: null, error: 'Empty image' };
    const { error } = await supabase.storage
      .from('avatars')
      .upload(path, bytes, { contentType: 'image/jpeg', upsert: true });
    if (error) return { url: null, error: error.message };
    const { data } = supabase.storage.from('avatars').getPublicUrl(path);
    return { url: `${data.publicUrl}?v=${Date.now()}`, error: null };
  } catch (e: any) {
    return { url: null, error: String(e?.message ?? e) };
  }
}

export async function removeAvatarImage(path: string): Promise<void> {
  try { await supabase.storage.from('avatars').remove([path]); } catch {}
}

export const selfAvatarPath = (userId: string) => `self/${userId}.jpg`;

// Shepherd photos get a random token in the filename: the subject knows their
// own id and their shepherd's id, so a fixed flock/<owner>/<subject>.jpg would
// be a guessable public URL — defeating "never visible to the member". With
// the token, the URL exists only in the owner-only member_photos row. Each
// upload gets a fresh path; the previous object is deleted by the caller.
export const newFlockPhotoPath = (ownerId: string, subjectId: string) =>
  `flock/${ownerId}/${subjectId}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}.jpg`;

// Recover the storage path from a stored public URL (strips the ?v= cache
// buster). Returns null for URLs not in the avatars bucket.
export function pathFromAvatarUrl(url: string): string | null {
  const m = url.match(/\/avatars\/([^?]+)/);
  return m ? decodeURIComponent(m[1]) : null;
}
