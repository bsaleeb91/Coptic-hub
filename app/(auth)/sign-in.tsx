import { useState } from 'react';
import { View, Text } from 'react-native';
import { useRouter } from 'expo-router';
import { Screen } from '@/components/Screen';
import { Input } from '@/components/Input';
import { Button } from '@/components/Button';

/**
 * Visual sign-in. In commit 1 "Sign in" just routes to the tabs. Real Supabase
 * magic link + password land in commit 1.5.
 */
export default function SignIn() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  return (
    <Screen>
      <View className="mt-8">
        <Text className="text-3xl font-bold text-nile-900 dark:text-parchment-100">
          Welcome back
        </Text>
        <Text className="mt-1.5 text-base text-parchment-700 dark:text-parchment-400">
          Sign in to pick up where you left off.
        </Text>
      </View>

      <View className="mt-10 gap-4">
        <Input
          label="Email"
          value={email}
          onChangeText={setEmail}
          placeholder="you@example.com"
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
        />
        <Input
          label="Password"
          value={password}
          onChangeText={setPassword}
          placeholder="••••••••"
          secureTextEntry
        />
      </View>

      <View className="mt-8 gap-3">
        <Button variant="primary" fullWidth onPress={() => router.replace('/(tabs)')}>
          Sign in
        </Button>
        <Button variant="ghost" fullWidth onPress={() => router.replace('/(tabs)')}>
          Email me a sign-in link instead
        </Button>
      </View>

      <Text className="mt-10 text-center text-sm text-parchment-700 dark:text-parchment-400">
        New here?{' '}
        <Text
          className="font-semibold text-incense-600 dark:text-incense-300"
          onPress={() => router.replace('/(tabs)')}
        >
          Create an account
        </Text>
      </Text>

      <Text className="mt-12 text-center text-[11px] italic text-parchment-600 dark:text-parchment-500">
        Mockup: any button continues to the Hub. Real auth in commit 1.5.
      </Text>
    </Screen>
  );
}
