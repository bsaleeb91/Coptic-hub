// app/(priest)/_layout.tsx
// Priest (Father of Confession) navigation — the same swipe-from-left drawer as
// the congregant view, replacing the old bottom tab bar. Pull from the left edge
// (or tap ☰ on the Flock screen) to open it. Icons are the shared drawn-line set.

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Drawer } from 'expo-router/drawer';
import { DrawerContentScrollView, DrawerItemList } from '@react-navigation/drawer';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, fonts, lazyThemed } from '@/lib/theme';
import { CongregationIcon, PersonIcon, CandleIcon, CrossIcon, CalendarIcon } from '@/components/ui/TabIcons';

function DrawerHeader() {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.brand, { paddingTop: insets.top + 20 }]}>
      <Text style={styles.brandCross}>✝︎</Text>
      <Text style={styles.brandName}>Nepsis</Text>
      <Text style={styles.brandSub}>Father of Confession</Text>
    </View>
  );
}

function CustomDrawerContent(props: any) {
  return (
    <View style={{ flex: 1, backgroundColor: colors.navy }}>
      <DrawerHeader />
      <DrawerContentScrollView {...props} contentContainerStyle={{ paddingTop: 8 }}>
        <DrawerItemList {...props} />
      </DrawerContentScrollView>
    </View>
  );
}

type IconProps = { color: string };

export default function PriestLayout() {
  return (
    <Drawer
      drawerContent={CustomDrawerContent}
      screenOptions={{
        headerShown: false,
        swipeEnabled: true,
        swipeEdgeWidth: 60,
        drawerActiveTintColor: colors.gold,
        drawerInactiveTintColor: colors.muted,
        drawerActiveBackgroundColor: colors.goldDim,
        drawerStyle: { backgroundColor: colors.navy },
        drawerLabelStyle: { fontFamily: fonts.lato, fontSize: 15 },
      }}
    >
      <Drawer.Screen name="index" options={{
        title: 'Flock',
        drawerIcon: ({ color }: IconProps) => <CongregationIcon size={20} color={color} />,
      }} />
      <Drawer.Screen name="schedule" options={{
        title: 'Schedule',
        drawerIcon: ({ color }: IconProps) => <CalendarIcon size={20} color={color} />,
      }} />
      <Drawer.Screen name="member" options={{
        title: 'Member',
        drawerIcon: ({ color }: IconProps) => <PersonIcon size={20} color={color} />,
      }} />
      <Drawer.Screen name="canon-templates" options={{
        title: 'Canon',
        drawerIcon: ({ color }: IconProps) => <CandleIcon size={20} color={color} />,
      }} />
      {/* One member's canon — always opened from their screen with a memberId,
          never from the drawer. Listing it here would give it a second entrance
          that carries whatever member was edited last. */}
      <Drawer.Screen name="assign-canon" options={{
        drawerItemStyle: { display: 'none' },
      }} />
      <Drawer.Screen name="log-encounter" options={{
        title: 'Encounter',
        drawerIcon: ({ color }: IconProps) => <CrossIcon size={20} color={color} />,
      }} />
    </Drawer>
  );
}

const styles = lazyThemed(() => StyleSheet.create({
  brand: { alignItems: 'center', paddingBottom: 18, borderBottomWidth: 1, borderBottomColor: colors.border },
  brandCross: { fontSize: 30, color: colors.gold, marginBottom: 24 },
  brandName: { fontFamily: fonts.cormorantMedium, fontSize: 24, color: colors.cream, letterSpacing: 2 },
  brandSub: { fontFamily: fonts.latoLight, fontSize: 11, color: colors.muted, fontStyle: 'italic', marginTop: 2 },
}));
