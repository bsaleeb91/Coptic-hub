import { View, Text } from 'react-native';
import { Stack } from 'expo-router';
import { Screen } from '@/components/Screen';
import { DrillCard } from '@/components/DrillCard';
import { Button } from '@/components/Button';
import { HYMNS } from '@/lib/fixtures';

export default function HymnDrill() {
  const hymn = HYMNS[0]; // Agios O Theos

  return (
    <Screen>
      <Stack.Screen options={{ title: hymn.title }} />

      <View className="mt-2 mb-4">
        <Text className="text-xs font-semibold uppercase tracking-wider text-parchment-700 dark:text-parchment-400">
          {hymn.dialect} · {hymn.season}
        </Text>
        <Text className="mt-1 text-2xl font-bold text-nile-900 dark:text-parchment-100">
          {hymn.title}
        </Text>
      </View>

      <DrillCard
        subtitle="Study mode"
        title="Listen and read"
        body={hymn.verses.join('\n')}
        footer={
          <View className="gap-2">
            <View className="rounded-lg bg-nile-700/10 dark:bg-nile-700 px-3 py-2">
              <Text className="text-xs italic text-nile-800 dark:text-parchment-300">
                Audio track loads in a later commit.
              </Text>
            </View>
            <View className="flex-row gap-2">
              <Button variant="ghost">Slow down</Button>
              <Button variant="primary">Next line</Button>
            </View>
          </View>
        }
      />
    </Screen>
  );
}
