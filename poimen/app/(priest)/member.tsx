import React, { useState, useEffect, useCallback } from 'react';
import {
  ScrollView, View, Text, StyleSheet, TouchableOpacity,
  TextInput, ActivityIndicator, Alert, Modal, Linking, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { colors, fonts } from '@/lib/theme';
import { Card } from '@/components/ui/Card';
import { PsalmStatsCard, DEMO_PSALM_STATS } from '@/components/ui/PsalmStatsCard';
import type { PsalmStatsSnapshot } from '@/lib/psalms/stats';
import { useSession } from '@/lib/auth';
import * as db from '@/lib/db';
import { useDemoMode } from '@/lib/demo';
import { decryptFromSender } from '@/lib/crypto';

// ── Demo data ─────────────────────────────────────────────────
const DEMO_DB: Record<string, {
  member: any; contact: any; life: any; children: any[];
  vitals: any[]; confessions: any[]; prayer: any[]; canons: any[]; note: string;
}> = {
  'demo-mh': {
    member: { initials: 'MH', name: 'Michael Hanna', stage: 'Growing', joined: 'September 2024', daysSince: 47, flagged: false, flagNote: '' },
    contact: { phone: '(614) 555-0214', email: 'mhanna@example.com', address_line1: '1190 Oak Hill Rd', address_line2: null, city: 'Columbus', state: 'OH', zip: '43235', country: 'US' },
    life: { life_stage: 'married', spouse_name: 'Nadia Hanna' },
    children: [{ id: 'dc1', name: 'Kyrillos', birth_year: 2024 }],
    vitals: [{ label: 'Daily Prayer', pct: 75, shared: true }, { label: 'Scripture Reading', pct: 50, shared: true }, { label: 'Divine Liturgy', pct: 80, shared: true }, { label: 'Small Group', pct: 100, shared: true }, { label: 'Service', pct: 25, shared: false }],
    confessions: [{ date: 'APR 20, 2026', type: 'Holy Confession', note: 'Discussed new-father anxieties. Encouraged daily Agpeya.' }, { date: 'FEB 5, 2026', type: 'Holy Confession', note: 'Pre-birth spiritual preparation.' }],
    prayer: [{ date: 'MAY 4, 2026', topic: 'Gratitude for new baby — prayers of thanksgiving' }, { date: 'MAR 10, 2026', topic: 'Wisdom as a new father' }],
    canons: [{ id: 'c1', component: 'Morning Agpeya', frequency: 'Daily', startDate: 'Apr 21, 2026', pct: 75 }, { id: 'c2', component: 'Psalm reading (1 chapter)', frequency: 'Daily', startDate: 'Apr 21, 2026', pct: 50 }],
    note: 'Growing well since the birth of Kyrillos. Pastoral visit May 4 was fruitful. Follow up on consistent Agpeya practice — suggested praying together as a couple after the baby sleeps.',
  },
  'demo-sg': {
    member: { initials: 'SG', name: 'Sara Girgis', stage: 'Mature', joined: 'March 2021', daysSince: 18, flagged: false, flagNote: '' },
    contact: { phone: '(614) 555-0339', email: 'sgirgis@example.com', address_line1: '408 Granville St', address_line2: null, city: 'Columbus', state: 'OH', zip: '43215', country: 'US' },
    life: { life_stage: 'single', spouse_name: '' },
    children: [],
    vitals: [{ label: 'Daily Prayer', pct: 90, shared: true }, { label: 'Scripture Reading', pct: 85, shared: true }, { label: 'Divine Liturgy', pct: 100, shared: true }, { label: 'Small Group', pct: 75, shared: true }, { label: 'Service', pct: 100, shared: true }],
    confessions: [{ date: 'MAY 21, 2026', type: 'Holy Confession', note: 'Discussed vocation discernment. Encouraged continued prayer and patience.' }, { date: 'MAR 3, 2026', type: 'Holy Confession', note: 'Lenten preparation.' }, { date: 'JAN 8, 2026', type: 'Holy Confession', note: 'Start-of-year spiritual plan.' }],
    prayer: [{ date: 'MAY 20, 2026', topic: 'Discernment of vocation — monastery vs. marriage' }],
    canons: [{ id: 'c1', component: 'Complete Agpeya (all 7 hours)', frequency: 'Daily', startDate: 'Jan 9, 2026', pct: 88 }, { id: 'c2', component: 'Bible reading (2 chapters)', frequency: 'Daily', startDate: 'Jan 9, 2026', pct: 85 }],
    note: 'Spiritually mature and consistent. Currently in a season of vocational discernment. Needs gentle guidance, not pressure. Recommend reading Fr. Matta El-Meskeen on the monastic call.',
  },
  'demo-pb': {
    member: { initials: 'PB', name: 'Peter Botros', stage: 'New', joined: 'February 2026', daysSince: 74, flagged: true, flagNote: 'Missed two follow-up appointments.' },
    contact: { phone: '(614) 555-0182', email: 'pbotros@example.com', address_line1: '2847 Riverside Dr', address_line2: null, city: 'Columbus', state: 'OH', zip: '43221', country: 'US' },
    life: { life_stage: 'married', spouse_name: 'Maria Botros' },
    children: [{ id: 'dc1', name: 'Anthony', birth_year: 2018 }, { id: 'dc2', name: 'Mary', birth_year: 2021 }],
    vitals: [{ label: 'Daily Prayer', pct: 20, shared: true }, { label: 'Scripture Reading', pct: 30, shared: true }, { label: 'Divine Liturgy', pct: 45, shared: true }, { label: 'Small Group', pct: 0, shared: false }, { label: 'Service', pct: 0, shared: false }],
    confessions: [{ date: 'FEB 25, 2026', type: 'Holy Confession', note: 'Set spiritual goals.' }, { date: 'FEB 11, 2026', type: 'Introductory Meeting', note: 'Getting to know one another.' }],
    prayer: [{ date: 'MAY 28, 2026', topic: 'Job transition — feeling lost' }, { date: 'MAY 5, 2026', topic: 'Family reconciliation with brother' }],
    canons: [{ id: 'c1', component: 'Morning Agpeya', frequency: 'Daily', startDate: 'Mar 1, 2026', pct: 20 }, { id: 'c2', component: 'Gospel Reading (1 chapter)', frequency: 'Daily', startDate: 'Mar 1, 2026', pct: 30 }],
    note: 'Needs consistent follow-up. Has expressed interest in deepening faith but struggles with consistency. Suggested accountability partner from the young adult group.',
  },
  'demo-mm': {
    member: { initials: 'MM', name: 'Mary Mikhail', stage: 'Growing', joined: 'June 2023', daysSince: 29, flagged: false, flagNote: '' },
    contact: { phone: '(614) 555-0471', email: 'mmkhail@example.com', address_line1: '93 Olentangy Blvd', address_line2: 'Apt 4B', city: 'Columbus', state: 'OH', zip: '43202', country: 'US' },
    life: { life_stage: 'married', spouse_name: 'Fady Mikhail' },
    children: [{ id: 'dc1', name: 'Bishoy', birth_year: 2020 }, { id: 'dc2', name: 'Irene', birth_year: 2023 }],
    vitals: [{ label: 'Daily Prayer', pct: 65, shared: true }, { label: 'Scripture Reading', pct: 60, shared: true }, { label: 'Divine Liturgy', pct: 75, shared: true }, { label: 'Small Group', pct: 50, shared: true }, { label: 'Service', pct: 50, shared: true }],
    confessions: [{ date: 'MAY 10, 2026', type: 'Holy Confession', note: 'Marriage enrichment focus. Prayed together with Fady.' }, { date: 'FEB 28, 2026', type: 'Holy Confession', note: 'Lenten preparation. Addressed anxiety about second child.' }],
    prayer: [{ date: 'APR 30, 2026', topic: 'Peace in marriage — communication difficulties' }, { date: 'MAR 15, 2026', topic: 'Healing for mother-in-law' }],
    canons: [{ id: 'c1', component: 'Evening Prayer (Compline)', frequency: 'Daily', startDate: 'Mar 1, 2026', pct: 65 }, { id: 'c2', component: 'Bible reading (1 chapter)', frequency: 'Daily', startDate: 'Mar 1, 2026', pct: 60 }],
    note: 'Consistent growth. Fady and Mary attend together which is encouraging. Consider inviting them to lead a young couples\' small group — they have the maturity for it.',
  },
  'demo-ag': {
    member: { initials: 'AG', name: 'Andrew George', stage: 'Seeking', joined: 'January 2026', daysSince: 92, flagged: true, flagNote: 'New to the church — needs initial meeting.' },
    contact: { phone: '(614) 555-0598', email: 'ageorge@example.com', address_line1: '5120 Kenny Rd', address_line2: null, city: 'Columbus', state: 'OH', zip: '43220', country: 'US' },
    life: { life_stage: 'single', spouse_name: '' },
    children: [],
    vitals: [{ label: 'Daily Prayer', pct: 0, shared: false }, { label: 'Scripture Reading', pct: 0, shared: false }, { label: 'Divine Liturgy', pct: 25, shared: true }, { label: 'Small Group', pct: 0, shared: false }, { label: 'Service', pct: 0, shared: false }],
    confessions: [],
    prayer: [{ date: 'MAY 1, 2026', topic: 'Searching for meaning — career feels empty' }],
    canons: [],
    note: 'Has not had a first confession yet. Moved from Chicago in January. Attends Sunday Liturgy irregularly. Needs a warm personal invitation — try a phone call this week before Sunday.',
  },
  'demo-cn': {
    member: { initials: 'CN', name: 'Christine Naguib', stage: 'Multiplying', joined: 'April 2019', daysSince: 35, flagged: false, flagNote: '' },
    contact: { phone: '(614) 555-0623', email: 'cnaguib@example.com', address_line1: '711 Worthington Ave', address_line2: null, city: 'Columbus', state: 'OH', zip: '43085', country: 'US' },
    life: { life_stage: 'married', spouse_name: 'Mina Naguib' },
    children: [{ id: 'dc1', name: 'Verena', birth_year: 2017 }, { id: 'dc2', name: 'Mark', birth_year: 2019 }, { id: 'dc3', name: 'Irini', birth_year: 2022 }],
    vitals: [{ label: 'Daily Prayer', pct: 95, shared: true }, { label: 'Scripture Reading', pct: 90, shared: true }, { label: 'Divine Liturgy', pct: 100, shared: true }, { label: 'Small Group', pct: 75, shared: true }, { label: 'Service', pct: 100, shared: true }],
    confessions: [{ date: 'MAY 5, 2026', type: 'Holy Confession', note: 'Strong spiritually. Discussed leading the women\'s Bible study.' }, { date: 'FEB 20, 2026', type: 'Holy Confession', note: 'Lenten reflection — themes of gratitude and service.' }, { date: 'NOV 10, 2025', type: 'Holy Confession', note: 'Pre-Advent preparation.' }],
    prayer: [{ date: 'APR 25, 2026', topic: 'Guidance for Verena\'s school transition' }],
    canons: [{ id: 'c1', component: 'Midnight Praise (Tasbeha)', frequency: 'Weekly', startDate: 'Jan 1, 2026', pct: 92 }, { id: 'c2', component: 'Bible reading (3 chapters)', frequency: 'Daily', startDate: 'Jan 1, 2026', pct: 90 }],
    note: 'One of the strongest members of the flock. Mentoring two younger women. Consider formally appointing her to lead the women\'s spiritual development group.',
  },
};

function getDemoData(id: string) {
  return DEMO_DB[id] ?? DEMO_DB['demo-pb'];
}

type TabType = 'overview' | 'canon' | 'prayer' | 'notes';
const TABS: { value: TabType; label: string }[] = [
  { value: 'overview', label: 'Overview' },
  { value: 'canon', label: 'Canon' },
  { value: 'prayer', label: 'Prayer' },
  { value: 'notes', label: 'Notes' },
];

// ── Helpers ───────────────────────────────────────────────────
function initials(name: string | null | undefined): string {
  if (!name) return '?';
  const parts = name.split(' ');
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase();
}

function formatLifeStageLine(ls: any, kids: any[]): string | null {
  if (!ls?.life_stage) return null;
  const stage = ls.life_stage.charAt(0).toUpperCase() + ls.life_stage.slice(1);
  const yr = new Date().getFullYear();
  const parts: string[] = [stage];
  if (kids.length > 0) {
    const ages = kids.map((k: any) => `~${yr - k.birth_year}`).join(', ');
    parts.push(`${kids.length} ${kids.length === 1 ? 'child' : 'children'} (${ages})`);
  }
  return parts.join(' · ');
}

export default function MemberScreen() {
  const router = useRouter();
  const { id: memberId, name: memberName } = useLocalSearchParams<{ id: string; name: string }>();
  const { user } = useSession();
  const { demoMode } = useDemoMode();
  const [tab, setTab] = useState<TabType>('overview');
  const [loading, setLoading] = useState(!demoMode);

  const demo = getDemoData(memberId ?? '');

  // Display data
  const [memberInfo, setMemberInfo] = useState<any>(demo.member);
  const [contact, setContact] = useState<any>(demoMode ? demo.contact : null);
  const [lifeStageData, setLifeStageData] = useState<any>(demoMode ? demo.life : null);
  const [memberChildren, setMemberChildren] = useState<any[]>(demoMode ? demo.children : []);
  const [vitals, setVitals] = useState<any[]>(demo.vitals);
  const [psalmStats, setPsalmStats] = useState<PsalmStatsSnapshot | null>(demoMode ? DEMO_PSALM_STATS : null);
  const [confessions, setConfessions] = useState<any[]>(demo.confessions);
  const [prayerRequests, setPrayerRequests] = useState<any[]>(demo.prayer);
  const [canons, setCanons] = useState<any[]>(demo.canons);

  // Notes state
  const [notes, setNotes] = useState<db.PastoralNote[]>(
    demo.note ? [{ id: 'demo-note-1', author_id: 'demo-priest', member_id: memberId ?? '', body: demo.note, created_at: new Date(Date.now() - 86400000 * 10).toISOString(), updated_at: new Date(Date.now() - 86400000 * 10).toISOString() }] : []
  );
  const [newNoteText, setNewNoteText] = useState('');
  const [addingNote, setAddingNote] = useState(false);
  const [addNoteError, setAddNoteError] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);
  const [editError, setEditError] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [noteError, setNoteError] = useState('');

  // Contact sheet
  const [showContactSheet, setShowContactSheet] = useState(false);

  useFocusEffect(
    useCallback(() => {
      if (demoMode) {
        const d = getDemoData(memberId ?? '');
        setMemberInfo(d.member);
        setContact(d.contact);
        setLifeStageData(d.life);
        setMemberChildren(d.children);
        setVitals(d.vitals);
        setPsalmStats(DEMO_PSALM_STATS);
        setConfessions(d.confessions);
        setPrayerRequests(d.prayer);
        setCanons(d.canons);
        setNotes(d.note ? [{ id: 'demo-note-1', author_id: 'demo-priest', member_id: memberId ?? '', body: d.note, created_at: new Date(Date.now() - 86400000 * 10).toISOString(), updated_at: new Date(Date.now() - 86400000 * 10).toISOString() }] : []);
      } else if (memberId) {
        loadMemberData();
      }
    }, [memberId, demoMode])
  );

  async function loadMemberData() {
    if (!user || !memberId) return;
    setLoading(true);

    const [profileData, vitalsPayload, psalmPayload, confData, prayerData, canonData, notesData, contactData, lifeData, kidsData] =
      await Promise.all([
        db.getMemberProfile(memberId),
        db.getAgentProgress(memberId, 'vitals'),
        db.getAgentProgress(memberId, 'psalm-stats'),
        db.getConfessionsForCongregant(memberId),
        db.getFocPrayerRequests(memberId),
        db.getMemberActiveCanons(memberId),
        db.getPastoralNotes(user.id, memberId),
        db.getContact(memberId),
        db.getLifeProfile(memberId),
        db.getChildren(memberId),
      ]);

    if (profileData) {
      const p = profileData;
      const joined = new Date(p.created_at).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
      const lastConf = confData?.[0];
      const daysSince = lastConf ? Math.floor((Date.now() - new Date(lastConf.encountered_at).getTime()) / 86400000) : null;
      setMemberInfo({ initials: initials(memberName ?? p.full_name), name: memberName ?? p.full_name, stage: '', joined, daysSince, flagged: false, flagNote: '' });
    }

    if (vitalsPayload) {
      const v = vitalsPayload as any;
      setVitals([
        { label: 'Daily Prayer', pct: v.prayer ?? 0, shared: true },
        { label: 'Scripture Reading', pct: v.scripture ?? 0, shared: true },
        { label: 'Divine Liturgy', pct: v.liturgy ?? 0, shared: true },
        { label: 'Fasting', pct: v.fasting ?? 0, shared: true },
        { label: 'Service', pct: v.service ?? 0, shared: true },
      ]);
    } else if (!demoMode) {
      setVitals([]);
    }

    setPsalmStats((psalmPayload as PsalmStatsSnapshot | null) ?? null);

    if (confData) {
      setConfessions(confData.map(c => ({
        date: new Date(c.encountered_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).toUpperCase(),
        type: 'Holy Confession',
        note: c.member_note ?? '',
      })));
    }

    if (prayerData) {
      const senderPubKey = await db.getPublicKey(memberId);
      const decryptedPrayers = await Promise.all(prayerData.map(async p => ({
        date: new Date(p.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).toUpperCase(),
        topic: p.category,
        body: (p.body_foc && senderPubKey) ? await decryptFromSender(p.body_foc, senderPubKey) : null,
      })));
      setPrayerRequests(decryptedPrayers);
    }

    if (canonData) {
      setCanons(canonData.map(c => ({ id: c.id, component: c.component, frequency: c.frequency, startDate: c.start_date, pct: 0, selfAdded: c.priest_id == null })));
    }

    setNotes(notesData);

    if (contactData) setContact(contactData);
    if (lifeData) setLifeStageData(lifeData);
    if (kidsData) setMemberChildren(kidsData);

    setLoading(false);
  }

  async function handleAddNote() {
    if (!newNoteText.trim()) return;
    if (demoMode) {
      const n: db.PastoralNote = { id: `demo-${Date.now()}`, author_id: 'demo-priest', member_id: memberId ?? '', body: newNoteText.trim(), created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
      setNotes(prev => [n, ...prev]);
      setNewNoteText('');
      return;
    }
    setAddingNote(true);
    setAddNoteError('');
    const { data, error } = await db.insertPastoralNote(user!.id, memberId!, newNoteText.trim());
    setAddingNote(false);
    if (error || !data) { setAddNoteError('Failed to save — please try again.'); return; }
    setNotes(prev => [data, ...prev]);
    setNewNoteText('');
  }

  function handleStartEdit(note: db.PastoralNote) {
    setEditingId(note.id);
    setEditText(note.body);
    setEditError('');
  }

  async function handleSaveEdit() {
    if (!editingId || !editText.trim()) return;
    if (demoMode) {
      setNotes(prev => prev.map(n => n.id === editingId ? { ...n, body: editText.trim(), updated_at: new Date().toISOString() } : n));
      setEditingId(null);
      return;
    }
    setSavingEdit(true);
    setEditError('');
    const { error } = await db.updatePastoralNote(editingId, editText.trim());
    setSavingEdit(false);
    if (error) { setEditError('Failed to save — please try again.'); return; }
    setNotes(prev => prev.map(n => n.id === editingId ? { ...n, body: editText.trim(), updated_at: new Date().toISOString() } : n));
    setEditingId(null);
  }

  async function handleDeleteNote(noteId: string) {
    if (demoMode) { setNotes(prev => prev.filter(n => n.id !== noteId)); return; }
    setDeletingId(noteId);
    await db.deletePastoralNote(noteId);
    setNotes(prev => prev.filter(n => n.id !== noteId));
    setDeletingId(null);
  }

  function openMaps() {
    if (!contact?.address_line1) return;
    const parts = [contact.address_line1, contact.address_line2, contact.city, contact.state, contact.zip].filter(Boolean);
    const encoded = encodeURIComponent(parts.join(', '));
    const url = Platform.OS === 'ios' ? `maps:?q=${encoded}` : `geo:0,0?q=${encoded}`;
    Linking.openURL(url);
  }

  const daysSince = memberInfo?.daysSince;
  const sinceTxt = daysSince !== null && daysSince !== undefined ? `${daysSince}d` : '—';
  const sinceColor = daysSince === null || daysSince === undefined ? colors.muted : daysSince < 30 ? colors.green : daysSince < 60 ? colors.yellow : colors.red;
  const lifeStageDisplay = formatLifeStageLine(lifeStageData, memberChildren);

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>

        <TouchableOpacity style={styles.backRow} onPress={() => router.push('/(priest)')}>
          <Text style={styles.backArrow}>‹</Text>
          <Text style={styles.backText}>My Flock</Text>
        </TouchableOpacity>

        {loading ? (
          <ActivityIndicator color={colors.gold} style={{ paddingTop: 40 }} />
        ) : (
          <>
            {/* ── Hero card ── */}
            <View style={styles.heroCard}>
              <View style={[styles.heroAvatar, memberInfo?.flagged && styles.heroAvatarFlagged]}>
                <Text style={styles.heroAvatarText}>{memberInfo?.initials ?? '?'}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.heroName}>{memberInfo?.name ?? memberName ?? 'Member'}</Text>
                <Text style={styles.heroMeta}>
                  {memberInfo?.stage ? `Stage: ${memberInfo.stage} · ` : ''}
                  {memberInfo?.joined ? `Joined ${memberInfo.joined}` : ''}
                </Text>
                {lifeStageDisplay ? (
                  <Text style={styles.heroLifeStage}>{lifeStageDisplay}</Text>
                ) : null}
                {memberInfo?.flagged && (
                  <View style={styles.flagBadge}>
                    <Text style={styles.flagBadgeText}>⚑ {memberInfo.flagNote}</Text>
                  </View>
                )}
              </View>
            </View>

            {/* ── Stats strip ── */}
            <View style={styles.statStrip}>
              <View style={styles.statItem}>
                <Text style={[styles.statVal, { color: sinceColor }]}>{sinceTxt}</Text>
                <Text style={styles.statLabel}>SINCE CONF.</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Text style={[styles.statVal, { color: colors.cream }]}>{canons.length}</Text>
                <Text style={styles.statLabel}>CANONS</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Text style={[styles.statVal, { color: colors.cream }]}>{prayerRequests.length}</Text>
                <Text style={styles.statLabel}>REQUESTS</Text>
              </View>
            </View>

            {/* ── Action row ── */}
            <View style={styles.actionRow}>
              <TouchableOpacity
                style={[styles.btnGold, { flex: 1 }]}
                onPress={() => router.push({ pathname: '/(priest)/log-encounter', params: { memberId: memberId ?? '', memberName: memberName ?? memberInfo?.name ?? '' } })}
              >
                <Text style={styles.btnGoldText}>LOG ENCOUNTER</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.btnMenu}
                onPress={() => setShowContactSheet(true)}
              >
                <Text style={styles.btnMenuText}>···</Text>
              </TouchableOpacity>
            </View>

            {/* ── Tab bar ── */}
            <View style={styles.tabBar}>
              {TABS.map(t => (
                <TouchableOpacity
                  key={t.value}
                  style={[styles.tabItem, tab === t.value && styles.tabItemActive]}
                  onPress={() => setTab(t.value)}
                >
                  <Text style={[styles.tabText, tab === t.value && styles.tabTextActive]}>{t.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* ── Overview ── */}
            {tab === 'overview' && (
              <>
                <Card title="Spiritual Vitals" flat>
                  {vitals.length === 0 ? (
                    <Text style={styles.emptyText}>Member hasn't shared any vitals yet.</Text>
                  ) : vitals.map((v, i) => (
                    <View key={i} style={[styles.vitalRow, i < vitals.length - 1 && { marginBottom: 10 }]}>
                      <Text style={[styles.vitalLabel, !v.shared && styles.vitalLabelDim]}>
                        {v.label}{!v.shared ? ' (not shared)' : ''}
                      </Text>
                      <View style={styles.vitalTrack}>
                        {v.shared && <View style={[styles.vitalFill, { width: `${v.pct}%` as any }]} />}
                      </View>
                      <Text style={[styles.vitalVal, !v.shared && { color: colors.muted, opacity: 0.4 }]}>
                        {v.shared ? `${v.pct}%` : '—'}
                      </Text>
                    </View>
                  ))}
                </Card>

                <PsalmStatsCard stats={psalmStats} />

                <Card title="Confession History" flat>
                  <View style={styles.privacyNote}>
                    <Text style={styles.privacyNoteText}>✦ Dates and type only. Content is never stored.</Text>
                  </View>
                  {confessions.length === 0 ? (
                    <Text style={styles.emptyText}>No confession history recorded yet.</Text>
                  ) : confessions.map((c, i) => (
                    <View key={i} style={[styles.histRow, i < confessions.length - 1 && styles.histBorder]}>
                      <Text style={styles.histDate}>{c.date}</Text>
                      <Text style={styles.histType}>{c.type}</Text>
                      {c.note ? <Text style={styles.histNote}>{c.note}</Text> : null}
                    </View>
                  ))}
                </Card>
              </>
            )}

            {/* ── Canon ── */}
            {tab === 'canon' && (
              <Card title="Canon" flat>
                {canons.length === 0 ? (
                  <Text style={styles.emptyText}>No canon yet.</Text>
                ) : canons.map((c, i) => (
                  <View key={c.id} style={[styles.canonRow, i < canons.length - 1 && styles.histBorder]}>
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Text style={styles.canonComponent}>{c.component}</Text>
                        {c.selfAdded && (
                          <View style={styles.selfAddedBadge}>
                            <Text style={styles.selfAddedBadgeText}>ADDED BY MEMBER</Text>
                          </View>
                        )}
                      </View>
                      <Text style={styles.canonMeta}>{c.frequency} · since {c.startDate}</Text>
                    </View>
                    {c.pct > 0 && (
                      <View style={styles.canonPill}>
                        <Text style={[styles.canonPillText, { color: c.pct < 40 ? colors.red : colors.yellow }]}>{c.pct}%</Text>
                      </View>
                    )}
                  </View>
                ))}
                <TouchableOpacity
                  style={[styles.btnGold, { alignSelf: 'flex-start', marginTop: 12 }]}
                  onPress={() => router.push({ pathname: '/(priest)/assign-canon', params: { memberId: memberId ?? '', memberName: memberName ?? memberInfo?.name ?? '' } })}
                >
                  <Text style={styles.btnGoldText}>+ ASSIGN COMPONENT</Text>
                </TouchableOpacity>
              </Card>
            )}

            {/* ── Prayer ── */}
            {tab === 'prayer' && (
              <Card title="Prayer Requests" flat>
                <View style={styles.privacyNote}>
                  <Text style={styles.privacyNoteText}>✦ Requests shared with FOC only, or with both FOC and Sunday school servant.</Text>
                </View>
                {prayerRequests.length === 0 ? (
                  <Text style={styles.emptyText}>No requests shared with Father of Confession.</Text>
                ) : prayerRequests.map((p, i) => (
                  <View key={i} style={[styles.histRow, i < prayerRequests.length - 1 && styles.histBorder]}>
                    <Text style={styles.histDate}>{p.date}</Text>
                    <Text style={styles.histType}>{p.topic}</Text>
                    {p.body ? <Text style={styles.histNote}>{p.body}</Text> : null}
                  </View>
                ))}
              </Card>
            )}

            {/* ── Notes ── */}
            {tab === 'notes' && (
              <Card title="Pastoral Notes (Private)" flat>
                <View style={styles.privacyNote}>
                  <Text style={styles.privacyNoteText}>✦ Your private notes. Never visible to the member.</Text>
                </View>

                {notes.length === 0 && (
                  <Text style={styles.emptyText}>No notes yet. Add your first note below.</Text>
                )}

                {notes.map(note => (
                  <View key={note.id} style={styles.noteCard}>
                    <View style={styles.noteCardHeader}>
                      <Text style={styles.noteCardDate}>
                        {new Date(note.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                        {note.updated_at !== note.created_at ? '  (edited)' : ''}
                      </Text>
                      {editingId !== note.id && (
                        <View style={styles.noteActions}>
                          <TouchableOpacity onPress={() => handleStartEdit(note)} style={styles.noteActionBtn}>
                            <Text style={styles.noteActionText}>Edit</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            onPress={() => handleDeleteNote(note.id)}
                            style={styles.noteActionBtn}
                            disabled={deletingId === note.id}
                          >
                            <Text style={[styles.noteActionText, { color: colors.red }]}>
                              {deletingId === note.id ? '…' : 'Delete'}
                            </Text>
                          </TouchableOpacity>
                        </View>
                      )}
                    </View>

                    {editingId === note.id ? (
                      <>
                        <TextInput
                          style={styles.noteInput}
                          value={editText}
                          onChangeText={setEditText}
                          multiline
                          autoFocus
                          placeholderTextColor="rgba(245,240,232,0.22)"
                        />
                        {editError ? <Text style={styles.noteErrorText}>{editError}</Text> : null}
                        <View style={styles.editActions}>
                          <TouchableOpacity
                            style={[styles.btnGold, { opacity: (!editText.trim() || savingEdit) ? 0.4 : 1 }]}
                            onPress={handleSaveEdit}
                            disabled={!editText.trim() || savingEdit}
                          >
                            <Text style={styles.btnGoldText}>{savingEdit ? 'SAVING…' : 'SAVE'}</Text>
                          </TouchableOpacity>
                          <TouchableOpacity style={styles.btnCancel} onPress={() => setEditingId(null)}>
                            <Text style={styles.btnCancelText}>CANCEL</Text>
                          </TouchableOpacity>
                        </View>
                      </>
                    ) : (
                      <Text style={styles.noteCardBody}>{note.body}</Text>
                    )}
                  </View>
                ))}

                <View style={styles.addNoteSection}>
                  <TextInput
                    style={styles.noteInput}
                    placeholder="Add a pastoral note…"
                    placeholderTextColor="rgba(245,240,232,0.22)"
                    multiline
                    numberOfLines={4}
                    value={newNoteText}
                    onChangeText={setNewNoteText}
                  />
                  {addNoteError ? <Text style={styles.noteErrorText}>{addNoteError}</Text> : null}
                  <TouchableOpacity
                    style={[styles.btnGold, { alignSelf: 'flex-start', marginTop: 10, opacity: (!newNoteText.trim() || addingNote) ? 0.4 : 1 }]}
                    onPress={handleAddNote}
                    disabled={!newNoteText.trim() || addingNote}
                  >
                    <Text style={styles.btnGoldText}>{addingNote ? 'SAVING…' : 'ADD NOTE'}</Text>
                  </TouchableOpacity>
                </View>
              </Card>
            )}
          </>
        )}

      </ScrollView>

      {/* ── Contact sheet ── */}
      <Modal
        visible={showContactSheet}
        transparent
        animationType="slide"
        onRequestClose={() => setShowContactSheet(false)}
      >
        <TouchableOpacity
          style={styles.sheetOverlay}
          onPress={() => setShowContactSheet(false)}
          activeOpacity={1}
        >
          <View style={styles.sheet} onStartShouldSetResponder={() => true}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>{memberInfo?.name ?? 'Contact'}</Text>

            {/* Assign canon action */}
            <TouchableOpacity
              style={styles.sheetRow}
              onPress={() => { setShowContactSheet(false); router.push({ pathname: '/(priest)/assign-canon', params: { memberId: memberId ?? '', memberName: memberName ?? memberInfo?.name ?? '' } }); }}
            >
              <Text style={styles.sheetRowIcon}>📜</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.sheetRowLabel}>Assign Canon</Text>
                <Text style={styles.sheetRowValue}>Add a spiritual practice</Text>
              </View>
              <Text style={styles.sheetRowAction}>ASSIGN</Text>
            </TouchableOpacity>

            {contact?.phone ? (
              <TouchableOpacity
                style={styles.sheetRow}
                onPress={() => Linking.openURL(`tel:${contact.phone.replace(/[^0-9+]/g, '')}`)}
              >
                <Text style={styles.sheetRowIcon}>☎</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.sheetRowLabel}>Phone</Text>
                  <Text style={styles.sheetRowValue}>{contact.phone}</Text>
                </View>
                <Text style={styles.sheetRowAction}>CALL</Text>
              </TouchableOpacity>
            ) : null}

            {contact?.email ? (
              <TouchableOpacity
                style={styles.sheetRow}
                onPress={() => Linking.openURL(`mailto:${contact.email}`)}
              >
                <Text style={styles.sheetRowIcon}>✉</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.sheetRowLabel}>Email</Text>
                  <Text style={styles.sheetRowValue}>{contact.email}</Text>
                </View>
                <Text style={styles.sheetRowAction}>EMAIL</Text>
              </TouchableOpacity>
            ) : null}

            {contact?.address_line1 ? (
              <TouchableOpacity style={styles.sheetRow} onPress={openMaps}>
                <Text style={styles.sheetRowIcon}>⌖</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.sheetRowLabel}>Address</Text>
                  <Text style={styles.sheetRowValue}>{contact.address_line1}</Text>
                  {contact.address_line2 ? (
                    <Text style={styles.sheetRowValue}>{contact.address_line2}</Text>
                  ) : null}
                  <Text style={styles.sheetRowValue}>
                    {[contact.city, contact.state, contact.zip].filter(Boolean).join(', ')}
                  </Text>
                </View>
                <Text style={styles.sheetRowAction}>MAP</Text>
              </TouchableOpacity>
            ) : null}

            {!contact?.phone && !contact?.email && !contact?.address_line1 ? (
              <Text style={styles.sheetEmpty}>
                No contact info on file yet.{'\n'}Member can add this in their Profile settings.
              </Text>
            ) : null}

            <TouchableOpacity style={styles.sheetCloseBtn} onPress={() => setShowContactSheet(false)}>
              <Text style={styles.sheetCloseBtnText}>CLOSE</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.navy },
  scroll: { flex: 1 },
  content: { padding: 20, paddingBottom: 40 },

  backRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 16 },
  backArrow: { fontFamily: fonts.cormorant, fontSize: 22, color: colors.gold },
  backText: { fontFamily: fonts.latoLight, fontSize: 13, color: colors.muted },

  heroCard: { flexDirection: 'row', alignItems: 'flex-start', gap: 14, backgroundColor: colors.cardBg, borderWidth: 1, borderColor: colors.border, borderRadius: 14, padding: 16, marginBottom: 12 },
  heroAvatar: { width: 52, height: 52, borderRadius: 26, backgroundColor: '#2c4a7c', borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  heroAvatarFlagged: { borderColor: colors.red, backgroundColor: 'rgba(192,57,43,0.2)' },
  heroAvatarText: { fontFamily: fonts.cormorantMedium, fontSize: 20, color: colors.cream },
  heroName: { fontFamily: fonts.cormorantMedium, fontSize: 22, color: colors.cream, marginBottom: 2 },
  heroMeta: { fontFamily: fonts.latoLight, fontSize: 11, color: colors.muted },
  heroLifeStage: { fontFamily: fonts.latoLight, fontSize: 11, color: colors.muted, marginTop: 3 },
  flagBadge: { backgroundColor: 'rgba(192,57,43,0.12)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20, alignSelf: 'flex-start', marginTop: 6 },
  flagBadgeText: { fontFamily: fonts.latoBold, fontSize: 9, color: colors.red, letterSpacing: 0.5 },

  statStrip: { flexDirection: 'row', backgroundColor: colors.cardBg, borderWidth: 1, borderColor: colors.border, borderRadius: 12, marginBottom: 16, overflow: 'hidden' },
  statItem: { flex: 1, paddingVertical: 14, alignItems: 'center' },
  statVal: { fontFamily: fonts.cormorantMedium, fontSize: 22 },
  statLabel: { fontFamily: fonts.latoBold, fontSize: 8, letterSpacing: 1.5, color: colors.muted, textTransform: 'uppercase', marginTop: 2 },
  statDivider: { width: 1, backgroundColor: colors.border },

  actionRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  btnGold: { backgroundColor: colors.gold, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 9, alignItems: 'center' },
  btnGoldText: { fontFamily: fonts.latoBold, fontSize: 10, color: colors.navy, letterSpacing: 0.8 },
  btnMenu: { borderWidth: 1, borderColor: colors.border, borderRadius: 8, paddingHorizontal: 16, paddingVertical: 9, alignItems: 'center', justifyContent: 'center' },
  btnMenuText: { fontFamily: fonts.lato, fontSize: 16, color: colors.muted, letterSpacing: 2, lineHeight: 18 },

  tabBar: { flexDirection: 'row', backgroundColor: 'rgba(10,16,30,0.6)', borderRadius: 10, padding: 4, marginBottom: 16, gap: 2 },
  tabItem: { flex: 1, paddingVertical: 7, borderRadius: 8, alignItems: 'center' },
  tabItemActive: { backgroundColor: colors.navyMid, borderWidth: 1, borderColor: colors.border },
  tabText: { fontFamily: fonts.latoBold, fontSize: 10, letterSpacing: 0.5, textTransform: 'uppercase', color: colors.muted },
  tabTextActive: { color: colors.goldLight },

  vitalRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  vitalLabel: { fontFamily: fonts.latoLight, fontSize: 11, color: colors.muted, flex: 1 },
  vitalLabelDim: { opacity: 0.4 },
  vitalTrack: { width: 80, height: 4, backgroundColor: 'rgba(245,240,232,0.08)', borderRadius: 4, overflow: 'hidden' },
  vitalFill: { height: '100%', backgroundColor: colors.gold, borderRadius: 4 },
  vitalVal: { fontFamily: fonts.latoBold, fontSize: 12, color: colors.cream, width: 30, textAlign: 'right' },

  privacyNote: { backgroundColor: 'rgba(201,168,76,0.07)', borderWidth: 1, borderColor: 'rgba(201,168,76,0.15)', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, marginBottom: 12 },
  privacyNoteText: { fontFamily: fonts.latoLight, fontSize: 10, color: colors.muted, letterSpacing: 0.3 },

  histRow: { paddingVertical: 12 },
  histBorder: { borderBottomWidth: 1, borderBottomColor: colors.border },
  histDate: { fontFamily: fonts.latoBold, fontSize: 9, letterSpacing: 1.5, color: colors.gold, opacity: 0.7, marginBottom: 2, textTransform: 'uppercase' },
  histType: { fontFamily: fonts.latoBold, fontSize: 13, color: colors.cream, marginBottom: 2 },
  histNote: { fontFamily: fonts.latoLight, fontSize: 11, color: colors.muted, lineHeight: 16 },

  canonRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, gap: 12 },
  canonComponent: { fontFamily: fonts.latoBold, fontSize: 13, color: colors.cream, marginBottom: 2 },
  canonMeta: { fontFamily: fonts.latoLight, fontSize: 11, color: colors.muted },
  canonPill: { backgroundColor: colors.cardBg, borderWidth: 1, borderColor: colors.border, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
  canonPillText: { fontFamily: fonts.latoBold, fontSize: 12 },
  selfAddedBadge: { backgroundColor: 'rgba(201,168,76,0.12)', borderWidth: 1, borderColor: 'rgba(201,168,76,0.25)', borderRadius: 20, paddingHorizontal: 6, paddingVertical: 2 },
  selfAddedBadgeText: { fontFamily: fonts.latoBold, fontSize: 8, letterSpacing: 0.6, color: colors.gold },

  emptyText: { fontFamily: fonts.latoLight, fontSize: 13, color: colors.muted, textAlign: 'center', paddingVertical: 16 },

  savedNoteText: { fontFamily: fonts.latoLight, fontSize: 13, color: colors.muted, lineHeight: 20, marginBottom: 12, padding: 12, backgroundColor: 'rgba(10,16,30,0.4)', borderRadius: 8 },
  noteCard: { backgroundColor: 'rgba(10,16,30,0.4)', borderWidth: 1, borderColor: colors.border, borderRadius: 10, padding: 12, marginBottom: 10 },
  noteCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  noteCardDate: { fontFamily: fonts.latoBold, fontSize: 9, letterSpacing: 1, color: colors.gold, opacity: 0.8 },
  noteCardBody: { fontFamily: fonts.latoLight, fontSize: 13, color: colors.muted, lineHeight: 20 },
  noteActions: { flexDirection: 'row', gap: 12 },
  noteActionBtn: { paddingVertical: 2 },
  noteActionText: { fontFamily: fonts.latoBold, fontSize: 9, letterSpacing: 0.8, color: colors.gold },
  editActions: { flexDirection: 'row', gap: 8, marginTop: 8 },
  btnCancel: { borderWidth: 1, borderColor: colors.border, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 8 },
  btnCancelText: { fontFamily: fonts.latoBold, fontSize: 10, color: colors.muted, letterSpacing: 0.8 },
  addNoteSection: { marginTop: 12, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 12 },
  noteInput: { backgroundColor: 'rgba(10,16,30,0.7)', borderWidth: 1, borderColor: colors.border, borderRadius: 8, color: colors.cream, fontFamily: fonts.latoLight, fontSize: 13, padding: 12, textAlignVertical: 'top', minHeight: 90 },
  noteErrorText: { fontFamily: fonts.latoLight, fontSize: 11, color: colors.red, marginTop: 6 },

  // ── Contact sheet ──
  sheetOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.navyMid, borderTopLeftRadius: 20, borderTopRightRadius: 20,
    borderWidth: 1, borderColor: colors.border, paddingHorizontal: 20, paddingBottom: 34, paddingTop: 12,
  },
  sheetHandle: { width: 36, height: 4, backgroundColor: colors.border, borderRadius: 2, alignSelf: 'center', marginBottom: 18 },
  sheetTitle: { fontFamily: fonts.cormorantMedium, fontSize: 22, color: colors.cream, marginBottom: 18 },
  sheetRow: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.border },
  sheetRowIcon: { fontSize: 18, width: 26, textAlign: 'center', color: colors.gold },
  sheetRowLabel: { fontFamily: fonts.latoBold, fontSize: 9, letterSpacing: 1.5, textTransform: 'uppercase', color: colors.muted, marginBottom: 2 },
  sheetRowValue: { fontFamily: fonts.latoLight, fontSize: 13, color: colors.cream },
  sheetRowAction: { fontFamily: fonts.latoBold, fontSize: 9, letterSpacing: 1, color: colors.gold, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6 },
  sheetEmpty: { fontFamily: fonts.latoLight, fontSize: 13, color: colors.muted, textAlign: 'center', paddingVertical: 28, lineHeight: 20 },
  sheetCloseBtn: { marginTop: 18, borderWidth: 1, borderColor: colors.border, borderRadius: 8, paddingVertical: 12, alignItems: 'center' },
  sheetCloseBtnText: { fontFamily: fonts.latoBold, fontSize: 11, color: colors.muted, letterSpacing: 1 },
});
