import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { colors, fonts, lazyThemed } from '@/lib/theme';

// Safety net for any unmatched URL (bad deep link, stale bookmark on web).
// Without this, expo-router shows its developer-styled "Unmatched Route"
// screen in production.
export default function NotFoundScreen() {
  const router = useRouter();
  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.center}>
        <Text style={styles.cross}>✝︎</Text>
        <Text style={styles.title}>Page not found</Text>
        <Text style={styles.body}>That link doesn't lead anywhere in Nepsis.</Text>
        <TouchableOpacity style={styles.btn} onPress={() => router.replace('/')}>
          <Text style={styles.btnText}>GO HOME</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = lazyThemed(() => StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.navy },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28, gap: 10 },
  cross: { fontSize: 30, color: colors.gold, opacity: 0.8, marginBottom: 8 },
  title: { fontFamily: fonts.cormorantMedium, fontSize: 26, color: colors.cream },
  body: { fontFamily: fonts.latoLight, fontSize: 13, color: colors.muted, textAlign: 'center', marginBottom: 16 },
  btn: { backgroundColor: colors.gold, borderRadius: 10, paddingVertical: 14, paddingHorizontal: 32 },
  btnText: { fontFamily: fonts.latoBold, fontSize: 13, color: colors.navy, letterSpacing: 1 },
}));
