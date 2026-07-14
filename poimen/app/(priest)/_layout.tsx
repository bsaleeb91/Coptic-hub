import { Tabs } from 'expo-router';
import { View, Text, StyleSheet } from 'react-native';
import { colors, fonts } from '@/lib/theme';

function TabIcon({ symbol, label, focused }: { symbol: string; label: string; focused: boolean }) {
  return (
    <View style={styles.tabItem}>
      <Text style={[styles.symbol, focused && styles.symbolActive]}>{symbol}</Text>
      <Text style={[styles.label, focused && styles.labelActive]}>{label}</Text>
    </View>
  );
}

export default function PriestLayout() {
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
            <TabIcon symbol="◉" label="Flock" focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="member"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon symbol="◈" label="Member" focused={focused} />
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
      <Tabs.Screen
        name="log-encounter"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon symbol="✝" label="Encounter" focused={focused} />
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: 'rgba(10,16,30,0.97)',
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
});
