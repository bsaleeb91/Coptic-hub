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
//      One listener handles both halves — the phone does not care whether a
//      notification was scheduled here or sent by the server, and neither
//      should this code.
//
//   3. Reconcile the push registration. Permission is revoked in system
//      Settings, not in the app, so the only way to notice is to look on
//      foreground. A token the server keeps sending to after that is queue
//      that can never be delivered.

import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { useRouter } from 'expo-router';
import * as Notifications from 'expo-notifications';
import { remindersSupported, syncReminders } from '@/lib/reminders/schedule';
import { reconcilePushRegistration } from '@/lib/push/register';

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

    const run = () => {
      syncReminders(ctx.current).catch(() => {});
      const id = ctx.current.userId;
      // Demo sessions have no real account to register a device against.
      if (id && !ctx.current.demoMode) reconcilePushRegistration(id).catch(() => {});
    };
    run();

    const sub = AppState.addEventListener('change', state => {
      if (state === 'active') run();
    });
    return () => sub.remove();
  }, [enabled, userId, demoMode]);

  useEffect(() => {
    if (!remindersSupported) return;
    let sub: ReturnType<typeof Notifications.addNotificationResponseReceivedListener> | undefined;
    try {
      sub = Notifications.addNotificationResponseReceivedListener(response => {
        const data = response.notification.request.content.data ?? {};
        // Server-sent notifications name their destination outright; locally
        // scheduled ones carry the kind they were built from.
        const route = typeof data.route === 'string' ? data.route : null;
        if (route) { router.push(route as never); return; }
        if (data.kind === 'canon') router.push('/(tabs)/canon');
        else if (data.kind === 'psalms') router.push('/(tabs)/psalms');
      });
    } catch {
      // No native module (Expo Go without the dev client, say) — the app runs
      // fine, it just cannot be opened from a notification.
    }
    return () => sub?.remove();
  }, [router]);

  return null;
}
