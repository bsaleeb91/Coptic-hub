// lib/push/register.ts
// Getting this device a push token, and keeping the server's idea of it true.
//
// Distinct from lib/reminders/*, which schedules LOCAL notifications and needs
// no server, no token and no account. This module is the other half: the one
// that lets the server speak. The two share the OS permission — asked for once,
// by whichever comes first — and nothing else.
//
// Everything here is best-effort and never throws into a screen. A member with
// no push token still has working local reminders; they simply will not hear
// about an appointment until they open the app, which is exactly where the app
// stood before any of this.

import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import * as db from '@/lib/db';
import { remindersSupported } from '@/lib/reminders/schedule';

// Push needs the same native module the local reminders need, so the same
// guard covers both: the web build has neither.
export const pushSupported = remindersSupported;

// EAS project id, which getExpoPushTokenAsync requires in a bare/EAS build —
// without it Expo cannot tell which project's credentials to issue against.
function projectId(): string | null {
  const extra = Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined;
  return extra?.eas?.projectId ?? null;
}

// Shown in settings so a member can tell one device from another before
// revoking it. Cosmetic only — never used for targeting, which is why this
// reads the name expo-constants already exposes rather than pulling in
// expo-device: a whole native module for a label is not a trade worth making.
function deviceLabel(): string {
  const name = Constants.deviceName?.trim();
  if (name) return name;
  return Platform.OS === 'ios' ? 'iPhone' : 'Android device';
}

// The device's IANA zone. The server schedules everything in the member's local
// time, and this is the only way it can know what that is. Re-read on every
// registration so travel and a change of parish correct themselves by the next
// app open rather than by a support request.
function currentTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}

export interface RegisterResult {
  token: string | null;
  reason: 'ok' | 'unsupported' | 'no-permission' | 'no-project-id' | 'failed';
}

// Ask, fetch, store. Safe to call on every foreground: the upsert is keyed on
// the token, so a repeat call refreshes last_seen_at and nothing else.
//
// `interactive: false` (the default) will NOT show the OS permission dialog —
// it only registers when permission is already granted. The dialog belongs to a
// moment the member initiated, not to app startup, so the settings screen
// passes true and the foreground sync does not.
export async function registerForPush(
  userId: string,
  opts: { interactive?: boolean } = {},
): Promise<RegisterResult> {
  if (!pushSupported) return { token: null, reason: 'unsupported' };

  try {
    let { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted') {
      if (!opts.interactive) return { token: null, reason: 'no-permission' };
      ({ status } = await Notifications.requestPermissionsAsync());
      if (status !== 'granted') return { token: null, reason: 'no-permission' };
    }

    const id = projectId();
    if (!id) return { token: null, reason: 'no-project-id' };

    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId: id });
    if (!token) return { token: null, reason: 'failed' };

    await db.registerPushToken({
      userId,
      token,
      platform: Platform.OS === 'ios' ? 'ios' : 'android',
      deviceLabel: deviceLabel(),
    });

    // Written alongside the token rather than only from the settings screen:
    // a member who never opens those settings should still get their
    // notifications at the right hour of their own day.
    await db.savePushPrefs(userId, { timezone: currentTimezone() });

    return { token, reason: 'ok' };
  } catch {
    return { token: null, reason: 'failed' };
  }
}

// Drop this device's token. Called when the member switches push off, and when
// the app notices the OS permission is gone — a token the server keeps sending
// to after permission was revoked is just queue that can never be delivered.
export async function unregisterPush(): Promise<void> {
  if (!pushSupported) return;
  try {
    const id = projectId();
    if (!id) return;
    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId: id });
    if (token) await db.removePushToken(token);
  } catch {
    // Nothing to remove, or offline. The worker retires dead tokens on its own
    // when Expo reports DeviceNotRegistered, so this is a tidy-up, not a
    // correctness requirement.
  }
}

// Reconcile on foreground: if permission has been revoked in system Settings
// since we last looked, the token must go. Returns whether push is live.
export async function reconcilePushRegistration(userId: string): Promise<boolean> {
  if (!pushSupported) return false;
  try {
    const { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted') {
      await unregisterPush();
      return false;
    }
    const { reason } = await registerForPush(userId);
    return reason === 'ok';
  } catch {
    return false;
  }
}
