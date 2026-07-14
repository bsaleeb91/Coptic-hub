import { Link, Stack } from 'expo-router';
import { View, Text } from 'react-native';
import { Screen } from '@/components/Screen';

export default function NotFound() {
  return (
    <>
      <Stack.Screen options={{ title: 'Not found' }} />
      <Screen>
        <View className="mt-20 items-center">
          <Text className="text-2xl font-semibold text-nile-900 dark:text-parchment-100">
            Page not found
          </Text>
          <Text className="mt-2 text-parchment-700 dark:text-parchment-400">
            That route doesn't exist yet.
          </Text>
          <Link href="/(tabs)" className="mt-6 text-incense-600 dark:text-incense-300 font-semibold">
            Go to Hub
          </Link>
        </View>
      </Screen>
    </>
  );
}
