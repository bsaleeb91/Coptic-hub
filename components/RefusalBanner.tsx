import { View, Text } from 'react-native';
import { ShieldAlert } from 'lucide-react-native';

interface RefusalBannerProps {
  message: string;
}

/**
 * Shown when a strict agent has no matching sources for a question. In commit 2,
 * this will be rendered in place of an assistant message whenever the RAG
 * retrieval returns no chunks above the similarity threshold — never a
 * hallucinated answer.
 */
export function RefusalBanner({ message }: RefusalBannerProps) {
  return (
    <View className="mb-4 self-start max-w-[85%] rounded-xl2 border border-ember-300 bg-ember-500/10 p-4 dark:bg-ember-700/30">
      <View className="flex-row items-center mb-1.5">
        <ShieldAlert size={16} color="#B23A2C" />
        <Text className="ml-2 text-xs font-semibold uppercase tracking-wider text-ember-700 dark:text-ember-300">
          No matching source
        </Text>
      </View>
      <Text className="text-[15px] leading-snug text-nile-900 dark:text-parchment-100">
        {message}
      </Text>
    </View>
  );
}
