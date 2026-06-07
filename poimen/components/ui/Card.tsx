import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { colors, fonts } from '@/lib/theme';

interface CardProps {
  title?: string;
  titleIcon?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  style?: ViewStyle;
  bodyStyle?: ViewStyle;
}

export function Card({ title, titleIcon, action, children, style, bodyStyle }: CardProps) {
  return (
    <View style={[styles.card, style]}>
      {title && (
        <View style={styles.header}>
          <Text style={styles.title}>
            {titleIcon ? (
              <Text style={styles.titleIcon}>{titleIcon}{'  '}</Text>
            ) : null}
            {title}
          </Text>
          {action}
        </View>
      )}
      <View style={[styles.body, bodyStyle]}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.cardBg,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    overflow: 'hidden',
    marginBottom: 16,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    fontFamily: fonts.cormorantMedium,
    fontSize: 17,
    color: colors.cream,
  },
  titleIcon: {
    color: colors.gold,
    fontSize: 14,
  },
  body: {
    padding: 18,
  },
});
