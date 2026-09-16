// lib/reminders/schedule.ts
// Scheduling the local reminders for the Canon and the Psalms.
//
// LOCAL notifications only. There is no push token, no device registration and
// no server involvement of any kind: the phone is told once what to say and
// when, and it says it even in airplane mode. That is not only simpler — it is
// the only version of this feature consistent with what the app promises about
// confession and canon data, since a push server would mean a server that knows
// what someone's rule asks of them and when they have not done it.
//
// WHY A ROLLING WINDOW rather than one repeating daily trigger: a repeating
// trigger can only ever carry one fixed sentence, which is how reminders become
// wallpaper. Scheduling WINDOW_DAYS days individually lets each day carry its
// own real content — the two services actually due, the number of portions
// actually up for review — and lets a day with nothing due stay silent. The
// window is topped up every time the app comes to the foreground, so an active
// member is always a fortnight ahead. Someone who stops opening the app stops
// being reminded after two weeks, which is the correct end state: a phone that
// nags indefinitely about a rule no one is keeping is not pastoral care.

import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { ReminderKind, loadReminderSettings } from './store';
import { canonReminder, psalmsReminder, loadCanonContext, loadPsalmContext } from './content';

// Two weeks of lead time. Every scheduled notification counts against iOS's
// 64-pending limit, and at two kinds per day this peaks at 28 — comfortably
// clear of it, with room for anything else the app may schedule later.
const WINDOW_DAYS = 14;

const CHANNEL_ID = 'reminders';

// Reminders are unavailable on the web build (no scheduling API behind
// expo-notifications there) and in any environment where the native module is
// missing. Every entry point checks this rather than throwing into a screen.
export const remindersSupported = Platform.OS === 'ios' || Platform.OS === 'android';

// Shown while the app is open, quietly: a banner, no sound. Someone already
// using the app does not need to be startled by a reminder to use the app.
// Guarded because this runs on import, and the web build imports this module
// through the settings screen even though it can never schedule anything.
if (remindersSupported) {
  try {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: false,
        shouldSetBadge: false,
      }),
    });
  } catch {}
}

export type PermissionState = 'granted' | 'denied' | 'undetermined';

export async function getPermissionState(): Promise<PermissionState> {
  if (!remindersSupported) return 'denied';
  try {
    const { status } = await Notifications.getPermissionsAsync();
    return status === 'granted' ? 'granted' : status === 'denied' ? 'denied' : 'undetermined';
  } catch {
    return 'denied';
  }
}

// Asks the OS, once. A previous denial is NOT re-asked — iOS ignores the second
// request anyway, and the settings screen says to use system Settings instead
// rather than pretending a tap did something.
export async function requestPermission(): Promise<PermissionState> {
  if (!remindersSupported) return 'denied';
  try {
    const existing = await Notifications.getPermissionsAsync();
    if (existing.status === 'granted') return 'granted';
    const { status } = await Notifications.requestPermissionsAsync();
    return status === 'granted' ? 'granted' : status === 'denied' ? 'denied' : 'undetermined';
  } catch {
    return 'denied';
  }
}

async function ensureAndroidChannel(): Promise<void> {
  if (Platform.OS !== 'android') return;
  try {
    await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
      name: 'Prayer reminders',
      importance: Notifications.AndroidImportance.DEFAULT,
      sound: null,
      vibrationPattern: [0, 200],
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PRIVATE,
    });
  } catch {
    // An older Android or a stubbed module — scheduling still works without a
    // custom channel, it just lands in the default one.
  }
}

export interface SyncContext {
  userId: string | null;
  demoMode: boolean;
  focId: string | null;
}

// Cancel everything and rebuild. This assumes reminders are the ONLY
// notifications this app schedules, which is true today — expo-calendar writes
// calendar events for appointments, not notifications. Anything that starts
// scheduling its own must cancel by identifier instead of clearing the queue.
//
// Rescheduling from scratch is deliberate: a day's content can change after it
// was scheduled (the rule is edited, a service is postponed, a passage is
// finished), and reconciling individual pending notifications against that is
// far more code — and far more ways to be wrong — than throwing away 28
// entries and recomputing them.
//
// Returns how many notifications now stand, which the settings screen shows so
// the member can see the feature is actually armed.
export async function syncReminders(ctx: SyncContext): Promise<number> {
  if (!remindersSupported) return 0;

  const settings = await loadReminderSettings();
  const anyEnabled = settings.canon.enabled || settings.psalms.enabled;

  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
  } catch {
    return 0;
  }
  if (!anyEnabled) return 0;

  // Only checked here, not in the settings screen's toggle path: permission can
  // be revoked in system Settings long after the toggle was switched on, and
  // the sync is what runs often enough to notice.
  if ((await getPermissionState()) !== 'granted') return 0;

  await ensureAndroidChannel();

  // Gathered ONCE for the whole window. Doing this per day meant fourteen
  // reads of every local store and fourteen network calls for the FOC's
  // assignments, on every single change to a reminder time.
  const [canonCtx, psalmCtx] = await Promise.all([
    settings.canon.enabled  ? loadCanonContext(ctx) : Promise.resolve(null),
    settings.psalms.enabled ? loadPsalmContext()    : Promise.resolve(null),
  ]);

  const now = new Date();
  let scheduled = 0;

  for (let offset = 0; offset < WINDOW_DAYS; offset++) {
    const day = new Date(now);
    day.setDate(day.getDate() + offset);

    for (const kind of ['canon', 'psalms'] as ReminderKind[]) {
      const setting = settings[kind];
      if (!setting.enabled) continue;

      const when = new Date(day);
      when.setHours(setting.hour, setting.minute, 0, 0);
      // Today's slot has already passed — the first real reminder is tomorrow's.
      if (when.getTime() <= now.getTime()) continue;

      const content = kind === 'canon'
        ? (canonCtx ? await canonReminder(day, canonCtx) : null)
        : (psalmCtx ? psalmsReminder(day, psalmCtx) : null);
      if (!content) continue;   // nothing due that day; stay silent

      try {
        await Notifications.scheduleNotificationAsync({
          content: {
            title: content.title,
            body: content.body,
            sound: false,
            // Read by the tap handler in components/ReminderSync.tsx, which
            // opens the tab the reminder is about.
            data: { kind },
            ...(Platform.OS === 'android' ? { channelId: CHANNEL_ID } : null),
          },
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.DATE,
            date: when,
          },
        });
        scheduled++;
      } catch {
        // One bad day must not abandon the other thirteen.
      }
    }
  }

  return scheduled;
}

// How many reminders are actually pending — the settings screen reads this back
// from the OS rather than from our own count, so what it shows is what the
// phone will really do.
export async function pendingCount(): Promise<number> {
  if (!remindersSupported) return 0;
  try {
    return (await Notifications.getAllScheduledNotificationsAsync()).length;
  } catch {
    return 0;
  }
}
