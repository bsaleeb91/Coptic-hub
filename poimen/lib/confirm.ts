// lib/confirm.ts
// Cross-platform confirmation for destructive actions. React Native's
// Alert.alert with a button list is a SILENT NO-OP on react-native-web — the
// dialog never opens and no callback fires — so on web we fall back to the
// browser's native confirm(). (profile.tsx's sign-out special-cases the same
// problem inline.)

import { Alert, Platform } from 'react-native';

export function confirmDestructive(
  title: string,
  message: string,
  confirmText: string,
  onConfirm: () => void,
): void {
  if (Platform.OS === 'web') {
    // eslint-disable-next-line no-alert
    if (typeof window !== 'undefined' && window.confirm(`${title}\n\n${message}`)) onConfirm();
    return;
  }
  Alert.alert(title, message, [
    { text: 'Cancel', style: 'cancel' },
    { text: confirmText, style: 'destructive', onPress: onConfirm },
  ]);
}
