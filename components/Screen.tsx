import { SafeAreaView } from 'react-native-safe-area-context';
import { ScrollView, View, type ViewProps } from 'react-native';
import type { PropsWithChildren } from 'react';

interface ScreenProps extends ViewProps {
  /** Wrap content in a ScrollView (default: true) */
  scroll?: boolean;
  /** Extra Tailwind classes on the inner container */
  contentClassName?: string;
  /** Background override; defaults to parchment-50 / nile-900 */
  bgClassName?: string;
}

/**
 * Base screen wrapper. Handles safe area, background, and optional scroll.
 * Every top-level route should render through this to get consistent padding.
 */
export function Screen({
  children,
  scroll = true,
  contentClassName = '',
  bgClassName = 'bg-parchment-50 dark:bg-nile-900',
  className,
  ...rest
}: PropsWithChildren<ScreenProps>) {
  const Content = scroll ? ScrollView : View;
  return (
    <SafeAreaView className={`flex-1 ${bgClassName}`} edges={['top']}>
      <Content
        className={`flex-1 ${contentClassName}`}
        contentContainerClassName={scroll ? 'px-5 pt-4 pb-10' : undefined}
        {...(rest as any)}
      >
        {children}
      </Content>
    </SafeAreaView>
  );
}
