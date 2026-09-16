// components/ReminderSync.tsx
// Keeps the scheduled reminders honest, and opens the right tab when one is
// tapped.
//
// Renders nothing. Two jobs:
//
//   1. Top up the rolling window. lib/reminders/schedule.ts schedules a
//      fortnight of individually-worded notifications; they have to be rebuilt
//      as the days pass and whenever the underlying facts change (a rule edit,
//      a finished passage, a service checked off). Rebuilding on every
//      foreground is cheap — it reads local stores — and catches all of those
//      without any of them having to know reminders exist.
//
//   2. Route a tap. A reminder that opens the app to wherever it happened to
//      be left is a reminder that made someone do the navigating themselves.

import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { useRouter } from 'expo-router';
import * as Notifications from 'expo-notifications';
import { remindersSupported, syncReminders } from '@/lib/reminders/schedule';

interface Props {
  enabled: boolean;          // signed in (or exploring a demo)
  userId: string | null;
  demoMode: boolean;
  focId: string | null;
}

export default function ReminderSync({ enabled, userId, demoMode, focId }: Props) {
  const router = useRouter();
  // Read inside the AppState listener, which is registered once — without this
  // the listener would close over the identifiers as they were on first mount
  // and keep scheduling for a stale account after a sign-out and back in.
  const ctx = useRef({ userId, demoMode, focId });
  ctx.current = { userId, demoMode, focId };

  useEffect(() => {
    if (!remindersSupported || !enabled) return;

    syncReminders(ctx.current).catch(() => {});

    const sub = AppState.addEventListener('change', state => {
      if (state === 'active') syncReminders(ctx.current).catch(() => {});
    });
    return () => sub.remove();
  }, [enabled, userId, demoMode]);

  useEffect(() => {
    if (!remindersSupported) return;
    let sub: ReturnType<typeof Notifications.addNotificationResponseReceivedListener> | undefined;
    try {
      sub = Notifications.addNotificationResponseReceivedListener(response => {
        const kind = response.notification.request.content.data?.kind;
        if (kind === 'canon') router.push('/(tabs)/canon');
        else if (kind === 'psalms') router.push('/(tabs)/psalms');
      });
    } catch {
      // No native module (Expo Go without the dev client, say) — the app runs
      // fine, it just cannot be opened from a notification.
    }
    return () => sub?.remove();
  }, [router]);

  return null;
}
