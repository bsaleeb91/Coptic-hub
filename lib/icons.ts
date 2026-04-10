/**
 * Icon registry — maps agent registry `icon` keys to Lucide components.
 * Centralized so the agent registry can stay plain data (strings, not JSX).
 */

import {
  BookOpen,
  Mic,
  Scroll,
  Languages,
  Music,
  Church,
  ClipboardList,
  type LucideIcon,
} from 'lucide-react-native';

export const ICONS: Record<string, LucideIcon> = {
  'book-open': BookOpen,
  mic: Mic,
  scroll: Scroll,
  languages: Languages,
  music: Music,
  church: Church,
  'clipboard-list': ClipboardList,
};

export function getIcon(key: string): LucideIcon {
  return ICONS[key] ?? BookOpen;
}
