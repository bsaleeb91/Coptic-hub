import { View, Text, Pressable } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { Trophy, Flame, Sparkles, ChevronRight, Target, Users } from 'lucide-react-native';
import { Screen } from '@/components/Screen';
import { PSALM_DASHBOARD } from '@/lib/fixtures';

export default function PsalmDashboard() {
  const router = useRouter();

  return (
    <Screen>
      <Stack.Screen options={{ title: 'Psalm Memorization' }} />

      <View className="mt-2 mb-4">
        <Text className="text-xs font-semibold uppercase tracking-wider text-incense-600 dark:text-incense-300">
          Verse of the day
        </Text>
        <View className="mt-2 rounded-xl2 bg-incense-100 dark:bg-nile-800 border border-incense-300 dark:border-nile-700 p-5">
          <Text className="text-sm font-semibold text-incense-700 dark:text-incense-300">
            {PSALM_DASHBOARD.verseOfTheDay.reference}
          </Text>
          <Text className="mt-2 text-base leading-relaxed italic text-nile-900 dark:text-parchment-100">
            &ldquo;{PSALM_DASHBOARD.verseOfTheDay.text}&rdquo;
          </Text>
        </View>
      </View>

      <View className="mt-4 flex-row gap-3">
        <View className="flex-1 rounded-xl2 bg-parchment-50 dark:bg-nile-800 border border-parchment-200 dark:border-nile-700 p-4">
          <View className="flex-row items-center mb-1.5">
            <Trophy size={16} color="#D88E1F" />
            <Text className="ml-1.5 text-[11px] font-semibold uppercase tracking-wider text-parchment-700 dark:text-parchment-400">
              Points
            </Text>
          </View>
          <Text className="text-2xl font-bold text-nile-900 dark:text-parchment-100">
            {PSALM_DASHBOARD.totalPoints.toLocaleString()}
          </Text>
        </View>
        <View className="flex-1 rounded-xl2 bg-parchment-50 dark:bg-nile-800 border border-parchment-200 dark:border-nile-700 p-4">
          <View className="flex-row items-center mb-1.5">
            <Flame size={16} color="#B23A2C" />
            <Text className="ml-1.5 text-[11px] font-semibold uppercase tracking-wider text-parchment-700 dark:text-parchment-400">
              Streak
            </Text>
          </View>
          <Text className="text-2xl font-bold text-nile-900 dark:text-parchment-100">
            {PSALM_DASHBOARD.streak} days
          </Text>
        </View>
      </View>

      <Pressable
        onPress={() => router.push('/agent/psalm-memorization/drill')}
        className="mt-5 rounded-xl2 bg-incense-600 p-5 active:bg-incense-700"
      >
        <View className="flex-row items-center">
          <Sparkles size={20} color="#FBF6EC" />
          <Text className="ml-2 text-xs font-semibold uppercase tracking-wider text-parchment-50/80">
            Continue where you left off
          </Text>
        </View>
        <Text className="mt-2 text-xl font-bold text-parchment-50">
          {PSALM_DASHBOARD.currentPsalm} · {PSALM_DASHBOARD.currentChunk}
        </Text>
        <Text className="mt-1 text-sm text-parchment-50/80">
          Mode: {PSALM_DASHBOARD.currentMode}
        </Text>
        <View className="mt-4 flex-row items-center">
          <Text className="text-sm font-semibold text-parchment-50">Start drill</Text>
          <ChevronRight size={16} color="#FBF6EC" style={{ marginLeft: 4 }} />
        </View>
      </Pressable>

      <View className="mt-5 gap-3">
        <Pressable
          onPress={() => router.push('/agent/psalm-memorization/progress')}
          className="flex-row items-center rounded-xl2 bg-parchment-50 dark:bg-nile-800 border border-parchment-200 dark:border-nile-700 p-4 active:bg-parchment-100"
        >
          <View className="rounded-full bg-olive-500/20 p-2.5 mr-3">
            <Target size={18} color="#6B8E23" />
          </View>
          <View className="flex-1">
            <Text className="text-base font-semibold text-nile-900 dark:text-parchment-100">
              My Progress
            </Text>
            <Text className="text-xs text-parchment-700 dark:text-parchment-400">
              All 8 psalms · mastery status
            </Text>
          </View>
          <ChevronRight size={16} color="#8C7548" />
        </Pressable>

        <Pressable
          onPress={() => router.push('/agent/psalm-memorization/leaderboard')}
          className="flex-row items-center rounded-xl2 bg-parchment-50 dark:bg-nile-800 border border-parchment-200 dark:border-nile-700 p-4 active:bg-parchment-100"
        >
          <View className="rounded-full bg-nile-500/20 p-2.5 mr-3">
            <Users size={18} color="#2F6C78" />
          </View>
          <View className="flex-1">
            <Text className="text-base font-semibold text-nile-900 dark:text-parchment-100">
              Class Leaderboard
            </Text>
            <Text className="text-xs text-parchment-700 dark:text-parchment-400">
              See how your class ranks
            </Text>
          </View>
          <ChevronRight size={16} color="#8C7548" />
        </Pressable>
      </View>
    </Screen>
  );
}
