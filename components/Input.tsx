import { TextInput, View, Text, type TextInputProps } from 'react-native';

interface InputProps extends TextInputProps {
  label?: string;
}

export function Input({ label, className = '', ...rest }: InputProps) {
  return (
    <View className="w-full">
      {label ? (
        <Text className="mb-1.5 text-sm font-medium text-nile-800 dark:text-parchment-200">
          {label}
        </Text>
      ) : null}
      <TextInput
        placeholderTextColor="#B89C67"
        className={`w-full rounded-xl2 border border-parchment-200 bg-parchment-50 px-4 py-3 text-base text-nile-900 dark:border-nile-700 dark:bg-nile-800 dark:text-parchment-100 ${className}`}
        {...rest}
      />
    </View>
  );
}
