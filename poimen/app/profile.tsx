import React, { useState } from 'react';
import {
  ScrollView, View, Text, StyleSheet, TouchableOpacity,
  TextInput, ActivityIndicator, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useSession } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { colors, fonts } from '@/lib/theme';
import { Card } from '@/components/ui/Card';

export default function ProfileScreen() {
  const router = useRouter();
  const { user, profile, signOut } = useSession();

  const [fullName, setFullName] = useState(profile?.full_name ?? '');
  const [churchName, setChurchName] = useState(profile?.church_name ?? '');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function handleSave() {
    if (!user) return;
    setSaving(true);
    await supabase
      .from('profiles')
      .update({ full_name: fullName.trim(), church_name: churchName.trim(), updated_at: new Date().toISOString() })
      .eq('id', user.id);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  async function handleSignOut() {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: async () => { await signOut(); } },
    ]);
  }

  const initials = (profile?.full_name ?? user?.email ?? '?')
    .split(' ')
    .map(w => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>

        <TouchableOpacity style={styles.backRow} onPress={() => router.back()}>
          <Text style={styles.backArrow}>‹</Text>
          <Text style={styles.backText}>Home</Text>
        </TouchableOpacity>

        {/* Avatar */}
        <View style={styles.avatarSection}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initials}</Text>
          </View>
          <Text style={styles.avatarName}>{profile?.full_name ?? '—'}</Text>
          <Text style={styles.avatarEmail}>{user?.email}</Text>
          <View style={styles.roleBadge}>
            <Text style={styles.roleBadgeText}>{profile?.role ?? 'congregant'}</Text>
          </View>
        </View>

        {/* Edit details */}
        <Card title="Account Details" titleIcon="◈">
          <View style={styles.field}>
            <Text style={styles.label}>Full Name</Text>
            <TextInput
              style={styles.input}
              value={fullName}
              onChangeText={setFullName}
              placeholder="Your name"
              placeholderTextColor="rgba(245,240,232,0.22)"
              autoCapitalize="words"
            />
          </View>
          <View style={styles.field}>
            <Text style={styles.label}>Email</Text>
            <View style={styles.inputReadOnly}>
              <Text style={styles.inputReadOnlyText}>{user?.email}</Text>
            </View>
            <Text style={styles.fieldHint}>Email cannot be changed here. Contact support.</Text>
          </View>
          <View style={styles.field}>
            <Text style={styles.label}>Church</Text>
            <TextInput
              style={styles.input}
              value={churchName}
              onChangeText={setChurchName}
              placeholder="E.g., St. Mary's Coptic Orthodox Church"
              placeholderTextColor="rgba(245,240,232,0.22)"
            />
          </View>

          <TouchableOpacity
            style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
            onPress={handleSave}
            disabled={saving}
          >
            {saving
              ? <ActivityIndicator color={colors.navy} />
              : <Text style={styles.saveBtnText}>{saved ? '✓ SAVED' : 'SAVE CHANGES'}</Text>
            }
          </TouchableOpacity>
        </Card>

        {/* Privacy note */}
        <Card title="Privacy" titleIcon="✦">
          <Text style={styles.privacyText}>
            Your confession notes never leave your device. Journal entries are private unless you choose to share. Prayer requests are visible only as you configure them. Spiritual vitals are shared with your Father of Confession only with your permission.
          </Text>
        </Card>

        {/* Sign out */}
        <TouchableOpacity style={styles.signOutBtn} onPress={handleSignOut}>
          <Text style={styles.signOutText}>Sign Out</Text>
        </TouchableOpacity>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.navy },
  scroll: { flex: 1 },
  content: { padding: 20, paddingBottom: 48 },

  backRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 24 },
  backArrow: { fontFamily: fonts.cormorant, fontSize: 22, color: colors.gold },
  backText: { fontFamily: fonts.latoLight, fontSize: 13, color: colors.muted },

  avatarSection: { alignItems: 'center', marginBottom: 28 },
  avatar: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: colors.goldDim, borderWidth: 2, borderColor: colors.gold,
    alignItems: 'center', justifyContent: 'center', marginBottom: 12,
  },
  avatarText: { fontFamily: fonts.cormorantMedium, fontSize: 28, color: colors.goldLight },
  avatarName: { fontFamily: fonts.cormorantMedium, fontSize: 22, color: colors.cream, marginBottom: 4 },
  avatarEmail: { fontFamily: fonts.latoLight, fontSize: 12, color: colors.muted, marginBottom: 8 },
  roleBadge: { backgroundColor: colors.goldDim, borderWidth: 1, borderColor: colors.border, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 4 },
  roleBadgeText: { fontFamily: fonts.latoBold, fontSize: 9, letterSpacing: 1.5, textTransform: 'uppercase', color: colors.gold },

  field: { gap: 6, marginBottom: 14 },
  label: { fontFamily: fonts.latoBold, fontSize: 10, letterSpacing: 1.5, textTransform: 'uppercase', color: colors.muted },
  input: {
    backgroundColor: 'rgba(10,16,30,0.7)', borderWidth: 1, borderColor: colors.border,
    borderRadius: 8, color: colors.cream, fontFamily: fonts.latoLight, fontSize: 14, padding: 12,
  },
  inputReadOnly: {
    backgroundColor: 'rgba(10,16,30,0.3)', borderWidth: 1, borderColor: 'rgba(201,168,76,0.1)',
    borderRadius: 8, padding: 12,
  },
  inputReadOnlyText: { fontFamily: fonts.latoLight, fontSize: 14, color: 'rgba(245,240,232,0.4)' },
  fieldHint: { fontFamily: fonts.latoLight, fontSize: 10, color: colors.muted, opacity: 0.6 },

  saveBtn: { backgroundColor: colors.gold, borderRadius: 8, paddingVertical: 13, alignItems: 'center', marginTop: 4 },
  saveBtnDisabled: { opacity: 0.5 },
  saveBtnText: { fontFamily: fonts.latoBold, fontSize: 12, color: colors.navy, letterSpacing: 1 },

  privacyText: { fontFamily: fonts.latoLight, fontSize: 12, color: colors.muted, lineHeight: 20 },

  signOutBtn: { borderWidth: 1, borderColor: 'rgba(192,57,43,0.4)', borderRadius: 10, paddingVertical: 14, alignItems: 'center', marginTop: 8 },
  signOutText: { fontFamily: fonts.latoBold, fontSize: 13, color: colors.red, letterSpacing: 0.5 },
});
