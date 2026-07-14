import { Pressable, Text, type PressableProps } from 'react-native';
import type { PropsWithChildren } from 'react';

type Variant = 'primary' | 'secondary' | 'ghost' | 'destructive';

interface ButtonProps extends PressableProps {
  variant?: Variant;
  fullWidth?: boolean;
}

const variants: Record<Variant, { bg: string; text: string; pressed: string }> = {
  primary: {
    bg: 'bg-incense-500',
    text: 'text-parchment-50',
    pressed: 'bg-incense-600',
  },
  secondary: {
    bg: 'bg-nile-700',
    text: 'text-parchment-50',
    pressed: 'bg-nile-800',
  },
  ghost: {
    bg: 'bg-parchment-100 dark:bg-nile-800',
    text: 'text-nile-800 dark:text-parchment-100',
    pressed: 'bg-parchment-200 dark:bg-nile-700',
  },
  destructive: {
    bg: 'bg-ember-500',
    text: 'text-parchment-50',
    pressed: 'bg-ember-700',
  },
};

export function Button({
  children,
  variant = 'primary',
  fullWidth = false,
  ...rest
}: PropsWithChildren<ButtonProps>) {
  const v = variants[variant];
  return (
    <Pressable
      className={`${v.bg} active:${v.pressed} rounded-xl2 px-5 py-3 ${fullWidth ? 'w-full' : 'self-start'}`}
      {...rest}
    >
      <Text className={`${v.text} text-center font-semibold text-base`}>{children}</Text>
    </Pressable>
  );
}
