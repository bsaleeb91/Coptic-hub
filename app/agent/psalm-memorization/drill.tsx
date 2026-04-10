import { useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { Stack } from 'expo-router';
import { BookOpen, Eye, Type, Mic } from 'lucide-react-native';
import { Screen } from '@/components/Screen';
import { DrillCard } from '@/components/DrillCard';
import { Button } from '@/components/Button';
import { PSALMS } from '@/lib/fixtures';

type DrillMode = 'study' | 'blank' | 'letters' | 'recitation';

const MODES: { key: DrillMode; label: string; icon: React.ReactNode; description: string }[] = [
  {
    key: 'study',
    label: 'Study',
    icon: <BookOpen size={16} color="#2F6C78" />,
    description: 'Read the full verse to commit it to memory.',
  },
  {
    key: 'blank',
    label: 'Fill the Blank',
    icon: <Eye size={16} color="#2F6C78" />,
    description: 'Every 4th word is hidden. Fill them in.',
  },
  {
    key: 'letters',
    label: 'First Letter',
    icon: <Type size={16} color="#2F6C78" />,
    description: 'Only first letters shown. Type the words.',
  },
  {
    key: 'recitation',
    label: 'Full Recitation',
    icon: <Mic size={16} color="#2F6C78" />,
    description: 'Recite the whole chunk from memory.',
  },
];

export default function PsalmDrill() {
  const [mode, setMode] = useState<DrillMode>('letters');

  const psalm = PSALMS[0]; // Psalm 1
  const chunk = psalm.chunks[1]; // v3-4 (matches dashboard "current chunk")

  const modeMeta = MODES.find((m) => m.key === mode)!;
  const body = renderForMode(chunk.text, mode);

  return (
    <Screen>
      <Stack.Screen options={{ title: 'Drill' }} />

      <View className="mt-2 mb-4">
        <Text className="text-xs font-semibold uppercase tracking-wider text-parchment-700 dark:text-parchment-400">
          {psalm.number} · {chunk.verseRange}
        </Text>
        <Text className="mt-1 text-2xl font-bold text-nile-900 dark:text-parchment-100">
          {psalm.title}
        </Text>
      </View>

      <View className="mb-4 flex-row flex-wrap gap-2">
        {MODES.map((m) => {
          const active = m.key === mode;
          return (
            <Pressable
              key={m.key}
              onPress={() => setMode(m.key)}
              className={`flex-row items-center rounded-full border px-3 py-2 ${
                active
                  ? 'bg-incense-500 border-incense-500'
                  : 'bg-parchment-50 dark:bg-nile-800 border-parchment-200 dark:border-nile-700'
              }`}
            >
              {active ? null : m.icon}
              <Text
                className={`${active ? '' : 'ml-1.5'} text-xs font-semibold ${
                  active ? 'text-parchment-50' : 'text-nile-800 dark:text-parchment-200'
                }`}
              >
                {m.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <DrillCard
        subtitle={modeMeta.label}
        title={`${psalm.number} — ${chunk.verseRange}`}
        body={body}
        footer={
          <View className="gap-3">
            <Text className="text-xs italic text-parchment-700 dark:text-parchment-400">
              {modeMeta.description}
            </Text>
            <View className="flex-row gap-2">
              <Button variant="ghost">Skip</Button>
              <Button variant="primary">I got it</Button>
            </View>
          </View>
        }
      />

      <View className="mt-6 rounded-xl2 bg-parchment-100 dark:bg-nile-800 p-4">
        <Text className="text-xs font-semibold uppercase tracking-wider text-nile-600 dark:text-parchment-400 mb-2">
          Progression
        </Text>
        <Text className="text-xs text-parchment-700 dark:text-parchment-400 leading-relaxed">
          Complete each mode correctly 3 times to master this chunk. Master every chunk to master
          the psalm. Claude Haiku reviews failed attempts — not successful ones.
        </Text>
      </View>
    </Screen>
  );
}

function renderForMode(text: string, mode: DrillMode): string {
  switch (mode) {
    case 'study':
      return text;
    case 'blank':
      return text
        .split(/\s+/)
        .map((w, i) => (i > 0 && i % 4 === 0 ? '____' : w))
        .join(' ');
    case 'letters':
      return text
        .split(/\s+/)
        .map((w) => {
          const match = w.match(/^([^\w]*)(\w)(\w*)([^\w]*)$/);
          if (!match) return w;
          const [, lead, first, rest, tail] = match;
          return `${lead}${first}${'_'.repeat(rest.length)}${tail}`;
        })
        .join(' ');
    case 'recitation':
      return '(Text hidden — recite the chunk out loud or in your head, then tap "I got it" to check yourself.)';
  }
}
