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
import { hrefFromSegments, isRestorable, saveLastRoute, loadLastRoute } from '@/lib/last-route';

export default function RouteMemory({ enabled }: { enabled: boolean }) {
  const router = useRouter();
  // expo-router types segments as a union of known routes; the plain string
  // form is what the href helpers work with.
  const segments = useSegments() as unknown as string[];
  const restored = useRef(false);
  const href = hrefFromSegments(segments);

  // Restore on first render after the navigator is live.
  useEffect(() => {
    if (!enabled || restored.current || segments.length === 0) return;
    restored.current = true;
    let cancelled = false;
    (async () => {
      const last = await loadLastRoute();
      // Only take over a landing on the section root — never interrupt a
      // deliberate navigation that happened while we were reading storage.
      if (cancelled || !last || last === href) return;
      const leaf = segments[segments.length - 1];
      if (segments.length > 1 && leaf !== 'index') return;
      router.replace(last as any);
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
