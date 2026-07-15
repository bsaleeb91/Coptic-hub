// components/ui/Harp.tsx
// A concert harp (the harp of David), used as the Psalms tab icon: a straight
// fore-pillar on the left, a curved neck across the top, a rounded soundboard
// on the right, and strings fanning from the neck down to the soundboard.
// SVG so it scales crisply and tints with the tab bar's focus color.

import React from 'react';
import Svg, { Path, Line } from 'react-native-svg';
import { colors } from '@/lib/theme';

interface Props {
  size?: number;
  color?: string;
}

const STRINGS: [number, number, number, number][] = [
  // x, y-top (on neck), x, y-bottom (on soundboard)
  [40, 15, 40, 80],
  [47, 12, 47, 75],
  [54, 12, 54, 69],
  [61, 15, 61, 64],
  [68, 22, 68, 58],
  [75, 32, 75, 53],
];

export default function Harp({ size = 24, color = colors.gold }: Props) {
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100" fill="none">
      {/* Strings */}
      {STRINGS.map(([x1, y1, x2, y2], i) => (
        <Line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke={color} strokeWidth={1.4} opacity={0.75} />
      ))}
      {/* Soundboard edge the strings rest on */}
      <Line x1="35" y1="83" x2="80" y2="50" stroke={color} strokeWidth={2.5} strokeLinecap="round" />

      {/* Curved neck (top) */}
      <Path d="M28 22 C 38 8, 62 8, 82 42" stroke={color} strokeWidth={5.5} strokeLinecap="round" fill="none" />
      {/* Rounded body / soundboard (right) */}
      <Path d="M82 42 C 96 66, 82 89, 45 89" stroke={color} strokeWidth={5.5} strokeLinecap="round" fill="none" />
      {/* Fore-pillar (left column) */}
      <Path d="M30 87 L27 24" stroke={color} strokeWidth={7} strokeLinecap="round" />
      {/* Base foot */}
      <Path d="M20 89 L48 89" stroke={color} strokeWidth={7} strokeLinecap="round" />
      {/* Capital where neck meets the pillar */}
      <Path d="M24 23 L34 23" stroke={color} strokeWidth={6} strokeLinecap="round" />
    </Svg>
  );
}
