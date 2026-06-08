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
  const { setDemoMode } = useDemoMode();
  const router = useRouter();

  const [mode, setMode] = useState<Mode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [loading, setLoading] = useState(false);

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
      else setInfo('Check your email — a sign-in link was sent.');
    }

    setLoading(false);
  }

  function handleDemo() {
    setDemoMode(true);
    router.replace('/(tabs)');
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">

          <View style={styles.brand}>
            <Text style={styles.brandCross}>✝</Text>
            <Text style={styles.brandTitle}>Poimen</Text>
            <Text style={styles.brandSub}>Pastoral care, rooted in Tradition</Text>
          </View>

          <View style={styles.modeTabs}>
            {(['signin', 'signup', 'magic'] as Mode[]).map(m => (
              <TouchableOpacity
                key={m}
                style={[styles.modeTab, mode === m && styles.modeTabActive]}
                onPress={() => { setMode(m); setError(''); setInfo(''); }}
              >
                <Text style={[styles.modeTabText, mode === m && styles.modeTabTextActive]}>
                  {m === 'signin' ? 'Sign In' : m === 'signup' ? 'Register' : 'Magic Link'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.form}>
            {mode === 'signup' && (
              <View style={styles.field}>
                <Text style={styles.label}>Full Name</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Your name"
                  placeholderTextColor="rgba(245,240,232,0.22)"
                  value={fullName}
                  onChangeText={setFullName}
                  autoCapitalize="words"
                />
              </View>
            )}

            <View style={styles.field}>
              <Text style={styles.label}>Email</Text>
              <TextInput
                style={styles.input}
                placeholder="you@example.com"
                placeholderTextColor="rgba(245,240,232,0.22)"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>

            {mode !== 'magic' && (
              <View style={styles.field}>
                <Text style={styles.label}>Password</Text>
                <TextInput
                  style={styles.input}
                  placeholder="••••••••"
                  placeholderTextColor="rgba(245,240,232,0.22)"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry
                />
              </View>
            )}

            {error ? <Text style={styles.errorText}>{error}</Text> : null}
            {info ? <Text style={styles.infoText}>{info}</Text> : null}

            <TouchableOpacity
              style={[styles.submitBtn, loading && styles.submitBtnDisabled]}
              onPress={handleSubmit}
              disabled={loading}
            >
              {loading
                ? <ActivityIndicator color={colors.navy} />
                : <Text style={styles.submitBtnText}>
                    {mode === 'signin' ? 'SIGN IN' : mode === 'signup' ? 'CREATE ACCOUNT' : 'SEND LINK'}
                  </Text>
              }
            </TouchableOpacity>

            {mode === 'signin' && (
              <TouchableOpacity onPress={() => setMode('magic')} style={styles.forgotLink}>
                <Text style={styles.forgotLinkText}>Forgot password? Use a magic link instead</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Demo divider */}
          <View style={styles.dividerRow}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>or</Text>
            <View style={styles.dividerLine} />
          </View>

          <TouchableOpacity style={styles.demoBtn} onPress={handleDemo}>
            <Text style={styles.demoBtnText}>EXPLORE DEMO  →</Text>
          </TouchableOpacity>
          <Text style={styles.demoHint}>See the app with sample data — no account needed</Text>

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
  content: { padding: 28, paddingTop: 48, flexGrow: 1 },

  brand: { alignItems: 'center', marginBottom: 36 },
  brandCross: { fontSize: 36, color: colors.gold, marginBottom: 8 },
  brandTitle: { fontFamily: fonts.cormorantMedium, fontSize: 38, color: colors.cream },
  brandSub: { fontFamily: fonts.latoLight, fontSize: 12, color: colors.muted, marginTop: 4, textAlign: 'center' },

  modeTabs: { flexDirection: 'row', backgroundColor: 'rgba(10,16,30,0.6)', borderRadius: 10, padding: 4, marginBottom: 24, gap: 2 },
  modeTab: { flex: 1, paddingVertical: 8, borderRadius: 8, alignItems: 'center' },
  modeTabActive: { backgroundColor: colors.navyMid, borderWidth: 1, borderColor: colors.border },
  modeTabText: { fontFamily: fonts.latoBold, fontSize: 11, letterSpacing: 0.5, textTransform: 'uppercase', color: colors.muted },
  modeTabTextActive: { color: colors.goldLight },

  form: { gap: 16 },
  field: { gap: 6 },
  label: { fontFamily: fonts.latoBold, fontSize: 10, letterSpacing: 1.5, textTransform: 'uppercase', color: colors.muted },
  input: {
    backgroundColor: 'rgba(10,16,30,0.7)', borderWidth: 1, borderColor: colors.border,
    borderRadius: 8, color: colors.cream, fontFamily: fonts.latoLight,
    fontSize: 15, padding: 14,
  },

  errorText: { fontFamily: fonts.latoLight, fontSize: 12, color: colors.red, textAlign: 'center' },
  infoText: { fontFamily: fonts.latoLight, fontSize: 12, color: colors.green, textAlign: 'center', lineHeight: 18 },

  submitBtn: { backgroundColor: colors.gold, borderRadius: 10, paddingVertical: 15, alignItems: 'center', marginTop: 4 },
  submitBtnDisabled: { opacity: 0.5 },
  submitBtnText: { fontFamily: fonts.latoBold, fontSize: 13, color: colors.navy, letterSpacing: 1 },

  forgotLink: { alignItems: 'center', paddingVertical: 4 },
  forgotLinkText: { fontFamily: fonts.latoLight, fontSize: 11, color: colors.muted },

  dividerRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 28, marginBottom: 20 },
  dividerLine: { flex: 1, height: 1, backgroundColor: colors.border },
  dividerText: { fontFamily: fonts.latoLight, fontSize: 11, color: colors.muted },

  demoBtn: { borderWidth: 1, borderColor: 'rgba(201,168,76,0.4)', borderRadius: 10, paddingVertical: 13, alignItems: 'center' },
  demoBtnText: { fontFamily: fonts.latoBold, fontSize: 12, color: colors.goldLight, letterSpacing: 1 },
  demoHint: { fontFamily: fonts.latoLight, fontSize: 10, color: colors.muted, textAlign: 'center', marginTop: 8 },

  footer: { fontFamily: fonts.latoLight, fontSize: 10, color: 'rgba(245,240,232,0.2)', textAlign: 'center', lineHeight: 16, marginTop: 36 },
});
