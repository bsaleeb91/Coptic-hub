import React, { useState, useEffect } from 'react';
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

const LIFE_STAGES = ['single', 'engaged', 'married', 'widowed', 'divorced'] as const;
type LifeStageType = typeof LIFE_STAGES[number];

interface ChildRow {
  id?: string;
  name: string;
  birth_year: number;
}

export default function ProfileScreen() {
  const router = useRouter();
  const { user, profile, signOut } = useSession();

  // ── Account ───────────────────────────────────────────────
  const [fullName, setFullName] = useState(profile?.full_name ?? '');
  const [churchName, setChurchName] = useState(profile?.church_name ?? '');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // ── Contact ───────────────────────────────────────────────
  const [phone, setPhone] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [addressLine1, setAddressLine1] = useState('');
  const [addressLine2, setAddressLine2] = useState('');
  const [city, setCity] = useState('');
  const [stateVal, setStateVal] = useState('');
  const [zip, setZip] = useState('');
  const [savingContact, setSavingContact] = useState(false);
  const [savedContact, setSavedContact] = useState(false);

  // ── Family ────────────────────────────────────────────────
  const [lifeStage, setLifeStage] = useState<LifeStageType | null>(null);
  const [spouseName, setSpouseName] = useState('');
  const [children, setChildren] = useState<ChildRow[]>([]);
  const [newChildName, setNewChildName] = useState('');
  const [newChildYear, setNewChildYear] = useState('');
  const [savingFamily, setSavingFamily] = useState(false);
  const [savedFamily, setSavedFamily] = useState(false);

  useEffect(() => {
    if (user) loadMyInfo();
  }, [user]);

  async function loadMyInfo() {
    const [contactRes, profileRes, childrenRes] = await Promise.all([
      supabase.from('pastoral_contacts').select('*').eq('user_id', user!.id).maybeSingle(),
      supabase.from('pastoral_profile').select('*').eq('user_id', user!.id).maybeSingle(),
      supabase.from('pastoral_children').select('*').eq('parent_id', user!.id).order('birth_year', { ascending: true }),
    ]);
    if (contactRes.data) {
      const c = contactRes.data;
      setPhone(c.phone ?? '');
      setContactEmail(c.email ?? '');
      setAddressLine1(c.address_line1 ?? '');
      setAddressLine2(c.address_line2 ?? '');
      setCity(c.city ?? '');
      setStateVal(c.state ?? '');
      setZip(c.zip ?? '');
    }
    if (profileRes.data) {
      setLifeStage((profileRes.data.life_stage as LifeStageType) ?? null);
      setSpouseName(profileRes.data.spouse_name ?? '');
    }
    if (childrenRes.data) {
      setChildren(childrenRes.data.map(c => ({ id: c.id, name: c.name, birth_year: c.birth_year })));
    }
  }

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

  async function handleSaveContact() {
    if (!user) return;
    setSavingContact(true);
    await supabase.from('pastoral_contacts').upsert({
      user_id: user.id,
      phone:         phone.trim()         || null,
      email:         contactEmail.trim()  || null,
      address_line1: addressLine1.trim()  || null,
      address_line2: addressLine2.trim()  || null,
      city:          city.trim()          || null,
      state:         stateVal.trim()      || null,
      zip:           zip.trim()           || null,
      updated_at:    new Date().toISOString(),
    }, { onConflict: 'user_id' });
    setSavingContact(false);
    setSavedContact(true);
    setTimeout(() => setSavedContact(false), 2000);
  }

  async function handleSaveFamily() {
    if (!user) return;
    setSavingFamily(true);
    const showSpouse = lifeStage === 'married' || lifeStage === 'engaged';
    await supabase.from('pastoral_profile').upsert({
      user_id:     user.id,
      life_stage:  lifeStage ?? null,
      spouse_name: showSpouse ? (spouseName.trim() || null) : null,
      updated_at:  new Date().toISOString(),
    }, { onConflict: 'user_id' });
    // Replace children: delete all then re-insert current list
    await supabase.from('pastoral_children').delete().eq('parent_id', user.id);
    if (children.length > 0) {
      await supabase.from('pastoral_children').insert(
        children.map(c => ({
          parent_id:  user!.id,
          name:       c.name,
          birth_year: c.birth_year,
          updated_at: new Date().toISOString(),
        }))
      );
    }
    setSavingFamily(false);
    setSavedFamily(true);
    setTimeout(() => setSavedFamily(false), 2000);
  }

  function handleAddChild() {
    const yr = parseInt(newChildYear, 10);
    const currentYear = new Date().getFullYear();
    if (!newChildName.trim() || isNaN(yr) || yr < 1960 || yr > currentYear) return;
    setChildren(prev => [...prev, { name: newChildName.trim(), birth_year: yr }]);
    setNewChildName('');
    setNewChildYear('');
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

  const showSpouseField = lifeStage === 'married' || lifeStage === 'engaged';
  const currentYear = new Date().getFullYear();
  const canAddChild = newChildName.trim().length > 0 && newChildYear.length === 4;

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <TouchableOpacity style={styles.backRow} onPress={() => router.back()}>
          <Text style={styles.backArrow}>‹</Text>
          <Text style={styles.backText}>Home</Text>
        </TouchableOpacity>

        {/* ── Avatar ── */}
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

        {/* ── Account Details ── */}
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

        {/* ── Contact for Visitation ── */}
        <Card title="Contact for Visitation" titleIcon="◎">
          <Text style={styles.sectionHint}>Shared only with your Father of Confession.</Text>
          <View style={styles.field}>
            <Text style={styles.label}>Phone</Text>
            <TextInput
              style={styles.input}
              value={phone}
              onChangeText={setPhone}
              placeholder="(555) 000-0000"
              placeholderTextColor="rgba(245,240,232,0.22)"
              keyboardType="phone-pad"
            />
          </View>
          <View style={styles.field}>
            <Text style={styles.label}>Contact Email</Text>
            <TextInput
              style={styles.input}
              value={contactEmail}
              onChangeText={setContactEmail}
              placeholder="preferred@email.com"
              placeholderTextColor="rgba(245,240,232,0.22)"
              keyboardType="email-address"
              autoCapitalize="none"
            />
          </View>
          <View style={styles.field}>
            <Text style={styles.label}>Address</Text>
            <TextInput
              style={[styles.input, { marginBottom: 8 }]}
              value={addressLine1}
              onChangeText={setAddressLine1}
              placeholder="Street address"
              placeholderTextColor="rgba(245,240,232,0.22)"
            />
            <TextInput
              style={[styles.input, { marginBottom: 8 }]}
              value={addressLine2}
              onChangeText={setAddressLine2}
              placeholder="Apt, suite, etc. (optional)"
              placeholderTextColor="rgba(245,240,232,0.22)"
            />
            <View style={styles.addressRow}>
              <TextInput
                style={[styles.input, { flex: 2 }]}
                value={city}
                onChangeText={setCity}
                placeholder="City"
                placeholderTextColor="rgba(245,240,232,0.22)"
              />
              <TextInput
                style={[styles.input, { flex: 1 }]}
                value={stateVal}
                onChangeText={setStateVal}
                placeholder="ST"
                placeholderTextColor="rgba(245,240,232,0.22)"
                autoCapitalize="characters"
                maxLength={2}
              />
              <TextInput
                style={[styles.input, { flex: 1 }]}
                value={zip}
                onChangeText={setZip}
                placeholder="ZIP"
                placeholderTextColor="rgba(245,240,232,0.22)"
                keyboardType="numeric"
                maxLength={10}
              />
            </View>
          </View>
          <TouchableOpacity
            style={[styles.saveBtn, savingContact && styles.saveBtnDisabled]}
            onPress={handleSaveContact}
            disabled={savingContact}
          >
            {savingContact
              ? <ActivityIndicator color={colors.navy} />
              : <Text style={styles.saveBtnText}>{savedContact ? '✓ SAVED' : 'SAVE CONTACT'}</Text>
            }
          </TouchableOpacity>
        </Card>

        {/* ── Life Stage & Family ── */}
        <Card title="Life Stage & Family" titleIcon="✦">
          <Text style={styles.sectionHint}>Shared only with your Father of Confession.</Text>

          <Text style={styles.label}>Life Stage</Text>
          <View style={styles.stageRow}>
            {LIFE_STAGES.map(s => (
              <TouchableOpacity
                key={s}
                style={[styles.stagePill, lifeStage === s && styles.stagePillActive]}
                onPress={() => setLifeStage(prev => prev === s ? null : s)}
              >
                <Text style={[styles.stagePillText, lifeStage === s && styles.stagePillTextActive]}>
                  {s.charAt(0).toUpperCase() + s.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {showSpouseField && (
            <View style={[styles.field, { marginTop: 16 }]}>
              <Text style={styles.label}>Spouse's Name</Text>
              <TextInput
                style={styles.input}
                value={spouseName}
                onChangeText={setSpouseName}
                placeholder="Full name"
                placeholderTextColor="rgba(245,240,232,0.22)"
                autoCapitalize="words"
              />
            </View>
          )}

          <View style={[styles.field, { marginTop: 16 }]}>
            <Text style={styles.label}>Children</Text>
            {children.length === 0 ? (
              <Text style={styles.emptyChildText}>No children added yet.</Text>
            ) : (
              children.map((child, i) => (
                <View key={i} style={styles.childRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.childName}>{child.name}</Text>
                    <Text style={styles.childMeta}>b. {child.birth_year} · ~{currentYear - child.birth_year} yrs old</Text>
                  </View>
                  <TouchableOpacity style={styles.childRemoveBtn} onPress={() => setChildren(prev => prev.filter((_, idx) => idx !== i))}>
                    <Text style={styles.childRemoveText}>✕</Text>
                  </TouchableOpacity>
                </View>
              ))
            )}
            <View style={styles.addChildRow}>
              <TextInput
                style={[styles.input, { flex: 2 }]}
                value={newChildName}
                onChangeText={setNewChildName}
                placeholder="Name"
                placeholderTextColor="rgba(245,240,232,0.22)"
                autoCapitalize="words"
              />
              <TextInput
                style={[styles.input, { flex: 1 }]}
                value={newChildYear}
                onChangeText={setNewChildYear}
                placeholder="Year"
                placeholderTextColor="rgba(245,240,232,0.22)"
                keyboardType="numeric"
                maxLength={4}
              />
              <TouchableOpacity
                style={[styles.addChildBtn, !canAddChild && styles.addChildBtnDisabled]}
                onPress={handleAddChild}
                disabled={!canAddChild}
              >
                <Text style={styles.addChildBtnText}>ADD</Text>
              </TouchableOpacity>
            </View>
          </View>

          <TouchableOpacity
            style={[styles.saveBtn, savingFamily && styles.saveBtnDisabled]}
            onPress={handleSaveFamily}
            disabled={savingFamily}
          >
            {savingFamily
              ? <ActivityIndicator color={colors.navy} />
              : <Text style={styles.saveBtnText}>{savedFamily ? '✓ SAVED' : 'SAVE FAMILY'}</Text>
            }
          </TouchableOpacity>
        </Card>

        {/* ── Privacy ── */}
        <Card title="Privacy" titleIcon="✦">
          <Text style={styles.privacyText}>
            Your confession notes never leave your device. Journal entries are private unless you choose to share. Prayer requests are visible only as you configure them. Spiritual vitals and contact info are shared with your Father of Confession only.
          </Text>
        </Card>

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
  roleBadge: {
    backgroundColor: colors.goldDim, borderWidth: 1, borderColor: colors.border,
    borderRadius: 20, paddingHorizontal: 12, paddingVertical: 4,
  },
  roleBadgeText: { fontFamily: fonts.latoBold, fontSize: 9, letterSpacing: 1.5, textTransform: 'uppercase', color: colors.gold },

  sectionHint: { fontFamily: fonts.latoLight, fontSize: 11, color: colors.muted, marginBottom: 16, opacity: 0.8 },

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

  addressRow: { flexDirection: 'row', gap: 8 },

  stageRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  stagePill: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: colors.border },
  stagePillActive: { backgroundColor: colors.goldDim, borderColor: colors.gold },
  stagePillText: { fontFamily: fonts.latoBold, fontSize: 11, letterSpacing: 0.5, color: colors.muted },
  stagePillTextActive: { color: colors.goldLight },

  emptyChildText: { fontFamily: fonts.latoLight, fontSize: 12, color: colors.muted, opacity: 0.6, marginBottom: 8 },
  childRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.border, marginBottom: 4,
  },
  childName: { fontFamily: fonts.latoBold, fontSize: 13, color: colors.cream },
  childMeta: { fontFamily: fonts.latoLight, fontSize: 11, color: colors.muted, marginTop: 2 },
  childRemoveBtn: { padding: 8 },
  childRemoveText: { fontFamily: fonts.latoBold, fontSize: 12, color: colors.red },

  addChildRow: { flexDirection: 'row', gap: 8, alignItems: 'center', marginTop: 10 },
  addChildBtn: { backgroundColor: colors.gold, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 14 },
  addChildBtnDisabled: { opacity: 0.35 },
  addChildBtnText: { fontFamily: fonts.latoBold, fontSize: 11, color: colors.navy, letterSpacing: 0.8 },

  saveBtn: { backgroundColor: colors.gold, borderRadius: 8, paddingVertical: 13, alignItems: 'center', marginTop: 4 },
  saveBtnDisabled: { opacity: 0.5 },
  saveBtnText: { fontFamily: fonts.latoBold, fontSize: 12, color: colors.navy, letterSpacing: 1 },

  privacyText: { fontFamily: fonts.latoLight, fontSize: 12, color: colors.muted, lineHeight: 20 },

  signOutBtn: {
    borderWidth: 1, borderColor: 'rgba(192,57,43,0.4)',
    borderRadius: 10, paddingVertical: 14, alignItems: 'center', marginTop: 8,
  },
  signOutText: { fontFamily: fonts.latoBold, fontSize: 13, color: colors.red, letterSpacing: 0.5 },
});
