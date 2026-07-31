import React, { useState, useEffect } from 'react';
import {
  ScrollView, View, Text, StyleSheet, TouchableOpacity,
  TextInput, ActivityIndicator, Alert, Platform, Modal, FlatList,
} from 'react-native';
import type { Church } from '@/lib/db';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useSession } from '@/lib/auth';
import { useDemoMode } from '@/lib/demo';
import { Switch } from 'react-native';
import * as db from '@/lib/db';
import { colors, fonts, ThemeMode, loadThemeMode, saveThemeMode , lazyThemed } from '@/lib/theme';
import { Card } from '@/components/ui/Card';
import { Avatar } from '@/components/ui/Avatar';
import { useTutorial } from '@/lib/tutorial-context';
import { confirmDestructive } from '@/lib/confirm';
import { pickPhoto, uploadAvatarImage, removeAvatarImage, selfAvatarPath, cameraAvailable, PhotoSource } from '@/lib/avatar';

const LIFE_STAGES = ['single', 'engaged', 'married', 'widowed', 'divorced'] as const;
type LifeStageType = typeof LIFE_STAGES[number];

interface ChildRow {
  id?: string;
  name: string;
  birth_year: number;
}

export default function ProfileScreen() {
  const router = useRouter();
  const { user, profile, signOut, refreshProfile } = useSession();
  const { demoMode, demoRole, setDemoMode } = useDemoMode();
  const { resetAndStartTutorial } = useTutorial();

  const effectiveRole = demoMode
    ? (demoRole as 'congregant' | 'priest' | 'servant')
    : profile?.role === 'priest' || profile?.role === 'admin' ? 'priest'
    : profile?.role === 'servant' ? 'servant'
    : 'congregant';

  // ── Appearance ─────────────────────────────────────────────
  // Screen styles capture the palette when their module loads, so applying a
  // new theme needs a full JS reload (web: location.reload; native: dev
  // reload — production builds would use expo-updates' reloadAsync).
  const [themeMode, setThemeMode] = useState<ThemeMode>('dark');
  useEffect(() => { loadThemeMode().then(setThemeMode); }, []);

  async function switchTheme(mode: ThemeMode) {
    if (mode === themeMode) return;
    setThemeMode(mode);
    await saveThemeMode(mode);
    if (Platform.OS === 'web') {
      window.location.reload();
      return;
    }
    try {
      const { DevSettings } = require('react-native');
      DevSettings.reload();
    } catch {
      Alert.alert('Theme saved', 'Close and reopen the app to apply the new appearance.');
    }
  }

  // ── FOC name ──────────────────────────────────────────────
  const [focName, setFocName] = useState<string | null>(null);

  useEffect(() => {
    if (profile?.foc_id) {
      db.getProfile(profile.foc_id).then(p => setFocName(p?.full_name ?? null));
    } else {
      setFocName(null);
    }
  }, [profile?.foc_id]);

  // ── Account ───────────────────────────────────────────────
  const [fullName, setFullName] = useState(profile?.full_name ?? '');
  const [churchName, setChurchName] = useState(profile?.church_name ?? '');
  const [churchId, setChurchId] = useState<string | null>(profile?.church_id ?? null);
  const [churches, setChurches] = useState<Church[]>([]);
  const [showChurchPicker, setShowChurchPicker] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [accountError, setAccountError] = useState('');

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
  const [contactError, setContactError] = useState('');

  // ── Family ────────────────────────────────────────────────
  const [lifeStage, setLifeStage] = useState<LifeStageType | null>(null);
  const [spouseName, setSpouseName] = useState('');
  const [children, setChildren] = useState<ChildRow[]>([]);
  const [newChildName, setNewChildName] = useState('');
  const [newChildYear, setNewChildYear] = useState('');
  const [savingFamily, setSavingFamily] = useState(false);
  const [savedFamily, setSavedFamily] = useState(false);
  const [familyError, setFamilyError] = useState('');

  useEffect(() => {
    db.getChurches().then(setChurches);
  }, []);

  useEffect(() => {
    if (user) loadMyInfo();
  }, [user]);

  async function loadMyInfo() {
    const [contact, lifeProfile, childrenData] = await Promise.all([
      db.getContact(user!.id),
      db.getLifeProfile(user!.id),
      db.getChildren(user!.id),
    ]);
    if (contact) {
      const c = contact;
      setPhone(c.phone ?? '');
      setContactEmail(c.email ?? '');
      setAddressLine1(c.address_line1 ?? '');
      setAddressLine2(c.address_line2 ?? '');
      setCity(c.city ?? '');
      setStateVal(c.state ?? '');
      setZip(c.zip ?? '');
    }
    if (lifeProfile) {
      setLifeStage((lifeProfile.life_stage as LifeStageType) ?? null);
      setSpouseName(lifeProfile.spouse_name ?? '');
    }
    if (childrenData) {
      setChildren(childrenData.map(c => ({ id: c.id, name: c.name, birth_year: c.birth_year })));
    }
  }

  async function handleSave() {
    if (!user) return;
    setSaving(true);
    setAccountError('');
    const { error } = await db.updateAccount(user.id, { full_name: fullName.trim(), church_name: churchName.trim(), church_id: churchId });
    setSaving(false);
    if (error) { setAccountError('Failed to save — please try again.'); return; }
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  async function handleSaveContact() {
    if (!user) return;
    setSavingContact(true);
    setContactError('');
    const { error } = await db.upsertContact({
      user_id: user.id,
      phone:         phone.trim()         || null,
      email:         contactEmail.trim()  || null,
      address_line1: addressLine1.trim()  || null,
      address_line2: addressLine2.trim()  || null,
      city:          city.trim()          || null,
      state:         stateVal.trim()      || null,
      zip:           zip.trim()           || null,
      updated_at:    new Date().toISOString(),
    });
    setSavingContact(false);
    if (error) { setContactError('Failed to save — please try again.'); return; }
    setSavedContact(true);
    setTimeout(() => setSavedContact(false), 2000);
  }

  async function handleSaveFamily() {
    if (!user) return;
    setSavingFamily(true);
    setFamilyError('');
    const showSpouse = lifeStage === 'married' || lifeStage === 'engaged';
    const { error: lifeErr } = await db.upsertLifeProfile({
      user_id:     user.id,
      life_stage:  lifeStage ?? null,
      spouse_name: showSpouse ? (spouseName.trim() || null) : null,
      updated_at:  new Date().toISOString(),
    });
    if (lifeErr) { setSavingFamily(false); setFamilyError('Failed to save — please try again.'); return; }
    // Replace children: delete all then re-insert current list
    await db.deleteChildren(user.id);
    if (children.length > 0) {
      const { error: kidsErr } = await db.insertChildren(
        children.map(c => ({
          parent_id:  user!.id,
          name:       c.name,
          birth_year: c.birth_year,
          updated_at: new Date().toISOString(),
        }))
      );
      if (kidsErr) { setSavingFamily(false); setFamilyError('Failed to save children — please try again.'); return; }
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
    if (Platform.OS === 'web') {
      await signOut();
      router.replace('/sign-in');
    } else {
      Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Sign Out', style: 'destructive', onPress: async () => { await signOut(); } },
      ]);
    }
  }

  const initials = (profile?.full_name ?? user?.email ?? '?')
    .split(' ')
    .map(w => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  // ── Profile photo ─────────────────────────────────────────
  const [photoBusy, setPhotoBusy] = useState(false);
  const [photoError, setPhotoError] = useState('');

  async function changePhoto(source: PhotoSource) {
    if (demoMode || !user || photoBusy) return;
    setPhotoError('');
    setPhotoBusy(true);   // before the picker, so a double-tap can't open two
    try {
      const base64 = await pickPhoto(source);
      if (!base64) return;   // denied or cancelled
      const { url, error } = await uploadAvatarImage(selfAvatarPath(user.id), base64);
      if (!url) { setPhotoError(`Couldn't upload: ${error}`); return; }
      const { error: dbErr } = await db.setAvatarUrl(user.id, url);
      if (dbErr) setPhotoError(`Couldn't save: ${dbErr}`);
      await refreshProfile();
    } finally {
      setPhotoBusy(false);
    }
  }

  function removePhoto() {
    if (demoMode || !user) return;
    confirmDestructive('Remove photo', 'Remove your profile picture?', 'Remove', async () => {
      setPhotoBusy(true);
      await removeAvatarImage(selfAvatarPath(user.id));
      await db.setAvatarUrl(user.id, null);
      await refreshProfile();
      setPhotoBusy(false);
    });
  }

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
          <Avatar url={profile?.avatar_url} initials={initials} size={72} style={styles.avatar} textStyle={styles.avatarText} />
          {!demoMode && user && <View style={styles.photoChipRow}>
            {cameraAvailable && (
              <TouchableOpacity style={styles.photoChip} onPress={() => changePhoto('camera')} disabled={photoBusy}>
                <Text style={styles.photoChipText}>◉ Camera</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity style={styles.photoChip} onPress={() => changePhoto('library')} disabled={photoBusy}>
              <Text style={styles.photoChipText}>{profile?.avatar_url ? '▤ Change Photo' : '▤ Add Photo'}</Text>
            </TouchableOpacity>
            {!!profile?.avatar_url && (
              <TouchableOpacity style={styles.photoChip} onPress={removePhoto} disabled={photoBusy}>
                <Text style={[styles.photoChipText, { color: colors.red }]}>✕ Remove</Text>
              </TouchableOpacity>
            )}
          </View>}
          {photoBusy && <ActivityIndicator color={colors.gold} style={{ marginBottom: 6 }} />}
          {!!photoError && <Text style={styles.photoError}>{photoError}</Text>}
          <Text style={styles.avatarName}>{profile?.full_name ?? '—'}</Text>
          <Text style={styles.avatarEmail}>{user?.email}</Text>
          <View style={styles.roleBadge}>
            <Text style={styles.roleBadgeText}>{profile?.role ?? 'congregant'}</Text>
          </View>
          {profile?.requested_role === 'priest' && profile.role === 'congregant' && (
            <View style={styles.pendingBadge}>
              <Text style={styles.pendingBadgeText}>PRIEST VERIFICATION PENDING</Text>
            </View>
          )}
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
              placeholderTextColor={colors.faint}
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
            {churches.length > 0 ? (
              <TouchableOpacity style={styles.churchPicker} onPress={() => setShowChurchPicker(true)}>
                <Text style={churchId ? styles.churchPickerText : styles.churchPickerPlaceholder}>
                  {churchId ? (churches.find(c => c.id === churchId)?.name ?? churchName) : (churchName || 'Select your church…')}
                </Text>
                <Text style={styles.churchPickerChevron}>›</Text>
              </TouchableOpacity>
            ) : (
              <TextInput
                style={styles.input}
                value={churchName}
                onChangeText={setChurchName}
                placeholder="E.g., St. Mary's Coptic Orthodox Church"
                placeholderTextColor={colors.faint}
              />
            )}
          </View>
          {accountError ? <Text style={styles.fieldError}>{accountError}</Text> : null}
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
              placeholderTextColor={colors.faint}
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
              placeholderTextColor={colors.faint}
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
              placeholderTextColor={colors.faint}
            />
            <TextInput
              style={[styles.input, { marginBottom: 8 }]}
              value={addressLine2}
              onChangeText={setAddressLine2}
              placeholder="Apt, suite, etc. (optional)"
              placeholderTextColor={colors.faint}
            />
            <View style={styles.addressRow}>
              <TextInput
                style={[styles.input, { flex: 2 }]}
                value={city}
                onChangeText={setCity}
                placeholder="City"
                placeholderTextColor={colors.faint}
              />
              <TextInput
                style={[styles.input, { flex: 1 }]}
                value={stateVal}
                onChangeText={setStateVal}
                placeholder="ST"
                placeholderTextColor={colors.faint}
                autoCapitalize="characters"
                maxLength={2}
              />
              <TextInput
                style={[styles.input, { flex: 1 }]}
                value={zip}
                onChangeText={setZip}
                placeholder="ZIP"
                placeholderTextColor={colors.faint}
                keyboardType="numeric"
                maxLength={10}
              />
            </View>
          </View>
          {contactError ? <Text style={styles.fieldError}>{contactError}</Text> : null}
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
                placeholderTextColor={colors.faint}
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
                placeholderTextColor={colors.faint}
                autoCapitalize="words"
              />
              <TextInput
                style={[styles.input, { flex: 1 }]}
                value={newChildYear}
                onChangeText={setNewChildYear}
                placeholder="Year"
                placeholderTextColor={colors.faint}
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

          {familyError ? <Text style={styles.fieldError}>{familyError}</Text> : null}
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

        {/* ── Appearance ── */}
        <Card title="Appearance" titleIcon="◐">
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {([
              { mode: 'dark' as ThemeMode, label: 'Dark Mode' },
              { mode: 'light' as ThemeMode, label: 'Light Mode' },
            ]).map(opt => (
              <TouchableOpacity
                key={opt.mode}
                onPress={() => switchTheme(opt.mode)}
                style={{
                  flex: 1, alignItems: 'center', paddingVertical: 13, borderRadius: 10, borderWidth: 1,
                  borderColor: themeMode === opt.mode ? colors.gold : colors.border,
                  backgroundColor: themeMode === opt.mode ? colors.goldDim : 'transparent',
                }}
                activeOpacity={0.8}
              >
                <Text style={{ fontFamily: fonts.latoBold, fontSize: 13, color: themeMode === opt.mode ? colors.goldLight : colors.muted }}>
                  {opt.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <Text style={{ fontFamily: fonts.latoLight, fontSize: 11, color: colors.muted, marginTop: 10, lineHeight: 16 }}>
            Dark mode is Poimen's navy and gold; light mode is a bright Byzantine palette —
            warm parchment, sepia ink, and liturgical crimson. Switching reloads the app.
          </Text>
        </Card>

        {/* ── Privacy ── */}
        <Card title="Privacy" titleIcon="✦">
          <Text style={styles.privacyText}>
            Your confession notes never leave your device. Journal entries are private unless you choose to share. Prayer requests are visible only as you configure them. Spiritual vitals and contact info are shared with your Father of Confession only.
          </Text>
        </Card>

        {/* Invite code — shown to priests and servants */}
        {(profile?.role === 'priest' || profile?.role === 'servant' || profile?.role === 'admin') && profile?.invite_code && (
          <Card title="Your Invite Code" titleIcon="◈">
            <Text style={styles.inviteCodeLabel}>
              Share this code with {profile.role === 'servant' ? 'your students' : 'your congregants'} so they can link to you in their app.
            </Text>
            <View style={styles.inviteCodeBox}>
              <Text style={styles.inviteCode}>{profile.invite_code}</Text>
            </View>
          </Card>
        )}

        {/* FOC linking — shown to congregants */}
        {(profile?.role === 'congregant' || !profile?.role) && (
          <Card title="Father of Confession" titleIcon="✝︎">
            {profile?.foc_id ? (
              <>
                <View style={styles.linkedRow}>
                  <View>
                    <Text style={styles.linkedName}>✓ Linked</Text>
                    {focName ? <Text style={styles.focNameText}>{focName}</Text> : null}
                  </View>
                  <TouchableOpacity onPress={() => router.push({ pathname: '/link-to-foc', params: { type: 'foc' } })}>
                    <Text style={styles.relinkText}>Change</Text>
                  </TouchableOpacity>
                </View>
                <View style={styles.vitalsToggleRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.vitalsToggleLabel}>Share vitals with my FOC</Text>
                    <Text style={styles.vitalsToggleHint}>Allows your priest to see your spiritual vitals</Text>
                  </View>
                  <Switch
                    value={profile?.vitals_consent === true}
                    onValueChange={async (val) => {
                      if (!user) return;
                      await db.setVitalsConsent(user.id, val);
                      await refreshProfile();
                    }}
                    trackColor={{ false: colors.creamDim, true: 'rgba(201,168,76,0.4)' }}
                    thumbColor={profile?.vitals_consent === true ? colors.gold : colors.faint}
                  />
                </View>
              </>
            ) : (
              <TouchableOpacity
                style={styles.linkBtn}
                onPress={() => router.push({ pathname: '/link-to-foc', params: { type: 'foc' } })}
              >
                <Text style={styles.linkBtnText}>LINK TO FATHER OF CONFESSION</Text>
              </TouchableOpacity>
            )}
          </Card>
        )}

        {/* Servant linking — shown to congregants */}
        {(profile?.role === 'congregant' || !profile?.role) && (
          <Card title="Sunday School Servant" titleIcon="◇">
            {profile?.servant_id ? (
              <View style={styles.linkedRow}>
                <Text style={styles.linkedName}>✓ Linked</Text>
                <TouchableOpacity onPress={() => router.push({ pathname: '/link-to-foc', params: { type: 'servant' } })}>
                  <Text style={styles.relinkText}>Change</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity
                style={styles.linkBtn}
                onPress={() => router.push({ pathname: '/link-to-foc', params: { type: 'servant' } })}
              >
                <Text style={styles.linkBtnText}>LINK TO SUNDAY SCHOOL SERVANT</Text>
              </TouchableOpacity>
            )}
          </Card>
        )}

        <TouchableOpacity style={styles.tutorialBtn} onPress={() => resetAndStartTutorial(effectiveRole)}>
          <Text style={styles.tutorialBtnText}>View App Tutorial</Text>
        </TouchableOpacity>

        {/* Demo mode toggle */}
        <View style={styles.demoRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.demoLabel}>Demo Mode</Text>
            <Text style={styles.demoSub}>Shows sample data — no Supabase required</Text>
          </View>
          <Switch
            value={demoMode}
            onValueChange={setDemoMode}
            trackColor={{ false: colors.creamDim, true: 'rgba(201,168,76,0.4)' }}
            thumbColor={demoMode ? colors.gold : colors.faint}
          />
        </View>

        <TouchableOpacity style={styles.signOutBtn} onPress={handleSignOut}>
          <Text style={styles.signOutText}>Sign Out</Text>
        </TouchableOpacity>

      </ScrollView>

      {/* ── Church picker modal ── */}
      <Modal visible={showChurchPicker} transparent animationType="slide">
        <View style={styles.pickerOverlay}>
          <View style={styles.pickerCard}>
            <Text style={styles.pickerTitle}>Select Your Church</Text>
            <FlatList
              data={churches}
              keyExtractor={c => c.id}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[styles.pickerRow, churchId === item.id && styles.pickerRowActive]}
                  onPress={() => {
                    setChurchId(item.id);
                    setChurchName(item.name);
                    setShowChurchPicker(false);
                  }}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.pickerRowName, churchId === item.id && styles.pickerRowNameActive]}>
                      {item.name}
                    </Text>
                    {item.address && <Text style={styles.pickerRowAddress}>{item.address}</Text>}
                  </View>
                  {churchId === item.id && <Text style={styles.pickerCheck}>✓</Text>}
                </TouchableOpacity>
              )}
              ItemSeparatorComponent={() => <View style={styles.pickerDivider} />}
            />
            <TouchableOpacity style={styles.pickerCancel} onPress={() => setShowChurchPicker(false)}>
              <Text style={styles.pickerCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = lazyThemed(() => StyleSheet.create({
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
  photoChipRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8, marginTop: 10, marginBottom: 8 },
  photoChip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 16, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  photoChipText: { fontFamily: fonts.latoBold, fontSize: 11, color: colors.gold },
  photoError: { fontFamily: fonts.latoLight, fontSize: 11, color: colors.red, marginBottom: 6, textAlign: 'center' },
  avatarName: { fontFamily: fonts.cormorantMedium, fontSize: 22, color: colors.cream, marginBottom: 4 },
  avatarEmail: { fontFamily: fonts.latoLight, fontSize: 12, color: colors.muted, marginBottom: 8 },
  roleBadge: {
    backgroundColor: colors.goldDim, borderWidth: 1, borderColor: colors.border,
    borderRadius: 20, paddingHorizontal: 12, paddingVertical: 4,
  },
  roleBadgeText: { fontFamily: fonts.latoBold, fontSize: 9, letterSpacing: 1.5, textTransform: 'uppercase', color: colors.gold },
  pendingBadge: {
    marginTop: 6, borderWidth: 1, borderColor: colors.border, borderRadius: 20,
    paddingHorizontal: 12, paddingVertical: 4, backgroundColor: colors.panel,
  },
  pendingBadgeText: { fontFamily: fonts.latoBold, fontSize: 8, letterSpacing: 1.2, color: colors.muted },

  sectionHint: { fontFamily: fonts.latoLight, fontSize: 11, color: colors.muted, marginBottom: 16, opacity: 0.8 },

  field: { gap: 6, marginBottom: 14 },
  label: { fontFamily: fonts.latoBold, fontSize: 10, letterSpacing: 1.5, textTransform: 'uppercase', color: colors.muted },
  input: {
    backgroundColor: colors.panel, borderWidth: 1, borderColor: colors.border,
    borderRadius: 8, color: colors.cream, fontFamily: fonts.latoLight, fontSize: 14, padding: 12,
  },
  inputReadOnly: {
    backgroundColor: colors.panel, borderWidth: 1, borderColor: 'rgba(201,168,76,0.1)',
    borderRadius: 8, padding: 12,
  },
  inputReadOnlyText: { fontFamily: fonts.latoLight, fontSize: 14, color: colors.faint },
  fieldHint: { fontFamily: fonts.latoLight, fontSize: 10, color: colors.muted, opacity: 0.6 },
  fieldError: { fontFamily: fonts.latoLight, fontSize: 12, color: colors.red, marginBottom: 8 },

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

  tutorialBtn: {
    borderWidth: 1, borderColor: colors.border,
    borderRadius: 10, paddingVertical: 14, alignItems: 'center', marginTop: 8, marginBottom: 8,
  },
  tutorialBtnText: { fontFamily: fonts.latoBold, fontSize: 12, color: colors.muted, letterSpacing: 0.5 },

  demoRow: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: colors.border, borderRadius: 10, paddingHorizontal: 16, paddingVertical: 13, marginTop: 8, marginBottom: 8 },
  demoLabel: { fontFamily: fonts.latoBold, fontSize: 13, color: colors.cream, marginBottom: 2 },
  demoSub: { fontFamily: fonts.latoLight, fontSize: 11, color: colors.muted },

  inviteCodeLabel: { fontFamily: fonts.latoLight, fontSize: 12, color: colors.muted, marginBottom: 14, lineHeight: 18 },
  inviteCodeBox: {
    backgroundColor: colors.panel, borderWidth: 1, borderColor: colors.border,
    borderRadius: 10, paddingVertical: 18, alignItems: 'center',
  },
  inviteCode: { fontFamily: fonts.latoBold, fontSize: 32, color: colors.goldLight, letterSpacing: 10 },

  linkedRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  linkedName: { fontFamily: fonts.latoLight, fontSize: 13, color: colors.green },
  focNameText: { fontFamily: fonts.latoLight, fontSize: 12, color: colors.muted, marginTop: 2 },
  relinkText: { fontFamily: fonts.latoBold, fontSize: 11, color: colors.gold, letterSpacing: 0.5 },

  linkBtn: {
    backgroundColor: colors.goldDim, borderWidth: 1, borderColor: colors.border,
    borderRadius: 10, paddingVertical: 14, alignItems: 'center',
  },
  linkBtnText: { fontFamily: fonts.latoBold, fontSize: 11, color: colors.goldLight, letterSpacing: 1 },

  signOutBtn: {
    borderWidth: 1, borderColor: 'rgba(192,57,43,0.4)',
    borderRadius: 10, paddingVertical: 14, alignItems: 'center', marginTop: 4,
  },
  signOutText: { fontFamily: fonts.latoBold, fontSize: 13, color: colors.red, letterSpacing: 0.5 },

  churchPicker: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.panel, borderWidth: 1, borderColor: colors.border,
    borderRadius: 8, padding: 12,
  },
  churchPickerText: { flex: 1, fontFamily: fonts.latoLight, fontSize: 14, color: colors.cream },
  churchPickerPlaceholder: { flex: 1, fontFamily: fonts.latoLight, fontSize: 14, color: colors.faint },
  churchPickerChevron: { fontFamily: fonts.cormorant, fontSize: 20, color: colors.muted },

  pickerOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  pickerCard: {
    backgroundColor: colors.navyMid, borderTopLeftRadius: 20, borderTopRightRadius: 20,
    borderWidth: 1, borderColor: colors.border, padding: 24, paddingBottom: 40, maxHeight: '70%' as any,
  },
  pickerTitle: { fontFamily: fonts.cormorantMedium, fontSize: 22, color: colors.cream, marginBottom: 16 },
  pickerRow: { paddingVertical: 14, flexDirection: 'row', alignItems: 'center' },
  pickerRowActive: { opacity: 1 },
  pickerRowName: { fontFamily: fonts.latoBold, fontSize: 13, color: colors.cream },
  pickerRowNameActive: { color: colors.goldLight },
  pickerRowAddress: { fontFamily: fonts.latoLight, fontSize: 11, color: colors.muted, marginTop: 2 },
  pickerCheck: { fontFamily: fonts.latoBold, fontSize: 14, color: colors.gold },
  pickerDivider: { height: 1, backgroundColor: colors.border },
  pickerCancel: { marginTop: 16, alignItems: 'center', paddingVertical: 12 },
  pickerCancelText: { fontFamily: fonts.latoBold, fontSize: 12, color: colors.muted, letterSpacing: 0.5 },

  vitalsToggleRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    borderTopWidth: 1, borderTopColor: colors.border, marginTop: 14, paddingTop: 14,
  },
  vitalsToggleLabel: { fontFamily: fonts.latoBold, fontSize: 13, color: colors.cream, marginBottom: 2 },
  vitalsToggleHint: { fontFamily: fonts.latoLight, fontSize: 11, color: colors.muted },
}));
