import { View, Text } from 'react-native';
import { Stack } from 'expo-router';
import { Mic, Tag, ListOrdered, HelpCircle } from 'lucide-react-native';
import { Screen } from '@/components/Screen';
import { Button } from '@/components/Button';
import { SERMON_SUMMARY } from '@/lib/fixtures';

export default function SermonDigest() {
  return (
    <Screen>
      <Stack.Screen options={{ title: 'Sermon Digest' }} />

      <View className="mt-2 mb-4 rounded-xl2 bg-nile-700 p-5">
        <View className="flex-row items-center">
          <Mic size={18} color="#FBF6EC" />
          <Text className="ml-2 text-xs font-semibold uppercase tracking-wider text-parchment-50/80">
            Most recent
          </Text>
        </View>
        <Text className="mt-2 text-2xl font-bold text-parchment-50">
          {SERMON_SUMMARY.title}
        </Text>
        <Text className="mt-1 text-sm text-parchment-50/80">
          {SERMON_SUMMARY.preacher} · {SERMON_SUMMARY.date}
        </Text>
      </View>

      <Section
        icon={<Tag size={16} color="#C77807" />}
        title="Themes"
      >
        <View className="flex-row flex-wrap gap-2">
          {SERMON_SUMMARY.themes.map((theme) => (
            <View
              key={theme}
              className="rounded-full bg-incense-100 dark:bg-nile-700 px-3 py-1.5 border border-incense-300 dark:border-nile-600"
            >
              <Text className="text-xs font-semibold text-incense-700 dark:text-incense-300">
                {theme}
              </Text>
            </View>
          ))}
        </View>
      </Section>

      <Section
        icon={<ListOrdered size={16} color="#C77807" />}
        title="Outline"
      >
        <View className="gap-2">
          {SERMON_SUMMARY.outline.map((point, i) => (
            <View
              key={i}
              className="flex-row items-start rounded-xl2 bg-parchment-50 dark:bg-nile-800 border border-parchment-200 dark:border-nile-700 p-3"
            >
              <Text className="text-sm font-bold text-incense-600 dark:text-incense-300 mr-2">
                {i + 1}.
              </Text>
              <Text className="flex-1 text-sm text-nile-900 dark:text-parchment-100">
                {point}
              </Text>
            </View>
          ))}
        </View>
      </Section>

      <Section
        icon={<HelpCircle size={16} color="#C77807" />}
        title="Discussion questions"
      >
        <View className="gap-2">
          {SERMON_SUMMARY.questions.map((q, i) => (
            <View
              key={i}
              className="rounded-xl2 bg-parchment-50 dark:bg-nile-800 border-l-4 border-incense-500 border border-parchment-200 dark:border-nile-700 p-3"
            >
              <Text className="text-sm italic text-nile-900 dark:text-parchment-100">
                {q}
              </Text>
            </View>
          ))}
        </View>
      </Section>

      <View className="mt-6">
        <Button variant="primary" fullWidth>
          Paste a new transcript
        </Button>
      </View>
    </Screen>
  );
}

function Section({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <View className="mt-6">
      <View className="flex-row items-center mb-3 px-1">
        {icon}
        <Text className="ml-1.5 text-xs font-semibold uppercase tracking-wider text-nile-600 dark:text-parchment-300">
          {title}
        </Text>
      </View>
      {children}
    </View>
  );
}
