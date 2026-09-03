// components/RouteMemory.tsx
// Keeps the user where they were: records the current screen as they move
// around, and on a fresh launch restores the last one (see lib/last-route.ts
// for why this is needed — the app cold-starts when the OS reclaims it, and
// React Navigation doesn't persist its state across launches).
//
// Renders nothing. Restores exactly once per launch, and only from the section
// root, so a deep link or a redirect always wins over the remembered route.

import { useEffect, useRef } from 'react';
import { useRouter, useSegments } from 'expo-router';
import {
  hrefFromSegments, isRestorable, saveLastRoute, loadLastRoute,
  noteSignInScreen, signedInThisLaunch,
} from '@/lib/last-route';

export default function RouteMemory({ enabled }: { enabled: boolean }) {
  const router = useRouter();
  // expo-router types segments as a union of known routes; the plain string
  // form is what the href helpers work with.
  const segments = useSegments() as unknown as string[];
  const restored = useRef(false);
  const href = hrefFromSegments(segments);

  // Note a visit to the sign-in screen even while disabled — it's what tells
  // the restore below that this session was entered deliberately.
  useEffect(() => {
    if (segments[0] === 'sign-in') noteSignInScreen();
  }, [segments[0]]);                // eslint-disable-line react-hooks/exhaustive-deps

  // Restore on first render after the navigator is live.
  useEffect(() => {
    if (!enabled || restored.current || segments.length === 0) return;
    // Someone who just signed in lands on Home, not on wherever this account
    // was last time. Only a cold start into an existing session restores.
    if (signedInThisLaunch()) { restored.current = true; return; }
    restored.current = true;
    let cancelled = false;
    (async () => {
      const last = await loadLastRoute();
      // Only take over a landing on a section root — the place a launch drops
      // you. Anywhere else is a deliberate destination (a deep link, or a
      // navigation that happened while we were reading storage) and must win.
      // A section root is a group's index: ['(tabs)'], ['(tabs)','index'],
      // ['(priest)','index'] — but NOT a standalone screen like ['profile'],
      // which is why landing straight on Profile used to get overridden.
      if (cancelled || !last || last === href) return;
      const leaf = segments[segments.length - 1];
      const atSectionRoot = leaf === 'index' || (segments.length === 1 && segments[0].startsWith('('));
      if (!atSectionRoot) return;
      // push, not replace: the section root stays underneath, so the restored
      // screen's own back/"Home" control (router.back(), used on Profile and a
      // dozen other screens) still has somewhere to go.
      router.push(last as any);
    })();
    return () => { cancelled = true; };
  }, [enabled, segments.length]);   // eslint-disable-line react-hooks/exhaustive-deps

  // Record where we are now.
  useEffect(() => {
    if (!enabled || !isRestorable(segments)) return;
    saveLastRoute(href);
  }, [enabled, href]);              // eslint-disable-line react-hooks/exhaustive-deps

  return null;
}
