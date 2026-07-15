// A horizontal, snap-scrolling picker over a list of string options. The option
// centered in the highlighted box is the selected one.
import React, { useRef, useState, useEffect } from 'react';
import {
  View, Text, ScrollView, StyleSheet,
  NativeSyntheticEvent, NativeScrollEvent,
} from 'react-native';
import { colors, fonts } from '@/lib/theme';

interface Props {
  options: string[];
  value: string;
  onChange: (v: string) => void;   // committed on settle
  itemWidth?: number;
}

export function ScrollPicker({ options, value, onChange, itemWidth = 96 }: Props) {
  const ref = useRef<ScrollView>(null);
  const [w, setW] = useState(0);
  const [active, setActive] = useState(Math.max(0, options.indexOf(value)));
  const pad = w > 0 ? (w - itemWidth) / 2 : 0;

  useEffect(() => {
    const idx = Math.max(0, options.indexOf(value));
    if (w > 0) ref.current?.scrollTo({ x: idx * itemWidth, animated: false });
    setActive(idx);
  }, [w]); // eslint-disable-line react-hooks/exhaustive-deps

  const idxAt = (x: number) => Math.max(0, Math.min(options.length - 1, Math.round(x / itemWidth)));

  return (
    <View onLayout={e => setW(e.nativeEvent.layout.width)} style={styles.wrap}>
      <View pointerEvents="none" style={[styles.highlight, { width: itemWidth, marginLeft: -itemWidth / 2 }]} />
      <ScrollView
        ref={ref}
        horizontal
        showsHorizontalScrollIndicator={false}
        snapToInterval={itemWidth}
        decelerationRate="fast"
        contentContainerStyle={{ paddingHorizontal: pad }}
        scrollEventThrottle={16}
        onScroll={(e: NativeSyntheticEvent<NativeScrollEvent>) => setActive(idxAt(e.nativeEvent.contentOffset.x))}
        onMomentumScrollEnd={(e: NativeSyntheticEvent<NativeScrollEvent>) => onChange(options[idxAt(e.nativeEvent.contentOffset.x)])}
      >
        {options.map((opt, i) => (
          <View key={opt} style={[styles.item, { width: itemWidth }]}>
            <Text style={{
              fontFamily: i === active ? fonts.latoBold : fonts.latoLight,
              fontSize: i === active ? 16 : 13,
              color: i === active ? colors.gold : colors.muted,
            }}>{opt}</Text>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap:      { height: 52, justifyContent: 'center' },
  highlight: { position: 'absolute', left: '50%', height: 40, borderRadius: 10, borderWidth: 1.5, borderColor: colors.gold },
  item:      { height: 52, alignItems: 'center', justifyContent: 'center' },
});
