import { useEffect, useState } from 'react';
import { AppState, Platform } from 'react-native';
import { Redirect, Stack, useSegments, SplashScreen } from 'expo-router';
import { View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import {
  CormorantGaramond_300Light,
  CormorantGaramond_400Regular,
  CormorantGaramond_400Regular_Italic,
  CormorantGaramond_500Medium,
  useFonts as useCormorant,
} from '@expo-google-fonts/cormorant-garamond';
import {
  Lato_300Light,
  Lato_400Regular,
  Lato_700Bold,
  useFonts as useLato,
} from '@expo-google-fonts/lato';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { AuthProvider, useSession } from '@/lib/auth';
import { DemoProvider, useDemoMode } from '@/lib/demo';
import * as db from '@/lib/db';
import { supabase } from '@/lib/supabase';
import { TutorialProvider } from '@/lib/tutorial-context';
import { Modal, Text, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView } from 'react-native';
import { colors, fonts, applyTheme, loadThemeMode, lazyThemed, ThemeMode } from '@/lib/theme';

SplashScreen.preventAutoHideAsync();

if (Platform.OS === 'web' && typeof document !== 'undefined') {
  const s = document.createElement('style');
  s.textContent = '[role="button"],button,a{cursor:pointer!important}';
  document.head.appendChild(s);
}

// ── PIN Modal ─────────────────────────────────────────────────
function PINModal() {
  const { pinAction, completePINSetup, completePINRecovery, startFreshKeypair, skipPINSetup } = useSession();
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [error, setError] = useState('');
  const [working, setWorking] = useState(false);

  const isSetup = pinAction === 'setup';

  async function handleSubmit() {
    setError('');
    if (pin.length < 4) { setError('PIN must be at least 4 characters.'); return; }
    if (isSetup && pin !== confirmPin) { setError('PINs do not match.'); return; }
    setWorking(true);
    if (isSetup) {
      await completePINSetup(pin);
    } else {
      const ok = await completePINRecovery(pin);
      if (!ok) { setError('Incorrect PIN. Try again.'); setWorking(false); return; }
    }
    setPin(''); setConfirmPin(''); setWorking(false);
  }

  async function handleForgotPIN() {
    setWorking(true);
    await startFreshKeypair();
    setPin(''); setConfirmPin(''); setError(''); setWorking(false);
  }

  return (
    <Modal visible={pinAction !== null} transparent animationType="fade">
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={pinStyles.overlay}>
        <View style={pinStyles.card}>
          <Text style={pinStyles.cross}>✝︎</Text>
          <Text style={pinStyles.title}>{isSetup ? 'Set a Recovery PIN' : 'Enter Your Recovery PIN'}</Text>
          <Text style={pinStyles.body}>
            {isSetup
              ? 'If you switch devices, this PIN will restore access to your encrypted prayer data. Keep it somewhere safe.'
              : 'Your prayer encryption key is not on this device. Enter your PIN to restore it.'}
          </Text>
          <TextInput
            style={pinStyles.input}
            placeholder="PIN"
            placeholderTextColor={colors.faint}
            value={pin}
            onChangeText={t => { setPin(t); setError(''); }}
            secureTextEntry
            keyboardType="default"
            autoFocus
          />
          {isSetup && (
            <TextInput
              style={pinStyles.input}
              placeholder="Confirm PIN"
              placeholderTextColor={colors.faint}
              value={confirmPin}
              onChangeText={t => { setConfirmPin(t); setError(''); }}
              secureTextEntry
              keyboardType="default"
            />
          )}
          {error ? <Text style={pinStyles.error}>{error}</Text> : null}
          <TouchableOpacity
            style={[pinStyles.btn, working && { opacity: 0.5 }]}
            onPress={handleSubmit}
            disabled={working}
          >
            <Text style={pinStyles.btnText}>{working ? '…' : isSetup ? 'SAVE PIN' : 'RESTORE'}</Text>
          </TouchableOpacity>
          {isSetup && (
            <TouchableOpacity onPress={skipPINSetup} style={pinStyles.skip}>
              <Text style={pinStyles.skipText}>Skip for now</Text>
            </TouchableOpacity>
          )}
          {!isSetup && (
            <TouchableOpacity onPress={handleForgotPIN} style={pinStyles.skip} disabled={working}>
              <Text style={pinStyles.skipText}>I forgot my PIN — start fresh (old prayer details will be unreadable)</Text>
            </TouchableOpacity>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const pinStyles = lazyThemed(() => StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  card: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 16, padding: 28, width: '100%', maxWidth: 400, alignItems: 'center', gap: 12 },
  cross: { fontSize: 24, color: colors.gold, opacity: 0.8 },
  title: { fontFamily: fonts.cormorantMedium, fontSize: 22, color: colors.cream, textAlign: 'center' },
  body: { fontFamily: fonts.latoLight, fontSize: 12, color: colors.muted, textAlign: 'center', lineHeight: 18 },
  input: { width: '100%', backgroundColor: colors.panel, borderWidth: 1, borderColor: colors.border, borderRadius: 10, color: colors.cream, fontFamily: fonts.latoLight, fontSize: 15, padding: 14 },
  error: { fontFamily: fonts.latoLight, fontSize: 12, color: colors.red, textAlign: 'center' },
  btn: { backgroundColor: colors.gold, borderRadius: 10, paddingVertical: 14, width: '100%', alignItems: 'center' },
  btnText: { fontFamily: fonts.latoBold, fontSize: 13, color: colors.navy, letterSpacing: 1 },
  skip: { marginTop: 4 },
  skipText: { fontFamily: fonts.latoLight, fontSize: 11, color: colors.muted, textAlign: 'center', lineHeight: 16 },
}));

function RootLayoutNav() {
  const { session, loading } = useSession();
  const { demoMode, setDemoMode } = useDemoMode();
  const segments = useSegments();

  // A real session always wins over a lingering demo flag. The sign-in
  // screen's demo cards persist the flag and nothing ever cleared it, so one
  // demo visit left every later authenticated session silently running on
  // demo data and fake saves (e.g. priest encounters that never hit the DB).
  useEffect(() => {
    if (session && demoMode) setDemoMode(false);
  }, [session, demoMode]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        supabase.auth.startAutoRefresh();
      } else {
        supabase.auth.stopAutoRefresh();
      }
    });
    return () => sub.remove();
  }, []);

  useEffect(() => {
    if (session?.user?.id && !demoMode) {
      db.touchLastSeen(session.user.id).catch(() => {});
    }
  }, [session?.user?.id]);

  if (loading && !demoMode) return <View style={{ flex: 1, backgroundColor: colors.navy }} />;

  if (!demoMode && !loading) {
    const onSignIn = segments[0] === 'sign-in';
    if (!session && !onSignIn) return <Redirect href="/sign-in" />;
    if (session && onSignIn) return <Redirect href="/(tabs)" />;
  }

  return (
    <>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="(priest)" />
        <Stack.Screen name="(servant)" />
        <Stack.Screen name="profile" />
        <Stack.Screen name="portals" />
        <Stack.Screen name="admin" />
        <Stack.Screen name="sign-in" />
        <Stack.Screen name="link-to-foc" />
      </Stack>
      {!demoMode && session && <PINModal />}
    </>
  );
}

