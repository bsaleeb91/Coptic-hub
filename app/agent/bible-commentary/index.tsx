import { View, Text, Pressable } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { FolderOpen } from 'lucide-react-native';
import { Screen } from '@/components/Screen';
import { ChatView } from '@/components/ChatView';
import { BIBLE_COMMENTARY_MESSAGES } from '@/lib/fixtures';
import { getAgent } from '@/lib/agents';

export default function BibleCommentary() {
  const router = useRouter();
  const agent = getAgent('bible-commentary')!;

  return (
    <Screen scroll={false} contentClassName="px-5 pt-3 pb-4">
      <Stack.Screen
        options={{
          title: agent.name,
          headerRight: () => (
            <Pressable
              onPress={() => router.push('/agent/bible-commentary/sources')}
              hitSlop={8}
              className="mr-1 flex-row items-center rounded-lg bg-parchment-50/10 px-2.5 py-1.5 active:bg-parchment-50/20"
            >
              <FolderOpen size={14} color="#FBF6EC" />
              <Text className="ml-1.5 text-xs font-semibold text-parchment-50">Sources</Text>
            </Pressable>
          ),
        }}
      />

      <View className="mb-3 flex-row items-center rounded-lg bg-nile-700/10 dark:bg-nile-700 px-3 py-2">
        <View className="h-2 w-2 rounded-full bg-olive-500" />
        <Text className="ml-2 text-xs font-medium text-nile-800 dark:text-parchment-200">
          Grounded mode · answers cite sources or refuse
        </Text>
      </View>

      <ChatView
        messages={BIBLE_COMMENTARY_MESSAGES}
        placeholder="Ask about the commentaries you've uploaded..."
      />
    </Screen>
  );
}
