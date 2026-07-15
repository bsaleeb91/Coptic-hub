import React, { useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Animated,
  Dimensions, Modal, Platform,
} from 'react-native';
import { colors, fonts } from '@/lib/theme';
import type { TutorialStep } from '@/lib/tutorial';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

interface Props {
  steps: TutorialStep[];
  currentIndex: number;
  onNext: () => void;
  onSkip: () => void;
  visible: boolean;
}

export function TutorialOverlay({ steps, currentIndex, onNext, onSkip, visible }: Props) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    if (visible) {
      fadeAnim.setValue(0);
      slideAnim.setValue(20);
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 1, duration: 280, useNativeDriver: true }),
        Animated.timing(slideAnim, { toValue: 0, duration: 280, useNativeDriver: true }),
      ]).start();
    }
  }, [visible, currentIndex]);

  if (!visible || steps.length === 0) return null;

  const step = steps[currentIndex];
  if (!step) return null;

  const isLast = currentIndex === steps.length - 1;
  const position = step.position;

  const sheetStyle = [
    styles.sheet,
    position === 'top' && styles.sheetTop,
    position === 'bottom' && styles.sheetBottom,
    position === 'center' && styles.sheetCenter,
  ];

  return (
    <Modal transparent animationType="none" visible={visible} statusBarTranslucent>
      <Animated.View style={[styles.backdrop, { opacity: fadeAnim }]}>

        <TouchableOpacity style={StyleSheet.absoluteFill} onPress={onSkip} activeOpacity={1} />

        <Animated.View style={[...sheetStyle, { transform: [{ translateY: slideAnim }] }]}>

          {/* Step indicator */}
          <View style={styles.dotsRow}>
            {steps.map((_, i) => (
              <View key={i} style={[styles.dot, i === currentIndex && styles.dotActive]} />
            ))}
          </View>

          {/* Cross accent */}
          <Text style={styles.crossAccent}>✝︎</Text>

          {/* Content */}
          <Text style={styles.title}>{step.title}</Text>
          <Text style={styles.body}>{step.body}</Text>

          {/* Step count */}
          <Text style={styles.count}>{currentIndex + 1} of {steps.length}</Text>

          {/* Actions */}
          <View style={styles.actions}>
            <TouchableOpacity onPress={onSkip} style={styles.skipBtn}>
              <Text style={styles.skipText}>Skip</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={onNext} style={styles.nextBtn}>
              <Text style={styles.nextText}>{isLast ? 'DONE' : 'NEXT'}</Text>
            </TouchableOpacity>
          </View>

        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

const SHEET_WIDTH = Math.min(SCREEN_W - 40, 480);

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(5,10,22,0.82)',
    justifyContent: 'center',
    alignItems: 'center',
  },

  sheet: {
    width: SHEET_WIDTH,
    backgroundColor: colors.navyMid,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 28,
  },
  sheetTop: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 100 : 80,
    left: 20,
    right: 20,
    width: undefined,
  },
  sheetBottom: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 100 : 80,
    left: 20,
    right: 20,
    width: undefined,
  },
  sheetCenter: {},

  dotsRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 20,
  },
  dot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: 'rgba(201,168,76,0.25)',
  },
  dotActive: {
    width: 16,
    backgroundColor: colors.gold,
  },

  crossAccent: {
    fontFamily: fonts.cormorant,
    fontSize: 22,
    color: colors.gold,
    opacity: 0.4,
    marginBottom: 10,
  },

  title: {
    fontFamily: fonts.cormorantMedium,
    fontSize: 24,
    color: colors.cream,
    marginBottom: 10,
    lineHeight: 30,
  },
  body: {
    fontFamily: fonts.latoLight,
    fontSize: 14,
    color: colors.muted,
    lineHeight: 22,
    marginBottom: 20,
  },
  count: {
    fontFamily: fonts.latoBold,
    fontSize: 9,
    letterSpacing: 1.5,
    color: 'rgba(245,240,232,0.25)',
    textTransform: 'uppercase',
    marginBottom: 20,
  },

  actions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  skipBtn: {
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  skipText: {
    fontFamily: fonts.lato,
    fontSize: 13,
    color: 'rgba(245,240,232,0.35)',
  },
  nextBtn: {
    backgroundColor: colors.gold,
    borderRadius: 10,
    paddingHorizontal: 28,
    paddingVertical: 11,
  },
  nextText: {
    fontFamily: fonts.latoBold,
    fontSize: 11,
    letterSpacing: 1,
    color: colors.navy,
  },
});
