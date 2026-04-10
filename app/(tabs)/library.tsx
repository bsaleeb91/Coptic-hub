import { View, Text } from 'react-native';
import { FileText } from 'lucide-react-native';
import { Screen } from '@/components/Screen';
import { SOURCES } from '@/lib/fixtures';
import { getAgent } from '@/lib/agents';

export default function Library() {
  return (
    <Screen>
      <View className="mt-2 mb-4">
        <Text className="text-3xl font-bold text-nile-900 dark:text-parchment-100">Library</Text>
        <Text className="mt-1 text-sm text-parchment-700 dark:text-parchment-400">
          Sources you've uploaded across every agent.
        </Text>
      </View>

      <View className="gap-3">
        {SOURCES.map((source) => {
          const agent = getAgent(source.agentSlug);
          const isReady = source.status === 'ready';
          return (
            <View
              key={source.id}
              className="rounded-xl2 bg-parchment-50 dark:bg-nile-800 border border-parchment-200 dark:border-nile-700 p-4"
            >
              <View className="flex-row items-start">
                <View className="rounded-full bg-incense-100 dark:bg-nile-700 p-2.5 mr-3">
                  <FileText size={18} color="#7A4B0B" />
                </View>
                <View className="flex-1">
                  <Text
                    className="text-base font-semibold text-nile-900 dark:text-parchment-100"
                    numberOfLines={2}
                  >
                    {source.title}
                  </Text>
                  <Text className="mt-0.5 text-xs text-parchment-700 dark:text-parchment-400">
                    {agent?.name ?? source.agentSlug} • {source.pageCount} pages • {source.uploadedAt}
                  </Text>
                  <View className="mt-2 flex-row items-center">
                    <View
                      className={`h-1.5 w-1.5 rounded-full ${
                        isReady ? 'bg-olive-500' : 'bg-incense-400'
                      }`}
                    />
                    <Text
                      className={`ml-1.5 text-[11px] font-semibold uppercase ${
                        isReady
                          ? 'text-olive-600'
                          : 'text-incense-600 dark:text-incense-300'
                      }`}
                    >
                      {isReady ? 'Ready' : 'Processing'}
                    </Text>
                  </View>
                </View>
              </View>
            </View>
          );
        })}
      </View>
    </Screen>
  );
}
