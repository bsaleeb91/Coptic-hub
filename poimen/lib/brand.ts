// lib/brand.ts
// The app's user-facing name, in one place.
//
// The repo, the Expo slug, the URL scheme and the bundle id all retain the
// project's original name. They are not worth changing: the bundle id is what
// the App Store listing is keyed to. What ships to members is
// "Nepsis", and app.json's `name` is what iOS and Android actually display
// (in the app switcher, in Settings, under the home-screen icon).
//
// Reading from that config rather than hardcoding a second copy is the point:
// screens that name the app then cannot drift from what the operating system
// calls it. They had drifted — the privacy policy, the calendar-permission
// prompts and the feedback screen all used the old name in front of members
// of an app called Nepsis.

import Constants from 'expo-constants';

// Falls back rather than throwing: a missing name should not blank out copy
// mid-sentence, and this value is only ever display text.
export const APP_NAME: string = (Constants.expoConfig?.name as string) || 'Nepsis';

// For eyebrows and other all-caps chrome.
export const APP_NAME_UPPER: string = APP_NAME.toUpperCase();
