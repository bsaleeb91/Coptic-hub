import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { colors, fonts , lazyThemed } from '@/lib/theme';

interface CardProps {
  title?: string;
  titleIcon?: string;
  titleIconNode?: React.ReactNode;   // a drawn line-icon shown before the title
  action?: React.ReactNode;
  children: React.ReactNode;
  style?: ViewStyle;
  bodyStyle?: ViewStyle;
  flat?: boolean;
}

export function Card({ title, titleIcon, titleIconNode, action, children, style, bodyStyle, flat }: CardProps) {
  if (flat) {
    return (
      <View style={[styles.flat, style]}>
        {title && (
          <View style={styles.flatHeader}>
            <Text style={styles.flatTitle}>{title.toUpperCase()}</Text>
            {action}
          </View>
        )}
        <View style={[styles.flatBody, bodyStyle]}>{children}</View>
      </View>
    );
  }

  return (
    <View style={[styles.card, style]}>
      {title && (
        <View style={styles.header}>
          <View style={styles.titleWrap}>
            {titleIconNode ? <View style={styles.titleIconNode}>{titleIconNode}</View> : null}
            <Text style={styles.title}>
              {titleIcon ? (
                <Text style={styles.titleIcon}>{titleIcon}{'  '}</Text>
              ) : null}
              {title}
            </Text>
          </View>
          {action}
        </View>
      )}
      <View style={[styles.body, bodyStyle]}>{children}</View>
    </View>
  );
}

const styles = lazyThemed(() => StyleSheet.create({
  card: {
    backgroundColor: colors.cardBg,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    overflow: 'hidden',
    marginBottom: 20,
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
  titleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  titleIconNode: {
    width: 20,
    alignItems: 'center',
    justifyContent: 'center',
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

  // Flat variant — section label + thin top rule, no chrome
  flat: {
    marginBottom: 24,
  },
  flatHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 10,
    marginBottom: 0,
  },
  flatTitle: {
    fontFamily: fonts.latoBold,
    fontSize: 9,
    letterSpacing: 2,
    color: colors.muted,
    opacity: 0.7,
  },
  flatBody: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 4,
  },
}));
