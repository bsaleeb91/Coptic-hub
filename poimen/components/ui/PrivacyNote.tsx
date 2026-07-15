import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, fonts , lazyThemed } from '@/lib/theme';
import { LockIcon } from '@/components/ui/TabIcons';

export function PrivacyNote({ text }: { text: string }) {
  return (
    <View style={styles.container}>
      <View style={styles.icon}><LockIcon size={13} color={colors.gold} /></View>
      <Text style={styles.text}>{text}</Text>
    </View>
  );
}

const styles = lazyThemed(() => StyleSheet.create({
  container: {
    flexDirection: 'row',
    gap: 8,
    backgroundColor: 'rgba(201,168,76,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(201,168,76,0.14)',
    borderRadius: 8,
    padding: 11,
    marginTop: 12,
    alignItems: 'flex-start',
  },
  icon: {
    flexShrink: 0,
    marginTop: 2,
  },
  text: {
    fontFamily: fonts.latoLight,
    fontSize: 11,
    color: colors.muted,
    lineHeight: 18,
    flex: 1,
  },
}));
