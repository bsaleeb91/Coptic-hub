import { Tabs } from 'expo-router';
import { View, Text, StyleSheet } from 'react-native';
import { colors, fonts } from '@/lib/theme';

function TabIcon({ symbol, label, focused }: { symbol: string; label: string; focused: boolean }) {
  return (
    <View style={styles.tabItem}>
      <Text style={[styles.symbol, focused && styles.symbolActive]}>{symbol}</Text>
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
            <TabIcon symbol="◈" label="Home" focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="confession"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon symbol="✝" label="Confess" focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="journal"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon symbol="✦" label="Journal" focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="prayer"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon symbol="◇" label="Prayer" focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="psalms"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon symbol="♪" label="Psalms" focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="canon"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon symbol="📜" label="Canon" focused={focused} />
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
