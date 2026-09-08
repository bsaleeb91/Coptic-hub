// lib/theme.ts
// Two palettes, one set of token names:
//  · dark  — Nepsis's original midnight navy + gold.
//  · light — the Nepsis "bright Byzantine" scheme: parchment canvas, sepia
//    ink, warm-white cards, liturgical crimson as the primary accent.
// `colors` is a MUTABLE object: applyTheme() swaps every token in place. The
// root layout applies the persisted mode before any route module loads, so
// screen-level StyleSheets (created lazily on first require) pick up the
// right palette. Switching themes therefore requires an app reload — the
// Appearance setting in Profile handles that.
//
// Token role notes that make the light mapping work:
//  · `navy` is both the page background and the text color used on `gold`
//    buttons — in light mode it becomes parchment, which reads correctly on
//    the crimson primary.
//  · `cream` is the primary text color (sepia ink in light mode).

import AsyncStorage from '@react-native-async-storage/async-storage';

export type ThemeMode = 'dark' | 'light';

const DARK = {
  navy: '#0f1f3d',
  navyMid: '#162847',
  navyDark: 'rgba(10,16,30,0.97)',
  gold: '#c9a84c',
  goldLight: '#e2c97e',
  goldDim: 'rgba(201,168,76,0.15)',
  cream: '#f5f0e8',
  creamDim: 'rgba(245,240,232,0.06)',
  muted: 'rgba(245,240,232,0.58)',
  cardBg: 'rgba(22,40,71,0.85)',
  border: 'rgba(201,168,76,0.2)',
  green: '#5dca87',
  greenBg: 'rgba(39,174,96,0.15)',
  yellow: '#f5c842',
  yellowBg: 'rgba(243,156,18,0.15)',
  red: '#e07070',
  redBg: 'rgba(192,57,43,0.12)',
  blue: '#7fc4e8',
  blueBg: 'rgba(41,128,185,0.15)',
  purple: '#c9a0dc',
  // Surfaces & text tiers shared by list rows, panels, and inputs.
  surface: '#0d182e',                    // opaque row/card surface
  panel: 'rgba(10,16,30,0.6)',           // recessed panels & inputs
  textSecond: 'rgba(245,240,232,0.75)',  // secondary text
  faint: 'rgba(245,240,232,0.3)',        // placeholders, faint hairlines
};

const LIGHT: typeof DARK = {
  navy: '#FAF4E8',          // parchment canvas
  navyMid: '#F2E9D5',       // deeper parchment
  navyDark: 'rgba(255,253,247,0.98)',
  gold: '#7A1F2B',          // liturgical crimson — primary accent
  goldLight: '#5C1620',     // deep crimson emphasis
  goldDim: 'rgba(122,31,43,0.10)',
  cream: '#2B2118',         // sepia ink
  creamDim: 'rgba(43,33,24,0.05)',
  muted: '#6E6253',         // muted sepia
  cardBg: '#FFFDF7',        // warm white card
  border: 'rgba(122,31,43,0.14)',
  green: '#1D7A5C',
  greenBg: '#E3F0E8',
  yellow: '#8A6516',
  yellowBg: '#FBEFD6',
  red: '#7A1F2B',
  redBg: '#F7E4E2',
  blue: '#1F3A63',
  blueBg: 'rgba(31,58,99,0.10)',
  purple: '#5C1620',
  surface: '#FFFDF7',
  panel: '#F2E9D5',
  textSecond: '#6E6253',
  faint: 'rgba(43,33,24,0.35)',
};

export const colors: typeof DARK = { ...DARK };

export function applyTheme(mode: ThemeMode): void {
  Object.assign(colors, mode === 'light' ? LIGHT : DARK);
}

const MODE_KEY = 'poimen.theme';

// Web: localStorage is synchronous, so the persisted theme can be applied at
// module init — before ANY consumer of `colors` evaluates. (On native the
// root layout awaits AsyncStorage and applies the theme before first render;
// lazyThemed below is what makes that stick.)
if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
  try { if (localStorage.getItem(MODE_KEY) === 'light') Object.assign(colors, LIGHT); } catch {}
}

// Defers building a color-dependent object (StyleSheet tables, demo data,
// domain metadata) until its first property access. expo-router evaluates
// every route module at startup to build the route tree — before the stored
// theme mode has been read on native — so anything that captures `colors` at
// module scope would freeze the dark palette. Wrapped in lazyThemed, the
// object is built on first render, after applyTheme() has run.
export function lazyThemed<T extends object>(factory: () => T): T {
  let cached: T | undefined;
  const resolve = () => (cached ??= factory());
  return new Proxy({} as T, {
    get: (_, p) => (resolve() as any)[p],
    has: (_, p) => p in (resolve() as any),
    ownKeys: () => Reflect.ownKeys(resolve() as any),
    getOwnPropertyDescriptor: (_, p) => {
      const d = Object.getOwnPropertyDescriptor(resolve() as any, p);
      if (d) d.configurable = true;
      return d;
    },
    getPrototypeOf: () => Object.getPrototypeOf(resolve() as any),
  }) as T;
}

export async function loadThemeMode(): Promise<ThemeMode> {
  try {
    const raw = await AsyncStorage.getItem(MODE_KEY);
    return raw === 'light' ? 'light' : 'dark';
  } catch { return 'dark'; }
}

export async function saveThemeMode(mode: ThemeMode): Promise<void> {
  try { await AsyncStorage.setItem(MODE_KEY, mode); } catch {}
}

export const fonts = {
  cormorant: 'CormorantGaramond_400Regular',
  cormorantMedium: 'CormorantGaramond_500Medium',
  cormorantLight: 'CormorantGaramond_300Light',
  cormorantItalic: 'CormorantGaramond_400Regular_Italic',
  lato: 'Lato_400Regular',
  latoLight: 'Lato_300Light',
  latoBold: 'Lato_700Bold',
} as const;
