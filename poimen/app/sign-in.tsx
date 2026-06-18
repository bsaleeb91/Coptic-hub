import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useSession } from '@/lib/auth';
import { useDemoMode } from '@/lib/demo';
import { colors, fonts } from '@/lib/theme';

type Mode = 'signin' | 'signup' | 'magic';

export default function SignInScreen() {
  const { signInWithEmail, signUpWithEmail, signInWithMagicLink } = useSession();
  const { setDemoMode, setDemoRole } = useDemoMode();
  const router = useRouter();

  const [mode, setMode] = useState<Mode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [loading, setLoading] = useState(false);

  function switchMode(m: Mode) {
    setMode(m);
    setError('');
    setInfo('');
  }

  async function handleSubmit() {
    setError('');
    setInfo('');
    setLoading(true);
    if (mode === 'signin') {
      const { error } = await signInWithEmail(email.trim(), password);
      if (error) setError(error);
    } else if (mode === 'signup') {
      const { error } = await signUpWithEmail(email.trim(), password, fullName.trim());
      if (error) setError(error);
      else setInfo('Check your email to confirm your account, then sign in.');
    } else {
      const { error } = await signInWithMagicLink(email.trim());
      if (error) setError(error);
      else setInfo('A sign-in link was sent to your email.');
    }
    setLoading(false);
  }

  const btnLabel = mode === 'signin' ? 'SIGN IN' : mode === 'signup' ? 'CREATE ACCOUNT' : 'SEND LINK';

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">

          {/* Brand */}
          <View style={styles.brand}>
            <Text style={styles.brandCross}>✝</Text>
            <Text style={styles.brandTitle}>Poimen</Text>
            <Text style={styles.brandSub}>Pastoral care, rooted in Tradition</Text>
          </View>

          {/* Mode heading */}
          <Text style={styles.modeHeading}>
            {mode === 'signin' ? 'Sign in to your account' : mode === 'signup' ? 'Create an account' : 'Sign in with a link'}
          </Text>

          {/* Form */}
          <View style={styles.form}>
            {mode === 'signup' && (
              <TextInput
                style={styles.input}
                placeholder="Full name"
                placeholderTextColor="rgba(245,240,232,0.28)"
                value={fullName}
                onChangeText={setFullName}
                autoCapitalize="words"
              />
            )}

            <TextInput
              style={styles.input}
              placeholder="Email"
              placeholderTextColor="rgba(245,240,232,0.28)"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />

            {mode !== 'magic' && (
              <TextInput
                style={styles.input}
                placeholder="Password"
                placeholderTextColor="rgba(245,240,232,0.28)"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
              />
            )}

            {error ? <Text style={styles.errorText}>{error}</Text> : null}
            {info  ? <Text style={styles.infoText}>{info}</Text>  : null}

            <TouchableOpacity
              style={[styles.submitBtn, loading && { opacity: 0.5 }]}
              onPress={handleSubmit}
              disabled={loading}
            >
              {loading
                ? <ActivityIndicator color={colors.navy} />
                : <Text style={styles.submitBtnText}>{btnLabel}</Text>
              }
            </TouchableOpacity>
          </View>

          {/* Contextual links */}
          <View style={styles.linksRow}>
            {mode === 'signin' && (
              <>
                <TouchableOpacity onPress={() => switchMode('magic')}>
                  <Text style={styles.link}>Use a magic link instead</Text>
                </TouchableOpacity>
                <Text style={styles.linkSep}>·</Text>
                <TouchableOpacity onPress={() => switchMode('signup')}>
                  <Text style={styles.link}>Create an account</Text>
                </TouchableOpacity>
              </>
            )}
            {mode === 'signup' && (
              <TouchableOpacity onPress={() => switchMode('signin')}>
                <Text style={styles.link}>Already have an account? Sign in</Text>
              </TouchableOpacity>
            )}
            {mode === 'magic' && (
              <TouchableOpacity onPress={() => switchMode('signin')}>
                <Text style={styles.link}>Back to password sign in</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Demo divider */}
          <View style={styles.dividerRow}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>EXPLORE WITHOUT ACCOUNT</Text>
            <View style={styles.dividerLine} />
          </View>

          <View style={styles.demoGrid}>
            <TouchableOpacity
              style={[styles.demoBtn, styles.demoBtnCong]}
              onPress={() => { setDemoRole('congregant'); setDemoMode(true); router.replace('/(tabs)'); }}
            >
              <Text style={styles.demoBtnRole}>Congregant</Text>
              <Text style={styles.demoBtnDesc}>My spiritual life</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.demoBtn, styles.demoBtnPriest]}
              onPress={() => { setDemoRole('priest'); setDemoMode(true); router.replace('/(priest)'); }}
            >
              <Text style={styles.demoBtnRole}>Priest</Text>
              <Text style={styles.demoBtnDesc}>FOC pastoral view</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.demoBtn, styles.demoBtnServant]}
              onPress={() => { setDemoRole('servant'); setDemoMode(true); router.replace('/(servant)'); }}
            >
              <Text style={styles.demoBtnRole}>Servant</Text>
              <Text style={styles.demoBtnDesc}>Students + my life</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.footer}>
            A ministry of the Coptic Orthodox Church.{'\n'}All spiritual data is private and protected.
          </Text>

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.navy },
  content: { padding: 28, paddingTop: 52, flexGrow: 1 },

  brand: { alignItems: 'center', marginBottom: 40 },
  brandCross: { fontSize: 30, color: colors.gold, marginBottom: 10, opacity: 0.8 },
  brandTitle: { fontFamily: fonts.cormorantMedium, fontSize: 44, color: colors.cream, letterSpacing: -0.5 },
  brandSub: { fontFamily: fonts.latoLight, fontSize: 12, color: colors.muted, marginTop: 6, textAlign: 'center', letterSpacing: 0.5 },

  modeHeading: { fontFamily: fonts.cormorantItalic, fontSize: 20, color: colors.muted, marginBottom: 20 },

  form: { gap: 12 },
  input: {
    backgroundColor: 'rgba(10,16,30,0.6)',
    borderWidth: 1,
    borderColor: 'rgba(201,168,76,0.18)',
    borderRadius: 10,
    color: colors.cream,
    fontFamily: fonts.latoLight,
    fontSize: 15,
    padding: 15,
  },

  errorText: { fontFamily: fonts.latoLight, fontSize: 12, color: colors.red, textAlign: 'center', lineHeight: 18 },
  infoText:  { fontFamily: fonts.latoLight, fontSize: 12, color: colors.green, textAlign: 'center', lineHeight: 18 },

  submitBtn: { backgroundColor: colors.gold, borderRadius: 10, paddingVertical: 16, alignItems: 'center', marginTop: 4 },
  submitBtnText: { fontFamily: fonts.latoBold, fontSize: 13, color: colors.navy, letterSpacing: 1.2 },

  linksRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 10, marginTop: 16, flexWrap: 'wrap' },
  link: { fontFamily: fonts.latoLight, fontSize: 12, color: colors.muted },
  linkSep: { fontFamily: fonts.latoLight, fontSize: 12, color: 'rgba(245,240,232,0.2)' },

  dividerRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 36, marginBottom: 20 },
  dividerLine: { flex: 1, height: 1, backgroundColor: colors.border },
  dividerText: { fontFamily: fonts.latoBold, fontSize: 8, color: 'rgba(245,240,232,0.25)', letterSpacing: 1.5 },

  demoGrid: { flexDirection: 'row', gap: 8 },
  demoBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingVertical: 14,
    paddingHorizontal: 10,
    alignItems: 'center',
    gap: 4,
  },
  demoBtnCong:    { borderColor: 'rgba(201,168,76,0.25)' },
  demoBtnPriest:  { borderColor: 'rgba(127,196,232,0.3)', backgroundColor: 'rgba(127,196,232,0.05)' },
  demoBtnServant: { borderColor: 'rgba(93,202,135,0.3)',  backgroundColor: 'rgba(93,202,135,0.04)' },
  demoBtnRole: { fontFamily: fonts.cormorantMedium, fontSize: 15, color: colors.cream },
  demoBtnDesc: { fontFamily: fonts.latoLight, fontSize: 10, color: colors.muted, textAlign: 'center' },

  footer: { fontFamily: fonts.latoLight, fontSize: 10, color: 'rgba(245,240,232,0.18)', textAlign: 'center', lineHeight: 17, marginTop: 32 },
});
