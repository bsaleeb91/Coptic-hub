import { View, Text, Pressable } from 'react-native';
import { Stack } from 'expo-router';
import { CheckCircle2, Lock, CircleDashed } from 'lucide-react-native';
import { Screen } from '@/components/Screen';
import { PSALMS, type FakePsalm } from '@/lib/fixtures';

export default function PsalmProgress() {
  return (
    <Screen>
      <Stack.Screen options={{ title: 'My Progress' }} />

      <View className="mt-2 mb-4">
        <Text className="text-2xl font-bold text-nile-900 dark:text-parchment-100">
          The Curated Psalter
        </Text>
        <Text className="mt-1 text-sm text-parchment-700 dark:text-parchment-400">
          8 psalms · master each to unlock the next.
        </Text>
      </View>

      <View className="gap-3">
        {PSALMS.map((psalm) => (
          <PsalmRow key={psalm.id} psalm={psalm} />
        ))}
      </View>
    </Screen>
  );
}

function PsalmRow({ psalm }: { psalm: FakePsalm }) {
  const statusMeta = {
    mastered: {
      icon: <CheckCircle2 size={20} color="#6B8E23" />,
      label: 'Mastered',
      labelClass: 'text-olive-600',
      border: 'border-olive-500/40',
    },
    'in-progress': {
      icon: <CircleDashed size={20} color="#C77807" />,
      label: 'In progress',
      labelClass: 'text-incense-600 dark:text-incense-300',
      border: 'border-incense-400',
    },
    locked: {
      icon: <Lock size={20} color="#8C7548" />,
      label: 'Locked',
      labelClass: 'text-parchment-700 dark:text-parchment-500',
      border: 'border-parchment-200 dark:border-nile-700',
    },
  }[psalm.mastery];

  const isLocked = psalm.mastery === 'locked';
  const progressPct = (psalm.progressLevel / 4) * 100;

  return (
    <Pressable
      disabled={isLocked}
      className={`rounded-xl2 bg-parchment-50 dark:bg-nile-800 border ${statusMeta.border} p-4 ${
        isLocked ? 'opacity-60' : 'active:bg-parchment-100'
      }`}
    >
      <View className="flex-row items-start">
        <View className="mr-3 mt-0.5">{statusMeta.icon}</View>
        <View className="flex-1">
          <View className="flex-row items-baseline">
            <Text className="text-base font-semibold text-nile-900 dark:text-parchment-100">
              {psalm.number}
            </Text>
            <Text className="ml-2 text-sm text-parchment-700 dark:text-parchment-400">
              · {psalm.verseCount} verses
            </Text>
          </View>
          <Text className="mt-0.5 text-sm italic text-parchment-700 dark:text-parchment-400">
            {psalm.title}
          </Text>

          <View className="mt-3 flex-row items-center">
            <View className="flex-1 h-1.5 rounded-full bg-parchment-200 dark:bg-nile-700 overflow-hidden">
              <View
                className="h-full rounded-full bg-olive-500"
                style={{ width: `${progressPct}%` }}
              />
            </View>
            <Text className={`ml-3 text-[11px] font-semibold uppercase ${statusMeta.labelClass}`}>
              {statusMeta.label}
            </Text>
          </View>
        </View>
      </View>
    </Pressable>
  );
}
