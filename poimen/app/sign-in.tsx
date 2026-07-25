import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useSession } from '@/lib/auth';
import { useDemoMode } from '@/lib/demo';
import { colors, fonts , lazyThemed } from '@/lib/theme';
import type { SignupRole } from '@/lib/db';
import { EyeIcon, EyeOffIcon } from '@/components/ui/TabIcons';

type Mode = 'signin' | 'signup' | 'magic' | 'reset';

const SIGNUP_ROLES: { key: SignupRole; label: string; desc: string }[] = [
  { key: 'congregant', label: 'Congregant', desc: 'My spiritual life' },
  { key: 'servant',    label: 'Servant',    desc: 'Sunday school service' },
  { key: 'priest',     label: 'Priest',     desc: 'Father of Confession' },
];

export default function SignInScreen() {
  const { signInWithEmail, signUpWithEmail, signInWithMagicLink, resetPassword } = useSession();
  const { setDemoMode, setDemoRole } = useDemoMode();
  const router = useRouter();

  const [mode, setMode] = useState<Mode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [signupRole, setSignupRole] = useState<SignupRole>('congregant');
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  function switchMode(m: Mode) {
    setMode(m);
    setSignupRole('congregant');
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
      else router.replace('/(tabs)');
    } else if (mode === 'signup') {
      const { error } = await signUpWithEmail(email.trim(), password, fullName.trim(), signupRole);
      if (error) setError(error);
      else setInfo(signupRole === 'priest'
        ? 'Check your email to confirm your account, then sign in. Priest access unlocks once the church administration verifies your request.'
        : 'Check your email to confirm your account, then sign in.');
    } else if (mode === 'magic') {
      const { error } = await signInWithMagicLink(email.trim());
      if (error) setError(error);
      else setInfo('A sign-in link was sent to your email.');
    } else {
      const { error } = await resetPassword(email.trim());
      if (error) setError(error);
      else setInfo('A password reset link was sent to your email.');
    }
    setLoading(false);
  }

  const btnLabel = mode === 'signin' ? 'SIGN IN'
    : mode === 'signup' ? 'CREATE ACCOUNT'
    : mode === 'magic' ? 'SEND LINK'
    : 'SEND RESET LINK';

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">

          {/* Brand */}
          <View style={styles.brand}>
            <Text style={styles.brandCross}>✝︎</Text>
            <Text style={styles.brandTitle}>Nepsis</Text>
            <Text style={styles.brandSub}>Pastoral care, rooted in Tradition</Text>
          </View>

          {/* Mode heading */}
          <Text style={styles.modeHeading}>
            {mode === 'signin' ? 'Sign in to your account'
              : mode === 'signup' ? 'Create an account'
              : mode === 'magic' ? 'Sign in with a link'
              : 'Reset your password'}
          </Text>

          {/* Form */}
          <View style={styles.form}>
            {mode === 'signup' && (
              <>
                <View style={styles.roleRow}>
                  {SIGNUP_ROLES.map((r) => (
                    <TouchableOpacity
                      key={r.key}
                      style={[styles.roleBtn, signupRole === r.key && styles.roleBtnActive]}
                      onPress={() => setSignupRole(r.key)}
                    >
                      <Text style={[styles.roleBtnLabel, signupRole === r.key && styles.roleBtnLabelActive]}>{r.label}</Text>
                      <Text style={styles.roleBtnDesc}>{r.desc}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
                {signupRole === 'priest' && (
                  <Text style={styles.roleNote}>
                    Priest accounts are verified by the church administration. Until your request is approved, the account has congregant access.
                  </Text>
                )}
              </>
            )}
            {mode === 'signup' && (
              <TextInput
                style={styles.input}
                placeholder="Full name"
                placeholderTextColor={colors.faint}
                value={fullName}
                onChangeText={setFullName}
                autoCapitalize="words"
              />
            )}

            <TextInput
              style={styles.input}
              placeholder="Email"
              placeholderTextColor={colors.faint}
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />

            {(mode === 'signin' || mode === 'signup') && (
              <View style={styles.passwordRow}>
                <TextInput
                  style={styles.passwordInput}
                  placeholder="Password"
                  placeholderTextColor={colors.faint}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                />
                <TouchableOpacity
                  style={styles.passwordToggle}
                  onPress={() => setShowPassword(s => !s)}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  {showPassword
                    ? <EyeIcon size={18} color={colors.muted} />
                    : <EyeOffIcon size={18} color={colors.muted} />}
                </TouchableOpacity>
              </View>
            )}

            {mode === 'signin' && (
              <TouchableOpacity onPress={() => switchMode('reset')} style={styles.forgotBtn}>
                <Text style={styles.link}>Forgot password?</Text>
              </TouchableOpacity>
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
            {mode === 'reset' && (
              <TouchableOpacity onPress={() => switchMode('signin')}>
                <Text style={styles.link}>Back to sign in</Text>
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

const styles = lazyThemed(() => StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.navy },
  content: { padding: 28, paddingTop: 52, flexGrow: 1 },

  brand: { alignItems: 'center', marginBottom: 40 },
  brandCross: { fontSize: 30, color: colors.gold, marginBottom: 32, opacity: 0.8 },
  brandTitle: { fontFamily: fonts.cormorantMedium, fontSize: 44, color: colors.cream, letterSpacing: -0.5 },
  brandSub: { fontFamily: fonts.latoLight, fontSize: 12, color: colors.muted, marginTop: 6, textAlign: 'center', letterSpacing: 0.5 },

  modeHeading: { fontFamily: fonts.cormorantItalic, fontSize: 20, color: colors.muted, marginBottom: 20 },

  form: { gap: 12 },
  roleRow: { flexDirection: 'row', gap: 8 },
  roleBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 8,
    alignItems: 'center',
    gap: 3,
    backgroundColor: colors.panel,
  },
  roleBtnActive: { borderColor: colors.gold, backgroundColor: 'rgba(201,168,76,0.08)' },
  roleBtnLabel: { fontFamily: fonts.cormorantMedium, fontSize: 15, color: colors.muted },
  roleBtnLabelActive: { color: colors.cream },
  roleBtnDesc: { fontFamily: fonts.latoLight, fontSize: 9, color: colors.faint, textAlign: 'center' },
  roleNote: {
    fontFamily: fonts.latoLight,
    fontSize: 11,
    color: colors.muted,
    lineHeight: 16,
    textAlign: 'center',
    paddingHorizontal: 4,
  },
  input: {
    backgroundColor: colors.panel,
    borderWidth: 1,
    borderColor: 'rgba(201,168,76,0.18)',
    borderRadius: 10,
    color: colors.cream,
    fontFamily: fonts.latoLight,
    fontSize: 15,
    padding: 15,
  },
  passwordRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.panel,
    borderWidth: 1,
    borderColor: 'rgba(201,168,76,0.18)',
    borderRadius: 10,
  },
  passwordInput: {
    flex: 1,
    color: colors.cream,
    fontFamily: fonts.latoLight,
    fontSize: 15,
    padding: 15,
  },
  passwordToggle: { paddingHorizontal: 14 },
  forgotBtn: { alignSelf: 'flex-end' },

  errorText: { fontFamily: fonts.latoLight, fontSize: 12, color: colors.red, textAlign: 'center', lineHeight: 18 },
  infoText:  { fontFamily: fonts.latoLight, fontSize: 12, color: colors.green, textAlign: 'center', lineHeight: 18 },

  submitBtn: { backgroundColor: colors.gold, borderRadius: 10, paddingVertical: 16, alignItems: 'center', marginTop: 4 },
  submitBtnText: { fontFamily: fonts.latoBold, fontSize: 13, color: colors.navy, letterSpacing: 1.2 },

  linksRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 10, marginTop: 16, flexWrap: 'wrap' },
  link: { fontFamily: fonts.latoLight, fontSize: 12, color: colors.muted },
  linkSep: { fontFamily: fonts.latoLight, fontSize: 12, color: colors.faint },

  dividerRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 36, marginBottom: 20 },
  dividerLine: { flex: 1, height: 1, backgroundColor: colors.border },
  dividerText: { fontFamily: fonts.latoBold, fontSize: 8, color: colors.faint, letterSpacing: 1.5 },

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

  footer: { fontFamily: fonts.latoLight, fontSize: 10, color: colors.faint, textAlign: 'center', lineHeight: 17, marginTop: 32 },
}));
