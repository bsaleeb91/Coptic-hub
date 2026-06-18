import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

const isNative = Platform.OS !== 'web';

export const tap     = () => isNative && Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
export const done    = () => isNative && Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
export const success = () => isNative && Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
export const heavy   = () => isNative && Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
