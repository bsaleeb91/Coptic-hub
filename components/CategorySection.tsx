import { View, Text } from 'react-native';
import type { PropsWithChildren } from 'react';

interface CategorySectionProps {
  title: string;
  subtitle?: string;
}

export function CategorySection({
  title,
  subtitle,
  children,
}: PropsWithChildren<CategorySectionProps>) {
  return (
    <View className="mb-6">
      <View className="mb-3 px-1">
        <Text className="text-xs font-semibold uppercase tracking-wider text-nile-600 dark:text-parchment-300">
          {title}
        </Text>
        {subtitle ? (
          <Text className="mt-0.5 text-sm text-parchment-700 dark:text-parchment-400">
            {subtitle}
          </Text>
        ) : null}
      </View>
      <View className="gap-3">{children}</View>
    </View>
  );
}
