import { Stack } from 'expo-router';
import { theme } from '@/lib/theme';

export default function AgentLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: theme.nile[700] },
        headerTintColor: theme.parchment[50],
        headerTitleStyle: { fontWeight: '600' },
        contentStyle: { backgroundColor: theme.parchment[50] },
      }}
    />
  );
}
