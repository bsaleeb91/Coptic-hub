import { View, Text } from 'react-native';
import { Stack } from 'expo-router';
import { Trophy, Flame, Crown } from 'lucide-react-native';
import { Screen } from '@/components/Screen';
import { LEADERBOARD, type FakeLeaderboardRow } from '@/lib/fixtures';

export default function PsalmLeaderboard() {
  return (
    <Screen>
      <Stack.Screen options={{ title: 'Class Leaderboard' }} />

      <View className="mt-2 mb-4">
        <Text className="text-2xl font-bold text-nile-900 dark:text-parchment-100">
          Sunday School · Grade 7
        </Text>
        <Text className="mt-1 text-sm text-parchment-700 dark:text-parchment-400">
          This week · resets every Sunday at midnight.
        </Text>
      </View>

      <View className="gap-2">
        {LEADERBOARD.map((row) => (
          <LeaderboardRow key={row.rank} row={row} />
        ))}
      </View>

      <Text className="mt-6 text-center text-xs italic text-parchment-600 dark:text-parchment-500">
        Teacher dashboard and live updates ship in commit 3.
      </Text>
    </Screen>
  );
}

function LeaderboardRow({ row }: { row: FakeLeaderboardRow }) {
  const isTop = row.rank <= 3;
  const isYou = row.isYou;

  return (
    <View
      className={`flex-row items-center rounded-xl2 border p-4 ${
        isYou
          ? 'bg-incense-100 dark:bg-nile-800 border-incense-400'
          : 'bg-parchment-50 dark:bg-nile-800 border-parchment-200 dark:border-nile-700'
      }`}
    >
      <View
        className={`w-10 h-10 rounded-full items-center justify-center mr-3 ${
          row.rank === 1
            ? 'bg-incense-500'
            : row.rank === 2
              ? 'bg-parchment-300 dark:bg-nile-600'
              : row.rank === 3
                ? 'bg-ember-400'
                : 'bg-parchment-200 dark:bg-nile-700'
        }`}
      >
        {row.rank === 1 ? (
          <Crown size={18} color="#FBF6EC" />
        ) : (
          <Text
            className={`text-base font-bold ${
              isTop ? 'text-parchment-50' : 'text-nile-900 dark:text-parchment-100'
            }`}
          >
            {row.rank}
          </Text>
        )}
      </View>

      <View className="flex-1">
        <Text
          className={`text-base font-semibold ${
            isYou ? 'text-incense-700 dark:text-incense-300' : 'text-nile-900 dark:text-parchment-100'
          }`}
        >
          {row.name}
        </Text>
        <View className="mt-0.5 flex-row items-center">
          <Flame size={12} color="#B23A2C" />
          <Text className="ml-1 text-xs text-parchment-700 dark:text-parchment-400">
            {row.streak} day streak
          </Text>
        </View>
      </View>

      <View className="flex-row items-center">
        <Trophy size={14} color="#D88E1F" />
        <Text className="ml-1.5 text-base font-bold text-nile-900 dark:text-parchment-100">
          {row.points.toLocaleString()}
        </Text>
      </View>
    </View>
  );
}
