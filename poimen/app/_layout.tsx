import { useEffect } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
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

SplashScreen.preventAutoHideAsync();

function RootLayoutNav() {
  const { session, loading } = useSession();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    const onSignIn = segments[0] === 'sign-in';
    if (!session && !onSignIn) {
      router.replace('/sign-in');
    } else if (session && onSignIn) {
      router.replace('/(tabs)');
    }
  }, [session, loading, segments]);

  if (loading) return null;

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="(priest)" />
      <Stack.Screen name="(servant)" />
      <Stack.Screen name="profile" />
      <Stack.Screen name="sign-in" />
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

  const fontsLoaded = cormorantLoaded && latoLoaded;

  useEffect(() => {
    if (fontsLoaded) SplashScreen.hideAsync();
  }, [fontsLoaded]);

  if (!fontsLoaded) return null;

  return (
    <AuthProvider>
      <RootLayoutNav />
      <StatusBar style="light" />
    </AuthProvider>
  );
}
