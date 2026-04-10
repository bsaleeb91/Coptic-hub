import { View, Text, Pressable } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { Music, ChevronRight, Play } from 'lucide-react-native';
import { Screen } from '@/components/Screen';
import { HYMNS } from '@/lib/fixtures';

export default function HymnMemorization() {
  const router = useRouter();

  return (
    <Screen>
      <Stack.Screen options={{ title: 'Hymn Memorization' }} />

      <View className="mt-2 mb-4">
        <Text className="text-2xl font-bold text-nile-900 dark:text-parchment-100">
          Hymn Library
        </Text>
        <Text className="mt-1 text-sm text-parchment-700 dark:text-parchment-400">
          Text and audio drills across all three Coptic dialects.
        </Text>
      </View>

      <View className="gap-3">
        {HYMNS.map((hymn) => (
          <Pressable
            key={hymn.id}
            onPress={() => router.push('/agent/hymn-memorization/drill')}
            className="rounded-xl2 bg-parchment-50 dark:bg-nile-800 border border-parchment-200 dark:border-nile-700 p-4 active:bg-parchment-100"
          >
            <View className="flex-row items-start">
              <View className="rounded-full bg-incense-100 dark:bg-nile-700 p-2.5 mr-3">
                <Music size={18} color="#7A4B0B" />
              </View>
              <View className="flex-1">
                <Text className="text-base font-semibold text-nile-900 dark:text-parchment-100">
                  {hymn.title}
                </Text>
                <Text className="mt-0.5 text-xs text-parchment-700 dark:text-parchment-400">
                  {hymn.dialect} · {hymn.season}
                </Text>
                <Text
                  className="mt-2 text-sm italic text-nile-800 dark:text-parchment-300"
                  numberOfLines={2}
                >
                  {hymn.verses[0]}
                </Text>
              </View>
              <View className="ml-2 items-center justify-center rounded-full bg-incense-500 p-2">
                <Play size={14} color="#FBF6EC" />
              </View>
            </View>
          </Pressable>
        ))}
      </View>

      <Text className="mt-6 text-center text-xs italic text-parchment-600 dark:text-parchment-500">
        Audio playback and dialect switching ship in a later commit.
      </Text>
    </Screen>
  );
}
