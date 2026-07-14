import AsyncStorage from '@react-native-async-storage/async-storage';

// The top "vital tile" pair (confession + canon) is always shown — like Activity Rings in Apple Fitness.
// The sections below are fully customizable.

export type SectionId = 'vitals' | 'journey' | 'feasts' | 'foc';

export interface SectionDef {
  label: string;
  icon: string;
}

export const SECTION_DEFS: Record<SectionId, SectionDef> = {
  vitals:  { label: 'Spiritual Vitals', icon: '◉' },
  journey: { label: 'Pastoral Journey', icon: '◎' },
  feasts:  { label: 'Upcoming Feasts',  icon: '⊕' },
  foc:     { label: 'My FOC',           icon: '◈' },
};

export const DEFAULT_SECTIONS: SectionId[] = ['vitals', 'journey', 'feasts', 'foc'];

const STORAGE_KEY = 'poimen_dashboard_sections_v1';

export async function loadSections(): Promise<SectionId[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_SECTIONS;
    const parsed = JSON.parse(raw) as SectionId[];
    const valid = parsed.filter(id => id in SECTION_DEFS);
    return valid.length ? valid : DEFAULT_SECTIONS;
  } catch {
    return DEFAULT_SECTIONS;
  }
}

export async function saveSections(ids: SectionId[]): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
  } catch {}
}
