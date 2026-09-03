// lib/nav.ts
// A back control that can't dead-end.
//
// router.back() raises "The action 'GO_BACK' was not handled by any navigator"
// whenever the screen was opened with nothing beneath it — a route restored on
// launch, a deep link, a notification tap. On screens whose only way out is
// that one control (Profile's "‹ Home", the rule editor's chevron) that left
// people stuck with an error and no exit. Fall back to a real destination
// instead of asking to pop a stack that isn't there.

import { router } from 'expo-router';

export function goBack(fallback: string): void {
  if (router.canGoBack()) router.back();
  else router.replace(fallback as never);
}
