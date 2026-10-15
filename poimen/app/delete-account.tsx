// Delete my account. Immediate and final (decided 2026-10-14): the member's
// own data goes; a priest keeps his encounter records and notes about them,
// detached from any account. The copy below says exactly that.
import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useSession } from '@/lib/auth';
import { colors, fonts, lazyThemed } from '@/lib/theme';

export default function DeleteAccountScreen() {
  const router = useRouter();
  const { profile, deleteAccount } = useSession();
  const [typed, setTyped] = useState('');
  const [working, setWorking] = useState(false);
  const [error, setError] = useState('');

  const isShepherd = profile?.role === 'priest' || profile?.role === 'servant' || profile?.role === 'admin';
  const ready = typed.trim().toUpperCase() === 'DELETE';

  async function handleDelete() {
    if (!ready || working) return;
    setWorking(true);
    setError('');
    const { error: err } = await deleteAccount();
    if (err) {
      setError(err);
      setWorking(false);
      return;
    }
    router.replace('/sign-in');
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <TouchableOpacity style={styles.backRow} onPress={() => router.back()} disabled={working}>
            <Text style={styles.backArrow}>‹</Text>
            <Text style={styles.backText}>Profile</Text>
          </TouchableOpacity>

          <Text style={styles.pageTitle}>Delete my account</Text>
          <Text style={styles.body}>
            This permanently deletes your account. It happens immediately and cannot be undone.
          </Text>

          <Text style={styles.heading}>What is deleted</Text>
          <Text style={styles.body}>
            Your profile and photo, your spiritual journal and blessings, prayer requests, your canon
            and its history, spiritual vitals, psalm progress, confession dates, appointments, contact
            and family details, and your encryption key backup. Your confession notes on this phone
            are erased too.
          </Text>

          <Text style={styles.heading}>What is kept</Text>
          <Text style={styles.body}>
            Your Father of Confession keeps his own records of your encounters and his notes about you,
            no longer linked to any account.
          </Text>
          {isShepherd && (
            <Text style={styles.body}>
              As a {profile?.role === 'servant' ? 'servant' : 'priest'}, your private notes are deleted
              and the members linked to you are unlinked. Encounters you logged stay in each member's
              Pastoral Journey, without your name, and any canon you assigned becomes part of their own rule.
            </Text>
          )}

          <Text style={styles.heading}>Confirm</Text>
          <Text style={styles.body}>Type DELETE to confirm.</Text>
          <TextInput
            style={styles.input}
            value={typed}
            onChangeText={t => { setTyped(t); setError(''); }}
            placeholder="DELETE"
            placeholderTextColor={colors.faint}
            autoCapitalize="characters"
            autoCorrect={false}
            editable={!working}
          />
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <TouchableOpacity
            style={[styles.deleteBtn, (!ready || working) && { opacity: 0.4 }]}
            onPress={handleDelete}
            disabled={!ready || working}
          >
            {working
              ? <ActivityIndicator color={colors.cream} />
              : <Text style={styles.deleteText}>DELETE MY ACCOUNT</Text>}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = lazyThemed(() => StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.navy },
  content: { padding: 24, paddingBottom: 60, gap: 10 },
  backRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  backArrow: { fontSize: 24, color: colors.gold, lineHeight: 26 },
  backText: { fontFamily: fonts.latoBold, fontSize: 13, color: colors.gold },
  pageTitle: { fontFamily: fonts.cormorantMedium, fontSize: 28, color: colors.cream, marginBottom: 4 },
  heading: { fontFamily: fonts.latoBold, fontSize: 11, letterSpacing: 1.5, color: colors.gold, marginTop: 12, textTransform: 'uppercase' },
  body: { fontFamily: fonts.latoLight, fontSize: 14, color: colors.muted, lineHeight: 21 },
  input: { backgroundColor: colors.panel, borderWidth: 1, borderColor: colors.border, borderRadius: 10, color: colors.cream, fontFamily: fonts.latoBold, fontSize: 16, padding: 14, letterSpacing: 2 },
  error: { fontFamily: fonts.latoLight, fontSize: 13, color: colors.red },
  deleteBtn: { backgroundColor: colors.red, borderRadius: 10, paddingVertical: 15, alignItems: 'center', marginTop: 8 },
  deleteText: { fontFamily: fonts.latoBold, fontSize: 13, color: colors.cream, letterSpacing: 1 },
}));
