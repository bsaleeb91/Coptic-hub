import { useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { Stack } from 'expo-router';
import { Screen } from '@/components/Screen';
import { DrillCard, DrillResult } from '@/components/DrillCard';
import { Button } from '@/components/Button';
import { COPTIC_ALPHABET } from '@/lib/fixtures';

export default function CopticDrill() {
  const letter = COPTIC_ALPHABET[2]; // Gamma — a clean example
  const [picked, setPicked] = useState<string | null>(null);

  const choices = ['Alpha', 'Gamma', 'Delta', 'Ei'];
  const correct = picked === letter.name;

  return (
    <Screen>
      <Stack.Screen options={{ title: 'Alphabet Drill' }} />

      <View className="mt-2 mb-4">
        <Text className="text-xs font-semibold uppercase tracking-wider text-parchment-700 dark:text-parchment-400">
          Question 3 of 10
        </Text>
        <Text className="mt-1 text-2xl font-bold text-nile-900 dark:text-parchment-100">
          Name this letter
        </Text>
      </View>

      <DrillCard
        subtitle="Letter recognition"
        title={letter.glyph}
        body={`Pronounced "${letter.value}"`}
        footer={
          <View className="gap-2">
            {choices.map((choice) => {
              const selected = picked === choice;
              const isCorrect = choice === letter.name;
              return (
                <Pressable
                  key={choice}
                  onPress={() => setPicked(choice)}
                  className={`rounded-xl2 border px-4 py-3 ${
                    selected
                      ? isCorrect
                        ? 'bg-olive-500/20 border-olive-500'
                        : 'bg-ember-500/20 border-ember-500'
                      : 'bg-parchment-50 dark:bg-nile-800 border-parchment-200 dark:border-nile-700'
                  }`}
                >
                  <Text className="text-base font-semibold text-nile-900 dark:text-parchment-100">
                    {choice}
                  </Text>
                </Pressable>
              );
            })}
            {picked ? <DrillResult correct={correct} /> : null}
            <View className="mt-2 flex-row gap-2">
              <Button variant="ghost" onPress={() => setPicked(null)}>
                Reset
              </Button>
              <Button variant="primary">Next</Button>
            </View>
          </View>
        }
      />
    </Screen>
  );
}
