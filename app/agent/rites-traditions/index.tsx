import { View, Text } from 'react-native';
import { Stack } from 'expo-router';
import { Screen } from '@/components/Screen';
import { ChatView } from '@/components/ChatView';
import { RITES_MESSAGES } from '@/lib/fixtures';
import { getAgent } from '@/lib/agents';

export default function RitesTraditions() {
  const agent = getAgent('rites-traditions')!;

  return (
    <Screen scroll={false} contentClassName="px-5 pt-3 pb-4">
      <Stack.Screen options={{ title: agent.name }} />

      <View className="mb-3 flex-row items-center rounded-lg bg-nile-700/10 dark:bg-nile-700 px-3 py-2">
        <View className="h-2 w-2 rounded-full bg-olive-500" />
        <Text className="ml-2 text-xs font-medium text-nile-800 dark:text-parchment-200">
          Grounded mode · answers cite liturgical references or refuse
        </Text>
      </View>

      <ChatView
        messages={RITES_MESSAGES}
        placeholder="Ask about rites, feasts, or liturgical practice..."
      />
    </Screen>
  );
}
