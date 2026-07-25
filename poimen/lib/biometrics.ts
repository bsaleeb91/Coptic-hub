// Face ID / biometric app-lock. This does NOT authenticate against Supabase —
// it gates access to a session that's already persisted on the device (see
// lib/supabase.ts's persistSession). Device-level setting, not per-user data,
// so it uses plain AsyncStorage like theme mode (see lib/theme.ts).
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as LocalAuthentication from 'expo-local-authentication';
import { Platform } from 'react-native';

const ENABLED_KEY = 'app:faceIdLockEnabled';

export async function isBiometricAvailable(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  const [hasHardware, isEnrolled] = await Promise.all([
    LocalAuthentication.hasHardwareAsync(),
    LocalAuthentication.isEnrolledAsync(),
  ]);
  return hasHardware && isEnrolled;
}

// Defaults to on when biometrics are available and the user hasn't chosen
// yet — most people expect confession/pastoral data locked behind Face ID
// out of the box rather than having to discover a settings toggle first.
export async function loadFaceIdLockEnabled(): Promise<boolean> {
  try {
    const raw = await AsyncStorage.getItem(ENABLED_KEY);
    if (raw !== null) return raw === 'true';
    return await isBiometricAvailable();
  } catch {
    return false;
  }
}

// The root layout's lock hook holds this pref in state for the whole app
// session, so the Profile toggle must notify it — otherwise enabling or
// disabling Face ID only takes effect after a full app restart.
const changeListeners = new Set<(enabled: boolean) => void>();

export function onFaceIdLockChange(cb: (enabled: boolean) => void): () => void {
  changeListeners.add(cb);
  return () => { changeListeners.delete(cb); };
}

export async function saveFaceIdLockEnabled(enabled: boolean): Promise<void> {
  try { await AsyncStorage.setItem(ENABLED_KEY, String(enabled)); } catch {}
  changeListeners.forEach(cb => { try { cb(enabled); } catch {} });
}

export async function authenticateWithBiometrics(): Promise<boolean> {
  try {
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: 'Unlock Nepsis',
      disableDeviceFallback: false,
    });
    return result.success;
  } catch {
    return false;
  }
}
