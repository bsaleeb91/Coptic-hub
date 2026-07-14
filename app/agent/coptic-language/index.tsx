import { View, Text, Pressable } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { ChevronRight } from 'lucide-react-native';
import { Screen } from '@/components/Screen';
import { COPTIC_ALPHABET } from '@/lib/fixtures';

export default function CopticLanguage() {
  const router = useRouter();

  return (
    <Screen>
      <Stack.Screen options={{ title: 'Coptic Language' }} />

      <View className="mt-2 mb-4">
        <Text className="text-2xl font-bold text-nile-900 dark:text-parchment-100">
          The Coptic Alphabet
        </Text>
        <Text className="mt-1 text-sm text-parchment-700 dark:text-parchment-400">
          Bohairic pronunciation · 32 letters total.
        </Text>
      </View>

      <View className="flex-row flex-wrap -mx-1.5">
        {COPTIC_ALPHABET.map((letter) => (
          <View key={letter.name} className="w-1/3 p-1.5">
            <Pressable className="aspect-square rounded-xl2 bg-parchment-50 dark:bg-nile-800 border border-parchment-200 dark:border-nile-700 items-center justify-center active:bg-incense-100">
              <Text className="text-4xl text-nile-900 dark:text-parchment-100">
                {letter.glyph}
              </Text>
              <Text className="mt-1 text-xs font-semibold text-nile-700 dark:text-parchment-300">
                {letter.name}
              </Text>
              <Text className="text-[10px] italic text-parchment-700 dark:text-parchment-400">
                {letter.value}
              </Text>
            </Pressable>
          </View>
        ))}
      </View>

      <Pressable
        onPress={() => router.push('/agent/coptic-language/drill')}
        className="mt-6 flex-row items-center rounded-xl2 bg-nile-800 p-5 active:bg-nile-900"
      >
        <View className="flex-1">
          <Text className="text-xs font-semibold uppercase tracking-wider text-incense-300">
            Start a drill
          </Text>
          <Text className="mt-1 text-lg font-bold text-parchment-50">
            Recognize 10 letters
          </Text>
        </View>
        <ChevronRight size={20} color="#FBF6EC" />
      </Pressable>

      <Text className="mt-6 text-center text-xs italic text-parchment-600 dark:text-parchment-500">
        Full alphabet, numbers, and vocabulary lessons ship in a later commit.
      </Text>
    </Screen>
  );
}
