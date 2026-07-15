import { Tabs } from 'expo-router';
import { View, Text, StyleSheet } from 'react-native';
import { colors, fonts } from '@/lib/theme';
import Harp from '@/components/ui/Harp';

function TabIcon({
  symbol,
  icon,
  label,
  focused,
}: {
  symbol?: string;
  icon?: React.ReactNode;
  label: string;
  focused: boolean;
}) {
  return (
    <View style={styles.tabItem}>
      {icon ?? (
        <Text style={[styles.symbol, focused && styles.symbolActive]}>{symbol}</Text>
      )}
      <Text style={[styles.label, focused && styles.labelActive]} numberOfLines={1}>{label}</Text>
    </View>
  );
}

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: styles.tabBar,
        tabBarShowLabel: false,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon symbol="🏠" label="Home" focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="confession"
        options={{
          tabBarIcon: ({ focused }) => (
            // \uFE0E after the cross forces text presentation: iOS otherwise
            // swaps in the color emoji cross (white on purple square), which
            // ignores tinting.
            <TabIcon symbol={'\u271D\uFE0E'} label="Confess" focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="journal"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon symbol="🗒️" label="Journal" focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="prayer"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon symbol="🙏" label="Prayer" focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="psalms"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon
              icon={<Harp size={20} color={focused ? colors.gold : colors.muted} />}
              label="Psalms"
              focused={focused}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="canon"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon symbol="🕯️" label="Canon" focused={focused} />
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: colors.navyDark,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    height: 64,
    paddingBottom: 6,
    paddingTop: 6,
  },
  tabItem: {
    alignItems: 'center',
    gap: 2,
    width: 56,
  },
  symbol: {
    fontSize: 17,
    color: colors.muted,
  },
  symbolActive: {
    color: colors.gold,
  },
  label: {
    fontFamily: fonts.latoLight,
    fontSize: 9,
    color: colors.muted,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  labelActive: {
    fontFamily: fonts.latoBold,
    color: colors.goldLight,
  },
});
