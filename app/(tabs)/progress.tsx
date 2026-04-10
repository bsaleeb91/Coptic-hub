import { View, Text } from 'react-native';
import { Flame, Trophy, Clock } from 'lucide-react-native';
import { Screen } from '@/components/Screen';
import { PROGRESS_SUMMARY } from '@/lib/fixtures';

export default function Progress() {
  return (
    <Screen>
      <View className="mt-2 mb-4">
        <Text className="text-3xl font-bold text-nile-900 dark:text-parchment-100">Progress</Text>
        <Text className="mt-1 text-sm text-parchment-700 dark:text-parchment-400">
          Everything you've learned, across every agent.
        </Text>
      </View>

      <View className="flex-row gap-3">
        <StatCard
          icon={<Trophy size={18} color="#D88E1F" />}
          label="Total points"
          value={PROGRESS_SUMMARY.totalPoints.toLocaleString()}
        />
        <StatCard
          icon={<Flame size={18} color="#B23A2C" />}
          label="Streak"
          value={`${PROGRESS_SUMMARY.currentStreak} days`}
        />
      </View>

      <View className="mt-4">
        <StatCard
          icon={<Clock size={18} color="#2F6C78" />}
          label="Last activity"
          value={PROGRESS_SUMMARY.lastActivity}
          wide
        />
      </View>

      <Text className="mt-8 mb-3 px-1 text-xs font-semibold uppercase tracking-wider text-nile-600 dark:text-parchment-300">
        Memorization
      </Text>
      <View className="rounded-xl2 bg-parchment-50 dark:bg-nile-800 border border-parchment-200 dark:border-nile-700 p-5">
        <View className="flex-row items-baseline">
          <Text className="text-4xl font-bold text-nile-900 dark:text-parchment-100">
            {PROGRESS_SUMMARY.psalmsMastered}
          </Text>
          <Text className="ml-2 text-base text-parchment-700 dark:text-parchment-400">
            of 8 psalms mastered
          </Text>
        </View>
        <Text className="mt-1 text-sm text-parchment-700 dark:text-parchment-400">
          {PROGRESS_SUMMARY.psalmsInProgress} in progress
        </Text>
      </View>

      <Text className="mt-8 mb-3 px-1 text-xs font-semibold uppercase tracking-wider text-nile-600 dark:text-parchment-300">
        Recent activity
      </Text>
      <View className="gap-2">
        {PROGRESS_SUMMARY.recentActivity.map((activity, i) => (
          <View
            key={i}
            className="rounded-xl2 bg-parchment-50 dark:bg-nile-800 border border-parchment-200 dark:border-nile-700 p-4"
          >
            <Text className="text-xs font-semibold uppercase tracking-wider text-incense-600 dark:text-incense-300">
              {activity.agent}
            </Text>
            <Text className="mt-1 text-sm text-nile-900 dark:text-parchment-100">
              {activity.detail}
            </Text>
            <Text className="mt-1 text-xs text-parchment-700 dark:text-parchment-400">
              {activity.when}
            </Text>
          </View>
        ))}
      </View>
    </Screen>
  );
}

function StatCard({
  icon,
  label,
  value,
  wide,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  wide?: boolean;
}) {
  return (
    <View
      className={`${wide ? '' : 'flex-1'} rounded-xl2 bg-parchment-50 dark:bg-nile-800 border border-parchment-200 dark:border-nile-700 p-4`}
    >
      <View className="flex-row items-center mb-2">
        {icon}
        <Text className="ml-1.5 text-[11px] font-semibold uppercase tracking-wider text-parchment-700 dark:text-parchment-400">
          {label}
        </Text>
      </View>
      <Text className="text-xl font-bold text-nile-900 dark:text-parchment-100">{value}</Text>
    </View>
  );
}
