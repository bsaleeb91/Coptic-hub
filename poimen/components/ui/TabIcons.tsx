// components/ui/TabIcons.tsx
// Nepsis's monochrome line-icon set, drawn to match the Harp's stroke style
// (rounded caps, ~6/100 stroke weight). Unlike emoji, every icon takes a
// color prop: the tab bar tints them muted at rest / gold when active, and
// in-screen icons (Home tiles, Confession modules, Canon checklist) render
// them always-gold (crimson in the Parchment theme).

import React from 'react';
import Svg, { Path, Line, Rect, Circle } from 'react-native-svg';
import { colors } from '@/lib/theme';

interface Props {
  size?: number;
  color?: string;
}

export function HouseIcon({ size = 20, color = colors.gold }: Props) {
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100" fill="none">
      {/* Roof */}
      <Path d="M14 52 L50 20 L86 52" stroke={color} strokeWidth={7} strokeLinecap="round" strokeLinejoin="round" />
      {/* Walls */}
      <Path d="M26 50 L26 82 L74 82 L74 50" stroke={color} strokeWidth={6} strokeLinecap="round" strokeLinejoin="round" />
      {/* Arched door */}
      <Path d="M42 82 L42 64 C42 57, 58 57, 58 64 L58 82" stroke={color} strokeWidth={5} strokeLinecap="round" />
    </Svg>
  );
}

export function NotepadIcon({ size = 20, color = colors.gold }: Props) {
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100" fill="none">
      {/* Pad */}
      <Rect x={26} y={24} width={48} height={58} rx={7} stroke={color} strokeWidth={6} />
      {/* Spiral binding */}
      <Line x1={38} y1={15} x2={38} y2={31} stroke={color} strokeWidth={5} strokeLinecap="round" />
      <Line x1={50} y1={15} x2={50} y2={31} stroke={color} strokeWidth={5} strokeLinecap="round" />
      <Line x1={62} y1={15} x2={62} y2={31} stroke={color} strokeWidth={5} strokeLinecap="round" />
      {/* Ruled lines */}
      <Line x1={37} y1={47} x2={63} y2={47} stroke={color} strokeWidth={4} strokeLinecap="round" opacity={0.75} />
      <Line x1={37} y1={59} x2={63} y2={59} stroke={color} strokeWidth={4} strokeLinecap="round" opacity={0.75} />
      <Line x1={37} y1={71} x2={55} y2={71} stroke={color} strokeWidth={4} strokeLinecap="round" opacity={0.75} />
    </Svg>
  );
}

export function PrayingHandsIcon({ size = 20, color = colors.gold }: Props) {
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100" fill="none">
      {/* Palms pressed together */}
      <Path d="M50 12 C37 24, 29 42, 29 60 L29 78" stroke={color} strokeWidth={6.5} strokeLinecap="round" />
      <Path d="M50 12 C63 24, 71 42, 71 60 L71 78" stroke={color} strokeWidth={6.5} strokeLinecap="round" />
      {/* Seam between the hands */}
      <Path d="M50 18 L50 78" stroke={color} strokeWidth={4.5} strokeLinecap="round" opacity={0.85} />
      {/* Thumbs */}
      <Path d="M50 36 C44 38, 40 44, 39 52" stroke={color} strokeWidth={4} strokeLinecap="round" opacity={0.75} />
      <Path d="M50 36 C56 38, 60 44, 61 52" stroke={color} strokeWidth={4} strokeLinecap="round" opacity={0.75} />
      {/* Cuffs */}
      <Line x1={22} y1={84} x2={42} y2={84} stroke={color} strokeWidth={6.5} strokeLinecap="round" />
      <Line x1={58} y1={84} x2={78} y2={84} stroke={color} strokeWidth={6.5} strokeLinecap="round" />
    </Svg>
  );
}

export function CrossIcon({ size = 20, color = colors.gold }: Props) {
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100" fill="none">
      <Line x1={50} y1={14} x2={50} y2={86} stroke={color} strokeWidth={7.5} strokeLinecap="round" />
      <Line x1={30} y1={36} x2={70} y2={36} stroke={color} strokeWidth={7.5} strokeLinecap="round" />
    </Svg>
  );
}

