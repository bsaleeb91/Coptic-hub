// components/ui/DrawerMenuButton.tsx
// The (tabs) drawer only opens via a left-edge swipe or this button — Home
// wires its own version of this inline, but every other drawer screen
// (Confession, Journal, Prayer, Psalms, Canon) shipped with no way to open
// the drawer at all, trapping anyone who lands there without swiping.
import React from 'react';
import { Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useNavigation } from 'expo-router';
import { DrawerActions } from '@react-navigation/native';
import { colors, lazyThemed } from '@/lib/theme';

export function DrawerMenuButton() {
  const navigation = useNavigation();
  return (
    <TouchableOpacity
      style={styles.btn}
      onPress={() => navigation.dispatch(DrawerActions.openDrawer())}
      hitSlop={8}
    >
      <Text style={styles.icon}>☰</Text>
    </TouchableOpacity>
  );
}

const styles = lazyThemed(() => StyleSheet.create({
  btn: {
    width: 36, height: 36, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.panel,
    borderWidth: 1, borderColor: colors.border,
    marginRight: 12,
  },
  icon: { fontSize: 16, color: colors.gold },
}));
