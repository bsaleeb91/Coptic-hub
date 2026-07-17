// app/(servant)/_layout.tsx
// Servant (Sunday-school / youth servant) navigation — the same swipe-from-left
// drawer as the congregant view, replacing the old bottom tab bar. Pull from the
// left edge (or tap ☰ on the Students screen) to open it. Shared drawn-line icons.

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Drawer } from 'expo-router/drawer';
import { DrawerContentScrollView, DrawerItemList } from '@react-navigation/drawer';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, fonts, lazyThemed } from '@/lib/theme';
import { CongregationIcon, PersonIcon, CandleIcon } from '@/components/ui/TabIcons';

function DrawerHeader() {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.brand, { paddingTop: insets.top + 20 }]}>
      <Text style={styles.brandCross}>✝︎</Text>
      <Text style={styles.brandName}>Poimen</Text>
      <Text style={styles.brandSub}>Servant of the class</Text>
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

export default function ServantLayout() {
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
        title: 'Students',
        drawerIcon: ({ color }: IconProps) => <CongregationIcon size={20} color={color} />,
      }} />
      <Drawer.Screen name="student" options={{
        title: 'Student',
        drawerIcon: ({ color }: IconProps) => <PersonIcon size={20} color={color} />,
      }} />
      <Drawer.Screen name="assign-canon" options={{
        title: 'Canon',
        drawerIcon: ({ color }: IconProps) => <CandleIcon size={20} color={color} />,
      }} />
    </Drawer>
  );
}

const styles = lazyThemed(() => StyleSheet.create({
  brand: { alignItems: 'center', paddingBottom: 18, borderBottomWidth: 1, borderBottomColor: colors.border },
  brandCross: { fontSize: 30, color: colors.gold },
  brandName: { fontFamily: fonts.cormorantMedium, fontSize: 24, color: colors.cream, letterSpacing: 2, marginTop: 8 },
  brandSub: { fontFamily: fonts.latoLight, fontSize: 11, color: colors.muted, fontStyle: 'italic', marginTop: 2 },
}));
