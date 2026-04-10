import { View, Text, Pressable } from 'react-native';
import { Check, X } from 'lucide-react-native';
import type { PropsWithChildren } from 'react';

interface DrillCardProps {
  title: string;
  subtitle?: string;
  body: string;
  /** Optional footer actions; pass Buttons or custom controls */
  footer?: React.ReactNode;
}

/**
 * Generic drill card used by Psalm, Coptic Language, and Hymn memorization.
 * Shows a title (e.g. "Psalm 1 — v1-2"), a mode subtitle, the verse/prompt
 * text, and a footer slot for mode-specific controls.
 */
export function DrillCard({ title, subtitle, body, footer }: DrillCardProps) {
  return (
    <View className="rounded-xl2 bg-parchment-50 dark:bg-nile-800 border border-parchment-200 dark:border-nile-700 p-5 shadow-sm">
      <Text className="text-xs font-semibold uppercase tracking-wider text-incense-600 dark:text-incense-300">
        {subtitle}
      </Text>
      <Text className="mt-1 text-lg font-semibold text-nile-900 dark:text-parchment-100">
        {title}
      </Text>
      <View className="mt-4 rounded-xl2 bg-parchment-100 dark:bg-nile-900 p-4 border-l-4 border-incense-500">
        <Text className="text-base leading-relaxed text-nile-900 dark:text-parchment-100">
          {body}
        </Text>
      </View>
      {footer ? <View className="mt-4">{footer}</View> : null}
    </View>
  );
}

export function DrillResult({ correct }: { correct: boolean }) {
  return (
    <View
      className={`mt-3 flex-row items-center rounded-lg px-3 py-2 ${
        correct ? 'bg-olive-500/20' : 'bg-ember-500/20'
      }`}
    >
      {correct ? (
        <Check size={16} color="#6B8E23" />
      ) : (
        <X size={16} color="#B23A2C" />
      )}
      <Text
        className={`ml-2 text-sm font-semibold ${
          correct ? 'text-olive-600' : 'text-ember-700'
        }`}
      >
        {correct ? 'Correct — great job' : 'Not quite — try again'}
      </Text>
    </View>
  );
}
