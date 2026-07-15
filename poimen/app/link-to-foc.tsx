import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSession } from '@/lib/auth';
import * as db from '@/lib/db';
import { colors, fonts , lazyThemed } from '@/lib/theme';

type LinkType = 'foc' | 'servant';

export default function LinkToFocScreen() {
  const router = useRouter();
  const { type } = useLocalSearchParams<{ type: LinkType }>();
  const { user, refreshProfile } = useSession();

  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [found, setFound] = useState<{ id: string; full_name: string | null; church_name: string | null } | null>(null);
  const [linked, setLinked] = useState(false);

  const isFOC = type !== 'servant';
  const title = isFOC ? 'Link to Father of Confession' : 'Link to Sunday School Servant';
  const roleLabel = isFOC ? 'priest' : 'servant';
  const expectedRole = isFOC ? ['priest', 'admin'] : ['servant', 'admin'];

  async function handleLookup() {
    if (!code.trim()) return;
    setLoading(true);
    setError('');
    setFound(null);
    const profile = await db.getProfileByInviteCode(code);
    if (!profile) {
      setError('No one found with that code. Check the code and try again.');
    } else if (!expectedRole.includes(profile.role)) {
      setError(`That code belongs to a ${profile.role}, not a ${roleLabel}.`);
    } else {
      setFound(profile);
    }
    setLoading(false);
  }

  async function handleConfirm() {
    if (!found || !user) return;
    setLoading(true);
    const { error: linkError } = isFOC
      ? await db.linkToFOC(user.id, found.id)
      : await db.linkToServant(user.id, found.id);
    if (linkError) {
      setError(linkError);
    } else {
      if (isFOC) {
        const { error: consentError } = await db.setFocConsent(user.id);
        if (consentError) { setError(consentError); setLoading(false); return; }
      }
      await refreshProfile();
      setLinked(true);
    }
    setLoading(false);
  }

  if (linked) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.successContainer}>
          <Text style={styles.successCross}>✝︎</Text>
          <Text style={styles.successTitle}>You're linked!</Text>
          <Text style={styles.successBody}>
            {found?.full_name ?? 'Your leader'} can now see your spiritual profile.
          </Text>
          <TouchableOpacity style={styles.doneBtn} onPress={() => router.replace('/profile')}>
            <Text style={styles.doneBtnText}>DONE</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">

          <TouchableOpacity style={styles.backRow} onPress={() => router.back()}>
            <Text style={styles.backArrow}>‹</Text>
            <Text style={styles.backText}>Profile</Text>
          </TouchableOpacity>

          <Text style={styles.pageTitle}>{title}</Text>
          <Text style={styles.pageSub}>
            Ask your {roleLabel} for their 6-character invite code, then enter it below.
          </Text>

          <View style={styles.inputRow}>
            <TextInput
              style={styles.codeInput}
              value={code}
              onChangeText={t => { setCode(t.toUpperCase()); setError(''); setFound(null); }}
              placeholder="A B C 1 2 3"
              placeholderTextColor={colors.faint}
              autoCapitalize="characters"
              maxLength={6}
              autoCorrect={false}
            />
            <TouchableOpacity
              style={[styles.lookupBtn, (!code.trim() || loading) && styles.btnDisabled]}
              onPress={handleLookup}
              disabled={!code.trim() || loading}
            >
              {loading
                ? <ActivityIndicator color={colors.navy} />
                : <Text style={styles.lookupBtnText}>FIND</Text>
              }
            </TouchableOpacity>
          </View>

          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          {found && (
            <View style={styles.foundCard}>
              <Text style={styles.foundCross}>✝︎</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.foundName}>{found.full_name ?? 'Unknown'}</Text>
                {found.church_name ? <Text style={styles.foundChurch}>{found.church_name}</Text> : null}
              </View>
              <TouchableOpacity
                style={[styles.confirmBtn, loading && styles.btnDisabled]}
                onPress={handleConfirm}
                disabled={loading}
              >
                {loading
                  ? <ActivityIndicator color={colors.navy} />
                  : <Text style={styles.confirmBtnText}>LINK</Text>
                }
              </TouchableOpacity>
            </View>
          )}

          {found && isFOC && (
            <View style={styles.consentNote}>
              <Text style={styles.consentNoteText}>
                By tapping LINK you allow {found.full_name ?? 'your priest'} to view your spiritual vitals, pastoral journey, and contact information. You can unlink at any time from your Profile.
              </Text>
            </View>
          )}

          <View style={styles.hintBox}>
            <Text style={styles.hintText}>
              Your {roleLabel} can find their code in the Profile tab of their Poimen app.
            </Text>
          </View>

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = lazyThemed(() => StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.navy },
  content: { padding: 24, paddingBottom: 48 },

  backRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 24 },
  backArrow: { fontFamily: fonts.cormorant, fontSize: 22, color: colors.gold },
  backText: { fontFamily: fonts.latoLight, fontSize: 13, color: colors.muted },

  pageTitle: { fontFamily: fonts.cormorantMedium, fontSize: 28, color: colors.cream, marginBottom: 8 },
  pageSub: { fontFamily: fonts.latoLight, fontSize: 13, color: colors.muted, lineHeight: 20, marginBottom: 28 },

  inputRow: { flexDirection: 'row', gap: 10, marginBottom: 12 },
  codeInput: {
    flex: 1,
    backgroundColor: colors.panel,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    color: colors.cream,
    fontFamily: fonts.latoBold,
    fontSize: 22,
    padding: 14,
    letterSpacing: 6,
    textAlign: 'center',
  },
  lookupBtn: {
    backgroundColor: colors.gold,
    borderRadius: 10,
    paddingHorizontal: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  lookupBtnText: { fontFamily: fonts.latoBold, fontSize: 12, color: colors.navy, letterSpacing: 1 },
  btnDisabled: { opacity: 0.4 },

  errorText: { fontFamily: fonts.latoLight, fontSize: 12, color: colors.red, marginBottom: 12 },

  foundCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: 'rgba(201,168,76,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(201,168,76,0.3)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  foundCross: { fontSize: 22, color: colors.gold },
  foundName: { fontFamily: fonts.cormorantMedium, fontSize: 18, color: colors.cream },
  foundChurch: { fontFamily: fonts.latoLight, fontSize: 11, color: colors.muted, marginTop: 2 },
  confirmBtn: {
    backgroundColor: colors.gold,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  confirmBtnText: { fontFamily: fonts.latoBold, fontSize: 11, color: colors.navy, letterSpacing: 1 },

  consentNote: {
    backgroundColor: 'rgba(201,168,76,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(201,168,76,0.18)',
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
  },
  consentNoteText: { fontFamily: fonts.latoLight, fontSize: 11, color: colors.muted, lineHeight: 17 },

  hintBox: {
    backgroundColor: colors.creamDim,
    borderRadius: 10,
    padding: 14,
    marginTop: 8,
  },
  hintText: { fontFamily: fonts.latoLight, fontSize: 12, color: colors.muted, lineHeight: 18 },

  successContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
  successCross: { fontSize: 40, color: colors.gold, marginBottom: 16 },
  successTitle: { fontFamily: fonts.cormorantMedium, fontSize: 28, color: colors.cream, marginBottom: 8 },
  successBody: { fontFamily: fonts.latoLight, fontSize: 14, color: colors.muted, textAlign: 'center', lineHeight: 22, marginBottom: 32 },
  doneBtn: { backgroundColor: colors.gold, borderRadius: 10, paddingVertical: 14, paddingHorizontal: 40 },
  doneBtnText: { fontFamily: fonts.latoBold, fontSize: 13, color: colors.navy, letterSpacing: 1.2 },
}));
