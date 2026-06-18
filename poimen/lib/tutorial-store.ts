import AsyncStorage from '@react-native-async-storage/async-storage';

const key = (role: string) => `poimen_tutorial_seen_${role}`;

export async function hasTutorialBeenSeen(role: 'congregant' | 'priest' | 'servant'): Promise<boolean> {
  try {
    const val = await AsyncStorage.getItem(key(role));
    return val === 'true';
  } catch {
    return false;
  }
}

export async function markTutorialSeen(role: 'congregant' | 'priest' | 'servant'): Promise<void> {
  try {
    await AsyncStorage.setItem(key(role), 'true');
  } catch {}
}

export async function resetTutorial(role: 'congregant' | 'priest' | 'servant'): Promise<void> {
  try {
    await AsyncStorage.removeItem(key(role));
  } catch {}
}
