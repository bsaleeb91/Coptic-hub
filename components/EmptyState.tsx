import { View, Text } from 'react-native';
import type { PropsWithChildren } from 'react';

interface EmptyStateProps {
  title: string;
  body?: string;
}

export function EmptyState({ title, body, children }: PropsWithChildren<EmptyStateProps>) {
  return (
    <View className="items-center justify-center py-16 px-6">
      <Text className="text-xl font-semibold text-nile-800 dark:text-parchment-100 text-center">
        {title}
      </Text>
      {body ? (
        <Text className="mt-2 text-center text-base text-parchment-700 dark:text-parchment-400">
          {body}
        </Text>
      ) : null}
      {children ? <View className="mt-6">{children}</View> : null}
    </View>
  );
}
