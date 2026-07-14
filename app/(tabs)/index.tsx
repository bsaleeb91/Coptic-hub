import { View, Text } from 'react-native';
import { Screen } from '@/components/Screen';
import { AgentCard } from '@/components/AgentCard';
import { CategorySection } from '@/components/CategorySection';
import { AGENTS, CATEGORIES, agentsByCategory } from '@/lib/agents';

export default function Hub() {
  return (
    <Screen>
      <View className="mb-6 mt-2">
        <Text className="text-sm font-medium text-parchment-600 dark:text-parchment-400">
          Welcome to
        </Text>
        <Text className="mt-0.5 text-3xl font-bold text-nile-900 dark:text-parchment-100">
          Coptic Hub
        </Text>
        <Text className="mt-1 text-sm text-parchment-700 dark:text-parchment-400">
          {AGENTS.length} agents, one home.
        </Text>
      </View>

      {CATEGORIES.map((cat) => {
        const agents = agentsByCategory(cat.key);
        if (agents.length === 0) return null;
        return (
          <CategorySection key={cat.key} title={cat.label}>
            {agents.map((agent) => (
              <AgentCard key={agent.slug} agent={agent} />
            ))}
          </CategorySection>
        );
      })}
    </Screen>
  );
}
