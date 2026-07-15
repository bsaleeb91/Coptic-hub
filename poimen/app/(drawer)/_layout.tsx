// Left-drawer navigation for the congregant sections. The bottom tab bar is
// gone: every destination is reached from the ☰ header button or a left-edge
// swipe. Screens render their own page titles, so the header stays blank.
import { View, Text, StyleSheet } from 'react-native';
import { Drawer } from 'expo-router/drawer';
import {
  DrawerContentScrollView,
  DrawerItemList,
} from '@react-navigation/drawer';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, fonts } from '@/lib/theme';

function DrawerBrand() {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.brand, { paddingTop: insets.top + 24 }]}>
      <Text style={styles.brandCross}>✝</Text>
      <Text style={styles.brandName}>Poimen</Text>
      <Text style={styles.brandSub}>the shepherd's companion</Text>
    </View>
  );
}

function CustomDrawerContent(props: any) {
  return (
    <View style={{ flex: 1, backgroundColor: colors.navyDark }}>
      <DrawerBrand />
      <DrawerContentScrollView {...props} contentContainerStyle={{ paddingTop: 8 }}>
        <DrawerItemList {...props} />
      </DrawerContentScrollView>
    </View>
  );
}

function glyph(symbol: string) {
  return ({ color }: { color: string }) => (
    <Text style={{ fontSize: 16, color, width: 22, textAlign: 'center' }}>{symbol}</Text>
  );
}

export default function DrawerLayout() {
  return (
    <Drawer
      drawerContent={CustomDrawerContent}
      screenOptions={{
        headerShown: true,
        headerTitle: '',
        headerStyle: { backgroundColor: colors.navy, shadowColor: 'transparent', elevation: 0 },
        headerTintColor: colors.gold,
        swipeEnabled: true,
        swipeEdgeWidth: 60,
        drawerStyle: { backgroundColor: colors.navyDark, width: 270 },
        drawerActiveTintColor: colors.gold,
        drawerInactiveTintColor: colors.muted,
        drawerActiveBackgroundColor: colors.goldDim,
        drawerLabelStyle: { fontFamily: fonts.latoBold, fontSize: 14, letterSpacing: 0.4 },
      }}
    >
      <Drawer.Screen name="index"      options={{ title: 'Home',       drawerIcon: glyph('◈') }} />
      <Drawer.Screen name="confession" options={{ title: 'Confession', drawerIcon: glyph('✝') }} />
      <Drawer.Screen name="journal"    options={{ title: 'Journal',    drawerIcon: glyph('✦') }} />
      <Drawer.Screen name="prayer"     options={{ title: 'Prayer',     drawerIcon: glyph('◇') }} />
      <Drawer.Screen name="psalms"     options={{ title: 'Psalms',     drawerIcon: glyph('♪') }} />
      <Drawer.Screen name="canon"      options={{ title: 'Canon',      drawerIcon: glyph('📜') }} />
    </Drawer>
  );
}

const styles = StyleSheet.create({
  brand: {
    alignItems: 'center',
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  brandCross: { fontSize: 26, color: colors.gold },
  brandName: {
    fontFamily: fonts.cormorantMedium,
    fontSize: 24,
    color: colors.cream,
    letterSpacing: 3,
    marginTop: 8,
    textTransform: 'uppercase',
  },
  brandSub: {
    fontFamily: fonts.latoLight,
    fontSize: 11,
    color: colors.muted,
    fontStyle: 'italic',
    marginTop: 3,
  },
});
