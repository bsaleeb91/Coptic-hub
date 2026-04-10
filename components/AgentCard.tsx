import { Pressable, Text, View } from 'react-native';
import { Link } from 'expo-router';
import { ShieldCheck } from 'lucide-react-native';
import { getIcon } from '@/lib/icons';
import type { Agent } from '@/lib/agents';

interface AgentCardProps {
  agent: Agent;
}

export function AgentCard({ agent }: AgentCardProps) {
  const Icon = getIcon(agent.icon);
  const isStrict = agent.grounding === 'strict';
  return (
    <Link href={`/agent/${agent.slug}` as any} asChild>
      <Pressable
        className={`${agent.color.base} rounded-xl2 p-5 min-h-[150px] justify-between active:opacity-90`}
      >
        <View className="flex-row items-start justify-between">
          <View className={`${agent.color.accent} rounded-full p-2.5`}>
            <Icon size={22} color="#FBF6EC" />
          </View>
          {isStrict ? (
            <View className="flex-row items-center rounded-full bg-parchment-50/15 px-2 py-1">
              <ShieldCheck size={12} color="#FBF6EC" />
              <Text className={`${agent.color.on} ml-1 text-[10px] font-semibold uppercase`}>
                Grounded
              </Text>
            </View>
          ) : null}
        </View>
        <View>
          <Text className={`${agent.color.on} text-lg font-semibold`} numberOfLines={1}>
            {agent.name}
          </Text>
          <Text className={`${agent.color.on} mt-1 text-xs opacity-80`} numberOfLines={2}>
            {agent.tagline}
          </Text>
          <View className="mt-3 flex-row items-center">
            <StatusDot status={agent.status} />
            <Text className={`${agent.color.on} ml-1.5 text-[10px] uppercase tracking-wide opacity-70`}>
              {agent.status}
            </Text>
          </View>
        </View>
      </Pressable>
    </Link>
  );
}

function StatusDot({ status }: { status: Agent['status'] }) {
  const colorMap = {
    stable: 'bg-olive-400',
    beta: 'bg-incense-300',
    stub: 'bg-parchment-300',
  } as const;
  return <View className={`h-2 w-2 rounded-full ${colorMap[status]}`} />;
}
