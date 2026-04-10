import { View, Text } from 'react-native';
import { getIcon } from '@/lib/icons';
import { ShieldCheck } from 'lucide-react-native';
import type { Agent } from '@/lib/agents';

interface AgentHeaderProps {
  agent: Agent;
}

/**
 * Themed header for each agent screen. Shows the agent's icon, name, tagline,
 * and a "grounded" badge for strict agents so the user always knows when they
 * can trust citations.
 */
export function AgentHeader({ agent }: AgentHeaderProps) {
  const Icon = getIcon(agent.icon);
  return (
    <View className={`${agent.color.base} rounded-xl2 p-5 mb-4`}>
      <View className="flex-row items-center">
        <View className={`${agent.color.accent} rounded-full p-3`}>
          <Icon size={26} color="#FBF6EC" />
        </View>
        <View className="ml-4 flex-1">
          <Text className={`${agent.color.on} text-2xl font-semibold`}>{agent.name}</Text>
          <Text className={`${agent.color.on} text-sm opacity-80`}>{agent.tagline}</Text>
        </View>
      </View>
      {agent.grounding === 'strict' ? (
        <View className="mt-4 flex-row items-center rounded-lg bg-parchment-50/15 px-3 py-2">
          <ShieldCheck size={14} color="#FBF6EC" />
          <Text className={`${agent.color.on} ml-2 text-xs`}>
            Grounded answers only. Cites sources or refuses.
          </Text>
        </View>
      ) : null}
    </View>
  );
}