export default function RootLayout() {
  // The theme must be applied BEFORE any route module loads: screen
  // StyleSheets capture color values when their module first executes, and
  // route modules execute lazily on first render — so gating render here is
  // what makes the palette swap stick app-wide.
  const [themeMode, setThemeMode] = useState<ThemeMode | null>(null);
  useEffect(() => {
    loadThemeMode().then(m => { applyTheme(m); setThemeMode(m); });
  }, []);

  const [cormorantLoaded] = useCormorant({
    CormorantGaramond_300Light,
    CormorantGaramond_400Regular,
    CormorantGaramond_400Regular_Italic,
    CormorantGaramond_500Medium,
  });

  const [latoLoaded] = useLato({
    Lato_300Light,
    Lato_400Regular,
    Lato_700Bold,
  });

  // On web, don't block render waiting for fonts — system fonts are fine as fallback
  const fontsLoaded = Platform.OS === 'web' || (cormorantLoaded && latoLoaded);

  useEffect(() => {
    if (fontsLoaded && themeMode !== null && Platform.OS !== 'web') SplashScreen.hideAsync();
  }, [fontsLoaded, themeMode]);

  if (!fontsLoaded || themeMode === null) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <DemoProvider>
        <AuthProvider>
          <TutorialProvider>
            <RootLayoutNav />
            <StatusBar style={themeMode === 'light' ? 'dark' : 'light'} />
          </TutorialProvider>
        </AuthProvider>
      </DemoProvider>
    </GestureHandlerRootView>
  );
}
