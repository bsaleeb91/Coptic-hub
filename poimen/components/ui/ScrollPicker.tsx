// components/ui/ScrollPicker.tsx
// A horizontal, snap-scrolling picker over a list of string options (ported from
// Nepsis, re-skinned to Poimen's theme). The option centered in the highlighted
// box is the selected one.

import React, { useRef, useState, useEffect } from 'react';
import {
  View, Text, ScrollView, StyleSheet,
  NativeSyntheticEvent, NativeScrollEvent,
} from 'react-native';
import { colors, fonts , lazyThemed } from '@/lib/theme';

interface Props {
  options: string[];
  value: string;
  onChange: (v: string) => void;   // committed on settle
  itemWidth?: number;
}

export default function ScrollPicker({ options, value, onChange, itemWidth = 96 }: Props) {
  const ref = useRef<ScrollView>(null);
  const [w, setW] = useState(0);
  const [active, setActive] = useState(Math.max(0, options.indexOf(value)));
  const pad = w > 0 ? (w - itemWidth) / 2 : 0;
  // Where the list is ACTUALLY scrolled, so an external value change can be
  // told apart from the picker's own. Starts at -1 (nowhere) rather than the
  // value's index: the list really is at offset 0 until the first layout, and
  // claiming otherwise would suppress the initial scroll into position.
  const atIdx = useRef(-1);
  const settle = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Bumped on every commit so the sync effect re-runs even when the parent
  // REJECTS the new value (clamping it back to what it already was). Without
  // it React bails out on the unchanged prop and the list stays parked on a
  // value the app never accepted.
  const [committed, setCommitted] = useState(0);

  const idxAt = (x: number) => Math.max(0, Math.min(options.length - 1, Math.round(x / itemWidth)));

  // Commit, and stop any pending debounce so the two paths can't both fire.
  const commit = (idx: number) => {
    if (settle.current) { clearTimeout(settle.current); settle.current = null; }
    onChange(options[idx]);
    setCommitted(n => n + 1);
  };

  useEffect(() => () => { if (settle.current) clearTimeout(settle.current); }, []);

  // Re-sync on `value` as well as width, so a value changed from OUTSIDE moves
  // the picker (a paired From/To pushing its partner along). Skipped when the
  // list already sits on that index — which is the picker's own changes — so
  // this can never yank a scroll out from under the user mid-gesture.
  useEffect(() => {
    const idx = Math.max(0, options.indexOf(value));
    setActive(idx);
    if (w > 0 && atIdx.current !== idx) {
      atIdx.current = idx;
      ref.current?.scrollTo({ x: idx * itemWidth, animated: false });
    }
  }, [w, value, committed]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <View onLayout={e => setW(e.nativeEvent.layout.width)} style={styles.wrap}>
      <View pointerEvents="none" style={[styles.highlight, { width: itemWidth, marginLeft: -itemWidth / 2, borderColor: colors.gold }]} />
      <ScrollView
        ref={ref}
        horizontal
        showsHorizontalScrollIndicator={false}
        snapToInterval={itemWidth}
        decelerationRate="fast"
        contentContainerStyle={{ paddingHorizontal: pad }}
        scrollEventThrottle={16}
        onScroll={(e: NativeSyntheticEvent<NativeScrollEvent>) => {
          const idx = idxAt(e.nativeEvent.contentOffset.x);
          atIdx.current = idx;
          setActive(idx);
          // react-native-web never fires onMomentumScrollEnd (its ScrollViewBase
          // wires only onScroll), so without this the picker would never commit
          // anything on web. Settling after a pause in scrolling covers it; on
          // native the momentum handler below usually wins the race, and either
          // way both commit the same index.
          if (settle.current) clearTimeout(settle.current);
          settle.current = setTimeout(() => commit(idx), 160);
        }}
        onMomentumScrollEnd={(e: NativeSyntheticEvent<NativeScrollEvent>) => commit(idxAt(e.nativeEvent.contentOffset.x))}
      >
        {options.map((opt, i) => (
          <View key={opt} style={[styles.item, { width: itemWidth }]}>
            <Text style={{ fontSize: i === active ? 18 : 14, fontFamily: fonts.latoBold, color: i === active ? colors.goldLight : colors.muted }}>{opt}</Text>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = lazyThemed(() => StyleSheet.create({
  wrap:      { height: 52, justifyContent: 'center' },
  highlight: { position: 'absolute', left: '50%', height: 40, borderRadius: 10, borderWidth: 1.5 },
  item:      { height: 52, alignItems: 'center', justifyContent: 'center' },
}));
