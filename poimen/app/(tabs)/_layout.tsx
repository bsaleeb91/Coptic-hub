// app/(tabs)/_layout.tsx
// Congregant navigation — a swipe-from-left drawer (the Nepsis pattern), which
// replaced the bottom tab bar. Pull from the left edge (or tap ☰ on Home) to
// open it. The folder keeps its historical "(tabs)" name so the many
// router.push('/(tabs)/…') references across the app stay valid.

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Drawer } from 'expo-router/drawer';
import { DrawerContentScrollView, DrawerItemList } from '@react-navigation/drawer';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, fonts, lazyThemed } from '@/lib/theme';
import Harp from '@/components/ui/Harp';
import { HouseIcon, NotepadIcon, PrayingHandsIcon, CandleIcon } from '@/components/ui/TabIcons';

function DrawerHeader() {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.brand, { paddingTop: insets.top + 20 }]}>
      <Text style={styles.brandCross}>✝︎</Text>
      <Text style={styles.brandName}>Nepsis</Text>
      <Text style={styles.brandSub}>pastoral care, rooted in Tradition</Text>
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

export default function DrawerLayout() {
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
        title: 'Home',
        drawerIcon: ({ color }: IconProps) => <HouseIcon size={20} color={color} />,
      }} />
      <Drawer.Screen name="confession" options={{
        title: 'Confession',
        drawerIcon: ({ color }: IconProps) => <Text style={{ fontSize: 18, color, width: 20, textAlign: 'center' }}>✝︎</Text>,
      }} />
      <Drawer.Screen name="journal" options={{
        title: 'Journal',
        drawerIcon: ({ color }: IconProps) => <NotepadIcon size={20} color={color} />,
      }} />
      <Drawer.Screen name="prayer" options={{
        title: 'Prayer',
        drawerIcon: ({ color }: IconProps) => <PrayingHandsIcon size={20} color={color} />,
      }} />
      <Drawer.Screen name="psalms" options={{
        title: 'Psalms',
        drawerIcon: ({ color }: IconProps) => <Harp size={20} color={color} />,
      }} />
      <Drawer.Screen name="canon" options={{
        title: 'Canon',
        drawerIcon: ({ color }: IconProps) => <CandleIcon size={20} color={color} />,
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
