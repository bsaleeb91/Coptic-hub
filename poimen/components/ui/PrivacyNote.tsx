import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, fonts } from '@/lib/theme';

export function PrivacyNote({ text }: { text: string }) {
  return (
    <View style={styles.container}>
      <Text style={styles.icon}>🔒</Text>
      <Text style={styles.text}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
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
    fontSize: 13,
    flexShrink: 0,
    marginTop: 1,
  },
  text: {
    fontFamily: fonts.latoLight,
    fontSize: 11,
    color: colors.muted,
    lineHeight: 18,
    flex: 1,
  },
});