export function BookIcon({ size = 20, color = colors.gold }: Props) {
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100" fill="none">
      {/* Open pages */}
      <Path d="M50 28 C42 21, 31 19, 20 22 L20 74 C31 71, 42 73, 50 80 C58 73, 69 71, 80 74 L80 22 C69 19, 58 21, 50 28 Z"
        stroke={color} strokeWidth={5.5} strokeLinejoin="round" />
      {/* Spine */}
      <Line x1={50} y1={30} x2={50} y2={78} stroke={color} strokeWidth={4} strokeLinecap="round" opacity={0.8} />
    </Svg>
  );
}

export function ChurchIcon({ size = 20, color = colors.gold }: Props) {
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100" fill="none">
      {/* Cross atop the dome */}
      <Line x1={50} y1={8} x2={50} y2={24} stroke={color} strokeWidth={5} strokeLinecap="round" />
      <Line x1={43} y1={14} x2={57} y2={14} stroke={color} strokeWidth={5} strokeLinecap="round" />
      {/* Dome */}
      <Path d="M30 56 C30 36, 70 36, 70 56" stroke={color} strokeWidth={6} strokeLinecap="round" />
      {/* Walls */}
      <Path d="M24 84 L24 56 L76 56 L76 84" stroke={color} strokeWidth={6} strokeLinecap="round" strokeLinejoin="round" />
      {/* Arched door */}
      <Path d="M43 84 L43 70 C43 63, 57 63, 57 70 L57 84" stroke={color} strokeWidth={5} strokeLinecap="round" />
    </Svg>
  );
}

export function HeartIcon({ size = 20, color = colors.gold }: Props) {
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100" fill="none">
      <Path d="M50 82 C24 62, 18 42, 28 30 C36 21, 48 25, 50 34 C52 25, 64 21, 72 30 C82 42, 76 62, 50 82 Z"
        stroke={color} strokeWidth={6} strokeLinejoin="round" />
    </Svg>
  );
}

export function LockIcon({ size = 20, color = colors.gold }: Props) {
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100" fill="none">
      {/* Shackle */}
      <Path d="M36 46 L36 34 C36 16, 64 16, 64 34 L64 46" stroke={color} strokeWidth={6} strokeLinecap="round" />
      {/* Body */}
      <Rect x={28} y={46} width={44} height={36} rx={7} stroke={color} strokeWidth={6} />
    </Svg>
  );
}

export function ClipboardIcon({ size = 20, color = colors.gold }: Props) {
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100" fill="none">
      {/* Board */}
      <Rect x={26} y={18} width={48} height={66} rx={7} stroke={color} strokeWidth={6} />
      {/* Clip */}
      <Path d="M40 18 L40 12 L60 12 L60 18" stroke={color} strokeWidth={5} strokeLinecap="round" />
      {/* Checked items */}
      <Path d="M35 42 L40 47 L48 36" stroke={color} strokeWidth={4.5} strokeLinecap="round" strokeLinejoin="round" opacity={0.8} />
      <Line x1={54} y1={43} x2={65} y2={43} stroke={color} strokeWidth={4.5} strokeLinecap="round" opacity={0.75} />
      <Path d="M35 62 L40 67 L48 56" stroke={color} strokeWidth={4.5} strokeLinecap="round" strokeLinejoin="round" opacity={0.8} />
      <Line x1={54} y1={63} x2={65} y2={63} stroke={color} strokeWidth={4.5} strokeLinecap="round" opacity={0.75} />
    </Svg>
  );
}

// ── Examination-of-conscience domain icons ──────────────────────────────────
// Tinted with each domain's accent color rather than gold, preserving the
// color coding of the six domains + "other".

export function SpeechIcon({ size = 20, color = colors.gold }: Props) {
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100" fill="none">
      <Path d="M50 18 C30 18, 15 30, 15 45 C15 57, 24 66, 38 69 L34 84 L52 70 C72 70, 85 59, 85 45 C85 30, 70 18, 50 18 Z"
        stroke={color} strokeWidth={6} strokeLinejoin="round" />
      <Circle cx={36} cy={45} r={3.5} fill={color} />
      <Circle cx={50} cy={45} r={3.5} fill={color} />
      <Circle cx={64} cy={45} r={3.5} fill={color} />
    </Svg>
  );
}

