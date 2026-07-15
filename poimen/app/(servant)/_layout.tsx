import { Tabs } from 'expo-router';
import { View, Text, StyleSheet } from 'react-native';
import { colors, fonts , lazyThemed } from '@/lib/theme';

function TabIcon({ symbol, label, focused }: { symbol: string; label: string; focused: boolean }) {
  return (
    <View style={styles.tabItem}>
      <Text style={[styles.symbol, focused && styles.symbolActive]}>{symbol}</Text>
      <Text style={[styles.label, focused && styles.labelActive]}>{label}</Text>
    </View>
  );
}

export default function ServantLayout() {
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
            <TabIcon symbol="◉" label="Students" focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="student"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon symbol="📖" label="Student" focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="assign-canon"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon symbol="📜" label="Canon" focused={focused} />
          ),
        }}
      />
    </Tabs>
  );
}

const styles = lazyThemed(() => StyleSheet.create({
  tabBar: {
    backgroundColor: colors.navyDark,
    borderTopWidth: 1,
    borderTopColor: 'rgba(201,168,76,0.3)',
    height: 72,
    paddingBottom: 8,
    paddingTop: 6,
  },
  tabItem: { alignItems: 'center', gap: 3 },
  symbol: { fontSize: 18, color: colors.muted },
  symbolActive: { color: colors.gold },
  label: { fontFamily: fonts.latoLight, fontSize: 9, color: colors.muted, letterSpacing: 0.5, textTransform: 'uppercase' },
  labelActive: { fontFamily: fonts.latoBold, color: colors.goldLight },
}));
