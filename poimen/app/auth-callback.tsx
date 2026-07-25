import React from 'react';
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { colors, fonts, lazyThemed } from '@/lib/theme';

// Landing route for poimen://auth-callback deep links (magic link + password
// recovery). The tokens ride in the URL fragment and are consumed by the
// Linking handler in lib/auth.tsx, which then navigates onward — this screen
// only exists so the deep link resolves to a real route instead of expo-
// router's Unmatched Route error while that exchange runs. The fallback link
// covers expired/used links, where no session ever arrives.
export default function AuthCallbackScreen() {
  const router = useRouter();
  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.center}>
        <ActivityIndicator color={colors.gold} />
        <Text style={styles.text}>Signing you in…</Text>
        <TouchableOpacity onPress={() => router.replace('/sign-in')} style={styles.fallback}>
          <Text style={styles.fallbackText}>Taking too long? The link may have expired — back to sign in</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = lazyThemed(() => StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.navy },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28, gap: 14 },
  text: { fontFamily: fonts.cormorantMedium, fontSize: 20, color: colors.cream },
  fallback: { marginTop: 24 },
  fallbackText: { fontFamily: fonts.latoLight, fontSize: 12, color: colors.muted, textAlign: 'center', lineHeight: 18 },
}));
