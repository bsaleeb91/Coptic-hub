import { useRef, useState } from 'react';
import { View, Text, ScrollView, Dimensions, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { AGENTS } from '@/lib/agents';
import { getIcon } from '@/lib/icons';
import { Screen } from '@/components/Screen';
import { Button } from '@/components/Button';
import { ShieldCheck, ChevronRight } from 'lucide-react-native';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function Onboarding() {
  const router = useRouter();
  const scrollRef = useRef<ScrollView>(null);
  const [pageIndex, setPageIndex] = useState(0);
  const totalPages = AGENTS.length + 1; // welcome card + one per agent

  function goNext() {
    if (pageIndex < totalPages - 1) {
      const next = pageIndex + 1;
      scrollRef.current?.scrollTo({ x: next * SCREEN_WIDTH, animated: true });
      setPageIndex(next);
    } else {
      router.replace('/(auth)/sign-in');
    }
  }

  return (
    <Screen scroll={false}>
      <View className="flex-1">
        <ScrollView
          ref={scrollRef}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={(e) =>
            setPageIndex(Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH))
          }
        >
          <WelcomePage />
          {AGENTS.map((agent) => (
            <AgentPage
              key={agent.slug}
              name={agent.name}
              tagline={agent.tagline}
              description={agent.description}
              icon={agent.icon}
              bg={agent.color.base}
              on={agent.color.on}
              accent={agent.color.accent}
              isStrict={agent.grounding === 'strict'}
            />
          ))}
        </ScrollView>

        <View className="flex-row items-center justify-between px-5 pt-4 pb-2">
          <View className="flex-row gap-1.5">
            {Array.from({ length: totalPages }).map((_, i) => (
              <View
                key={i}
                className={`h-1.5 rounded-full ${
                  i === pageIndex
                    ? 'w-6 bg-incense-500'
                    : 'w-1.5 bg-parchment-300 dark:bg-nile-700'
                }`}
              />
            ))}
          </View>
          <Pressable onPress={() => router.replace('/(auth)/sign-in')}>
            <Text className="text-sm text-parchment-700 dark:text-parchment-400">Skip</Text>
          </Pressable>
        </View>
        <View className="px-5 pt-3 pb-6">
          <Button variant="primary" fullWidth onPress={goNext}>
            {pageIndex === totalPages - 1 ? 'Get started' : 'Next'}
          </Button>
        </View>
      </View>
    </Screen>
  );
}

function WelcomePage() {
  return (
    <View className="justify-center px-8" style={{ width: SCREEN_WIDTH }}>
      <Text className="text-5xl font-bold text-nile-900 dark:text-parchment-100">
        Coptic Hub
      </Text>
      <Text className="mt-3 text-lg text-parchment-700 dark:text-parchment-300 leading-snug">
        One home for your Bible study, memorization drills, hymns, and rites. Every agent in your
        pocket, synced across your devices.
      </Text>
      <Text className="mt-8 text-sm text-parchment-700 dark:text-parchment-400">
        Swipe to meet the agents.
      </Text>
      <ChevronRight size={18} color="#8C7548" style={{ marginTop: 4 }} />
    </View>
  );
}

function AgentPage(props: {
  name: string;
  tagline: string;
  description: string;
  icon: string;
  bg: string;
  on: string;
  accent: string;
  isStrict: boolean;
}) {
  const Icon = getIcon(props.icon);
  return (
    <View className="px-6 justify-center" style={{ width: SCREEN_WIDTH }}>
      <View className={`${props.bg} rounded-xl2 p-6`}>
        <View className={`${props.accent} self-start rounded-full p-4 mb-5`}>
          <Icon size={32} color="#FBF6EC" />
        </View>
        <Text className={`${props.on} text-3xl font-semibold`}>{props.name}</Text>
        <Text className={`${props.on} mt-2 text-base opacity-80`}>{props.tagline}</Text>
        <Text className={`${props.on} mt-5 text-sm opacity-90 leading-relaxed`}>
          {props.description}
        </Text>
        {props.isStrict ? (
          <View className="mt-5 flex-row items-center rounded-lg bg-parchment-50/15 px-3 py-2">
            <ShieldCheck size={14} color="#FBF6EC" />
            <Text className={`${props.on} ml-2 text-xs`}>
              Grounded answers only. Cites sources or refuses.
            </Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}
