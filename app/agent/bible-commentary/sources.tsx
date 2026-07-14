import { View, Text, Pressable } from 'react-native';
import { Stack } from 'expo-router';
import { FileText, Upload } from 'lucide-react-native';
import { Screen } from '@/components/Screen';
import { SOURCES } from '@/lib/fixtures';

export default function BibleCommentarySources() {
  const bcSources = SOURCES.filter((s) => s.agentSlug === 'bible-commentary');

  return (
    <Screen>
      <Stack.Screen options={{ title: 'Sources' }} />

      <View className="mb-5 mt-1">
        <Text className="text-2xl font-bold text-nile-900 dark:text-parchment-100">
          Your commentaries
        </Text>
        <Text className="mt-1 text-sm text-parchment-700 dark:text-parchment-400">
          Every answer is cited from these sources. Upload more any time.
        </Text>
      </View>

      <Pressable className="mb-5 flex-row items-center justify-center rounded-xl2 border-2 border-dashed border-incense-400 bg-incense-100/30 px-5 py-6 active:bg-incense-100/50">
        <Upload size={18} color="#C77807" />
        <Text className="ml-2 text-sm font-semibold text-incense-700">Upload a PDF</Text>
      </Pressable>

      <View className="gap-3">
        {bcSources.map((source) => (
          <View
            key={source.id}
            className="flex-row items-start rounded-xl2 bg-parchment-50 dark:bg-nile-800 border border-parchment-200 dark:border-nile-700 p-4"
          >
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
              <Text className="mt-1 text-xs text-parchment-700 dark:text-parchment-400">
                {source.pageCount} pages · uploaded {source.uploadedAt}
              </Text>
              <View className="mt-2 flex-row items-center">
                <View className="h-1.5 w-1.5 rounded-full bg-olive-500" />
                <Text className="ml-1.5 text-[11px] font-semibold uppercase text-olive-600">
                  Ready
                </Text>
              </View>
            </View>
          </View>
        ))}
      </View>

      <Text className="mt-6 text-center text-xs italic text-parchment-600 dark:text-parchment-500">
        Upload wiring lands in commit 2 alongside the ingest function.
      </Text>
    </Screen>
  );
}
