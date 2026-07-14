import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors } from '@/lib/theme';

type BadgeVariant = 'green' | 'yellow' | 'red';

interface BadgeProps {
  variant: BadgeVariant;
  label: string;
}

export function Badge({ variant, label }: BadgeProps) {
  const bg = { green: colors.greenBg, yellow: colors.yellowBg, red: colors.redBg }[variant];
  const color = { green: colors.green, yellow: colors.yellow, red: colors.red }[variant];

  return (
    <View style={[styles.badge, { backgroundColor: bg }]}>
      <Text style={[styles.label, { color }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 20,
    alignSelf: 'flex-start',
    marginTop: 8,
  },
  label: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
});
