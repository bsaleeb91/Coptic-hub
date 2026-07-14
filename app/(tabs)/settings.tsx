import { View, Text, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { User, Moon, Info, LogOut, ChevronRight } from 'lucide-react-native';
import { Screen } from '@/components/Screen';

export default function Settings() {
  const router = useRouter();

  return (
    <Screen>
      <View className="mt-2 mb-6">
        <Text className="text-3xl font-bold text-nile-900 dark:text-parchment-100">Settings</Text>
      </View>

      <View className="rounded-xl2 bg-parchment-50 dark:bg-nile-800 border border-parchment-200 dark:border-nile-700 p-5">
        <View className="flex-row items-center">
          <View className="rounded-full bg-incense-100 dark:bg-nile-700 p-3 mr-4">
            <User size={24} color="#7A4B0B" />
          </View>
          <View className="flex-1">
            <Text className="text-lg font-semibold text-nile-900 dark:text-parchment-100">
              Guest (mockup)
            </Text>
            <Text className="text-sm text-parchment-700 dark:text-parchment-400">
              Real profile lands in commit 1.5
            </Text>
          </View>
        </View>
      </View>

      <View className="mt-6 rounded-xl2 bg-parchment-50 dark:bg-nile-800 border border-parchment-200 dark:border-nile-700 overflow-hidden">
        <SettingsRow icon={<Moon size={18} color="#2F6C78" />} label="Appearance" value="System" />
        <SettingsRow icon={<Info size={18} color="#2F6C78" />} label="About" value="v0.1.0" />
      </View>

      <View className="mt-6">
        <Pressable
          onPress={() => router.replace('/(auth)/sign-in')}
          className="flex-row items-center justify-center rounded-xl2 bg-ember-500/10 border border-ember-300 py-3.5 active:bg-ember-500/20"
        >
          <LogOut size={16} color="#B23A2C" />
          <Text className="ml-2 text-sm font-semibold text-ember-700">Sign out</Text>
        </Pressable>
      </View>
    </Screen>
  );
}

function SettingsRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <Pressable className="flex-row items-center px-5 py-4 border-b border-parchment-200 dark:border-nile-700 last:border-b-0">
      {icon}
      <Text className="ml-3 flex-1 text-base text-nile-900 dark:text-parchment-100">{label}</Text>
      <Text className="text-sm text-parchment-700 dark:text-parchment-400">{value}</Text>
      <ChevronRight size={16} color="#8C7548" style={{ marginLeft: 6 }} />
    </Pressable>
  );
}