export function ThoughtIcon({ size = 20, color = colors.gold }: Props) {
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100" fill="none">
      <Path d="M34 60 C22 60, 16 48, 26 42 C24 30, 38 24, 46 30 C52 20, 70 22, 72 34 C84 36, 84 52, 72 56 C70 62, 60 66, 52 62 C46 66, 38 66, 34 60 Z"
        stroke={color} strokeWidth={5.5} strokeLinejoin="round" />
      <Circle cx={30} cy={74} r={5} stroke={color} strokeWidth={4} />
      <Circle cx={20} cy={86} r={3} stroke={color} strokeWidth={3.5} />
    </Svg>
  );
}

export function EarIcon({ size = 20, color = colors.gold }: Props) {
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100" fill="none">
      <Path d="M35 38 C35 18, 67 16, 67 38 C67 50, 59 54, 55 62 C52 72, 46 78, 38 73"
        stroke={color} strokeWidth={6} strokeLinecap="round" />
      <Path d="M46 38 C46 28, 56 28, 56 36 C56 43, 49 45, 48 51"
        stroke={color} strokeWidth={4.5} strokeLinecap="round" opacity={0.8} />
    </Svg>
  );
}

export function EyeIcon({ size = 20, color = colors.gold }: Props) {
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100" fill="none">
      <Path d="M14 50 C30 30, 70 30, 86 50 C70 70, 30 70, 14 50 Z"
        stroke={color} strokeWidth={6} strokeLinejoin="round" />
      <Circle cx={50} cy={50} r={10} stroke={color} strokeWidth={5.5} />
    </Svg>
  );
}

export function EyeOffIcon({ size = 20, color = colors.gold }: Props) {
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100" fill="none">
      <Path d="M14 50 C30 30, 70 30, 86 50 C70 70, 30 70, 14 50 Z"
        stroke={color} strokeWidth={6} strokeLinejoin="round" />
      <Circle cx={50} cy={50} r={10} stroke={color} strokeWidth={5.5} />
      <Line x1={18} y1={22} x2={82} y2={78} stroke={color} strokeWidth={6} strokeLinecap="round" />
    </Svg>
  );
}

export function HandIcon({ size = 20, color = colors.gold }: Props) {
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100" fill="none">
      {/* Fingers */}
      <Line x1={38} y1={26} x2={38} y2={48} stroke={color} strokeWidth={5} strokeLinecap="round" />
      <Line x1={48} y1={18} x2={48} y2={48} stroke={color} strokeWidth={5} strokeLinecap="round" />
      <Line x1={58} y1={22} x2={58} y2={48} stroke={color} strokeWidth={5} strokeLinecap="round" />
      <Line x1={68} y1={32} x2={68} y2={50} stroke={color} strokeWidth={5} strokeLinecap="round" />
      {/* Palm */}
      <Path d="M30 46 L30 62 C30 76, 40 86, 52 86 C66 86, 72 76, 72 62 L72 50"
        stroke={color} strokeWidth={6} strokeLinecap="round" />
      {/* Thumb */}
      <Path d="M30 58 C20 54, 20 44, 28 42" stroke={color} strokeWidth={5} strokeLinecap="round" />
    </Svg>
  );
}

export function PrayerRopeIcon({ size = 20, color = colors.gold }: Props) {
  const beads = [
    [50, 18], [66, 25], [72, 40], [66, 55], [50, 62], [34, 55], [28, 40], [34, 25],
  ];
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100" fill="none">
      {beads.map(([cx, cy], i) => (
        <Circle key={i} cx={cx} cy={cy} r={5.5} stroke={color} strokeWidth={4} />
      ))}
      {/* Cross pendant */}
      <Line x1={50} y1={68} x2={50} y2={88} stroke={color} strokeWidth={5} strokeLinecap="round" />
      <Line x1={42} y1={75} x2={58} y2={75} stroke={color} strokeWidth={5} strokeLinecap="round" />
    </Svg>
  );
}

