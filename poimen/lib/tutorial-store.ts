import AsyncStorage from '@react-native-async-storage/async-storage';
import type { TutorialKey } from '@/lib/tutorial';

// Role tours keep the key they have always had (`poimen_tutorial_seen_priest`
// and so on) so nobody who has already taken one is shown it again by this
// change. Module tutorials are namespaced under the same prefix with the colon
// flattened, since a storage key is a flat string.
const key = (k: TutorialKey) => `poimen_tutorial_seen_${k.replace(':', '_')}`;

export async function hasTutorialBeenSeen(k: TutorialKey): Promise<boolean> {
  try {
    const val = await AsyncStorage.getItem(key(k));
    return val === 'true';
  } catch {
    return false;
  }
}

export async function markTutorialSeen(k: TutorialKey): Promise<void> {
  try {
    await AsyncStorage.setItem(key(k), 'true');
  } catch {}
}

export async function resetTutorial(k: TutorialKey): Promise<void> {
  try {
    await AsyncStorage.removeItem(key(k));
  } catch {}
}
