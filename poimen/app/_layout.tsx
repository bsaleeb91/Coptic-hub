import { useEffect } from 'react';
import { AppState, Platform } from 'react-native';
import { supabase } from '@/lib/supabase';

if (Platform.OS === 'web' && typeof document !== 'undefined') {
  const s = document.createElement('style');
  s.textContent = '[role="button"],button,a{cursor:pointer!important}';
  document.head.appendChild(s);
}
import { Redirect, Stack, useSegments } from 'expo-router';
import { View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
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
import { AuthProvider, useSession } from '@/lib/auth';
import { DemoProvider, useDemoMode } from '@/lib/demo';
import { TutorialProvider } from '@/lib/tutorial-context';

SplashScreen.preventAutoHideAsync();

function RootLayoutNav() {
  const { session, loading } = useSession();
  const { demoMode } = useDemoMode();
  const segments = useSegments();

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

  if (loading && !demoMode) return <View style={{ flex: 1, backgroundColor: '#0f1f3d' }} />;

  if (!demoMode && !loading) {
    const onSignIn = segments[0] === 'sign-in';
    if (!session && !onSignIn) return <Redirect href="/sign-in" />;
    if (session && onSignIn) return <Redirect href="/(tabs)" />;
  }

  return (
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
  );
}

export default function RootLayout() {
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
    if (fontsLoaded && Platform.OS !== 'web') SplashScreen.hideAsync();
  }, [fontsLoaded]);

  if (!fontsLoaded) return null;

  return (
    <DemoProvider>
      <AuthProvider>
        <TutorialProvider>
          <RootLayoutNav />
          <StatusBar style="light" />
        </TutorialProvider>
      </AuthProvider>
    </DemoProvider>
  );
}