export function PencilIcon({ size = 20, color = colors.gold }: Props) {
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100" fill="none">
      {/* Pencil */}
      <Path d="M62 20 L78 36 L44 70 L25 75 L30 56 Z" stroke={color} strokeWidth={5.5} strokeLinejoin="round" />
      <Line x1={55} y1={27} x2={71} y2={43} stroke={color} strokeWidth={4} opacity={0.7} />
      {/* Baseline */}
      <Line x1={24} y1={86} x2={78} y2={86} stroke={color} strokeWidth={5} strokeLinecap="round" />
    </Svg>
  );
}

export function CandleIcon({ size = 20, color = colors.gold }: Props) {
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100" fill="none">
      {/* Flame */}
      <Path d="M50 12 C42 22, 41 30, 50 35 C59 30, 58 22, 50 12 Z" stroke={color} strokeWidth={5} strokeLinejoin="round" />
      {/* Wick */}
      <Line x1={50} y1={37} x2={50} y2={45} stroke={color} strokeWidth={4} strokeLinecap="round" />
      {/* Body */}
      <Rect x={38} y={45} width={24} height={37} rx={5} stroke={color} strokeWidth={6} />
      {/* Holder */}
      <Line x1={28} y1={86} x2={72} y2={86} stroke={color} strokeWidth={6.5} strokeLinecap="round" />
    </Svg>
  );
}

// A single member — head and shoulders.
export function PersonIcon({ size = 20, color = colors.gold }: Props) {
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100" fill="none">
      {/* Head */}
      <Circle cx={50} cy={34} r={16} stroke={color} strokeWidth={6} />
      {/* Shoulders */}
      <Path d="M22 84 C22 60, 78 60, 78 84" stroke={color} strokeWidth={6} strokeLinecap="round" />
    </Svg>
  );
}

// A calendar — for a date or scheduled follow-up.
export function CalendarIcon({ size = 20, color = colors.gold }: Props) {
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100" fill="none">
      <Rect x={18} y={24} width={64} height={60} rx={7} stroke={color} strokeWidth={6} />
      <Line x1={18} y1={40} x2={82} y2={40} stroke={color} strokeWidth={5} />
      <Line x1={34} y1={16} x2={34} y2={30} stroke={color} strokeWidth={5} strokeLinecap="round" />
      <Line x1={66} y1={16} x2={66} y2={30} stroke={color} strokeWidth={5} strokeLinecap="round" />
      <Line x1={32} y1={54} x2={46} y2={54} stroke={color} strokeWidth={4.5} strokeLinecap="round" opacity={0.8} />
      <Line x1={54} y1={54} x2={68} y2={54} stroke={color} strokeWidth={4.5} strokeLinecap="round" opacity={0.8} />
      <Line x1={32} y1={68} x2={46} y2={68} stroke={color} strokeWidth={4.5} strokeLinecap="round" opacity={0.8} />
    </Svg>
  );
}

// A phone handset — for a phone/video check-in.
export function PhoneIcon({ size = 20, color = colors.gold }: Props) {
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100" fill="none">
      <Path d="M30 18 C24 18, 18 24, 18 32 C18 58, 42 82, 68 82 C76 82, 82 76, 82 70 L82 62 L62 54 L54 64 C46 60, 40 54, 36 46 L46 38 L38 18 Z"
        stroke={color} strokeWidth={6} strokeLinejoin="round" strokeLinecap="round" />
    </Svg>
  );
}

// A congregation — three figures, one behind and two before it.
export function CongregationIcon({ size = 20, color = colors.gold }: Props) {
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100" fill="none">
      {/* Center figure (behind) */}
      <Circle cx={50} cy={26} r={12} stroke={color} strokeWidth={5.5} />
      <Path d="M33 62 C33 45, 67 45, 67 62" stroke={color} strokeWidth={5.5} strokeLinecap="round" />
      {/* Left figure */}
      <Circle cx={23} cy={45} r={11} stroke={color} strokeWidth={5.5} />
      <Path d="M8 86 C8 66, 38 66, 38 86" stroke={color} strokeWidth={5.5} strokeLinecap="round" />
      {/* Right figure */}
      <Circle cx={77} cy={45} r={11} stroke={color} strokeWidth={5.5} />
      <Path d="M62 86 C62 66, 92 66, 92 86" stroke={color} strokeWidth={5.5} strokeLinecap="round" />
    </Svg>
  );
}
