import React, { useState, useEffect } from 'react';
import {
  ScrollView, View, Text, StyleSheet, TouchableOpacity,
  TextInput, ActivityIndicator, Alert, Modal, Linking, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { colors, fonts } from '@/lib/theme';
import { Card } from '@/components/ui/Card';
import { useSession } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { useDemoMode } from '@/lib/demo';

// ── Demo data ─────────────────────────────────────────────────
const DEMO_MEMBER = {
  initials: 'PB', name: 'Peter Botros', stage: 'New',
  joined: 'February 2026', daysSince: 74, flagged: true,
  flagNote: 'Missed two follow-up appointments.',
};
const DEMO_CONTACT = {
  phone: '(614) 555-0182',
  email: 'pbotros@example.com',
  address_line1: '2847 Riverside Dr',
  address_line2: null as string | null,
  city: 'Columbus', state: 'OH', zip: '43221', country: 'US',
};
const DEMO_LIFE = { life_stage: 'married', spouse_name: 'Maria Botros' };
const DEMO_CHILDREN_DATA = [
  { id: 'dc1', name: 'Anthony', birth_year: 2018 },
  { id: 'dc2', name: 'Mary', birth_year: 2021 },
];
const DEMO_VITALS = [
  { label: 'Daily Prayer', pct: 20, shared: true },
  { label: 'Scripture Reading', pct: 30, shared: true },
  { label: 'Divine Liturgy', pct: 45, shared: true },
  { label: 'Small Group', pct: 0, shared: false },
  { label: 'Service', pct: 0, shared: false },
];
const DEMO_CONFESSIONS = [
  { date: 'FEB 25, 2026', type: 'Holy Confession', note: 'Set spiritual goals.' },
  { date: 'FEB 11, 2026', type: 'Introductory Meeting', note: 'Getting to know one another.' },
];
const DEMO_PRAYER = [
  { date: 'MAY 28, 2026', topic: 'Job transition — feeling lost' },
  { date: 'MAY 5, 2026', topic: 'Family reconciliation with brother' },
];
const DEMO_CANONS = [
  { id: 'dc1', component: 'Morning Agpeya', frequency: 'Daily', startDate: 'Mar 1, 2026', pct: 20 },
  { id: 'dc2', component: 'Gospel Reading (1 chapter)', frequency: 'Daily', startDate: 'Mar 1, 2026', pct: 30 },
];
const DEMO_NOTE = 'Needs consistent follow-up. Has expressed interest in deepening faith but struggles with consistency. Suggested accountability partner from the young adult group.';

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

  // Display data
  const [memberInfo, setMemberInfo] = useState<any>(DEMO_MEMBER);
  const [contact, setContact] = useState<any>(demoMode ? DEMO_CONTACT : null);
  const [lifeStageData, setLifeStageData] = useState<any>(demoMode ? DEMO_LIFE : null);
  const [memberChildren, setMemberChildren] = useState<any[]>(demoMode ? DEMO_CHILDREN_DATA : []);
  const [vitals, setVitals] = useState<any[]>(DEMO_VITALS);
  const [confessions, setConfessions] = useState<any[]>(DEMO_CONFESSIONS);
  const [prayerRequests, setPrayerRequests] = useState<any[]>(DEMO_PRAYER);
  const [canons, setCanons] = useState<any[]>(DEMO_CANONS);

  // Notes state
  const [noteInput, setNoteInput] = useState('');
  const [savedNote, setSavedNote] = useState(DEMO_NOTE);
  const [savingNote, setSavingNote] = useState(false);

  // Contact sheet
  const [showContactSheet, setShowContactSheet] = useState(false);

  useEffect(() => {
    if (!demoMode && memberId) {
      loadMemberData();
    }
  }, [memberId, user]);

  async function loadMemberData() {
    if (!user || !memberId) return;
    setLoading(true);

    const [profileRes, vitalsRes, confRes, prayerRes, canonRes, noteRes, contactRes, lifeRes, kidsRes] =
      await Promise.all([
        supabase.from('profiles').select('full_name, created_at, role').eq('id', memberId).single(),
        supabase.from('agent_progress').select('payload').eq('user_id', memberId).eq('agent_slug', 'vitals').single(),
        supabase.from('pastoral_encounters').select('encountered_at, member_note').eq('congregant_id', memberId).eq('encounter_type', 'confession').order('encountered_at', { ascending: false }),
        supabase.from('prayer_requests').select('created_at, topic').eq('user_id', memberId).eq('visibility', 'foc_only').eq('answered', false).order('created_at', { ascending: false }),
        supabase.from('spiritual_canons').select('id, component, frequency, start_date').eq('congregant_id', memberId).eq('active', true),
        supabase.from('agent_progress').select('payload').eq('user_id', user.id).eq('agent_slug', `pastoral-notes-${memberId}`).single(),
        supabase.from('pastoral_contacts').select('*').eq('user_id', memberId).maybeSingle(),
        supabase.from('pastoral_profile').select('*').eq('user_id', memberId).maybeSingle(),
        supabase.from('pastoral_children').select('*').eq('parent_id', memberId).order('birth_year', { ascending: true }),
      ]);

    if (profileRes.data) {
      const p = profileRes.data;
      const joined = new Date(p.created_at).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
      const lastConf = confRes.data?.[0];
      const daysSince = lastConf ? Math.floor((Date.now() - new Date(lastConf.encountered_at).getTime()) / 86400000) : null;
      setMemberInfo({ initials: initials(memberName ?? p.full_name), name: memberName ?? p.full_name, stage: '', joined, daysSince, flagged: false, flagNote: '' });
    }

    if (vitalsRes.data?.payload) {
      const v = vitalsRes.data.payload as any;
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

    if (confRes.data) {
      setConfessions(confRes.data.map(c => ({
        date: new Date(c.encountered_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).toUpperCase(),
        type: 'Holy Confession',
        note: c.member_note ?? '',
      })));
    }

    if (prayerRes.data) {
      setPrayerRequests(prayerRes.data.map(p => ({
        date: new Date(p.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).toUpperCase(),
        topic: p.topic,
      })));
    }

    if (canonRes.data) {
      setCanons(canonRes.data.map(c => ({ id: c.id, component: c.component, frequency: c.frequency, startDate: c.start_date, pct: 0 })));
    }

    if (noteRes.data?.payload) {
      setSavedNote((noteRes.data.payload as any).text ?? '');
    } else if (!demoMode) {
      setSavedNote('');
    }

    if (contactRes.data) setContact(contactRes.data);
    if (lifeRes.data) setLifeStageData(lifeRes.data);
    if (kidsRes.data) setMemberChildren(kidsRes.data);

    setLoading(false);
  }

  async function handleSaveNote() {
    if (!noteInput.trim()) return;
    const newNote = savedNote ? `${savedNote}\n\n${noteInput.trim()}` : noteInput.trim();
    if (demoMode) {
      setSavedNote(newNote);
      setNoteInput('');
      return;
    }
    setSavingNote(true);
    await supabase.from('agent_progress').upsert({
      user_id: user!.id,
      agent_slug: `pastoral-notes-${memberId}`,
      payload: { text: newNote, updated_at: new Date().toISOString() },
    }, { onConflict: 'user_id,agent_slug' });
    setSavedNote(newNote);
    setNoteInput('');
    setSavingNote(false);
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

            {/* ── Action row (three buttons) ── */}
            <View style={styles.actionRow}>
              <TouchableOpacity
                style={[styles.btnGold, { flex: 1 }]}
                onPress={() => router.push({ pathname: '/(priest)/log-encounter', params: { memberId: memberId ?? '', memberName: memberName ?? memberInfo?.name ?? '' } })}
              >
                <Text style={styles.btnGoldText}>LOG ENCOUNTER</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.btnGhost, { flex: 1 }]}
                onPress={() => router.push({ pathname: '/(priest)/assign-canon', params: { memberId: memberId ?? '', memberName: memberName ?? memberInfo?.name ?? '' } })}
              >
                <Text style={styles.btnGhostText}>ASSIGN CANON</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.btnGhost, { flex: 1 }]}
                onPress={() => setShowContactSheet(true)}
              >
                <Text style={styles.btnGhostText}>CONTACT</Text>
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
                <Card title="Spiritual Vitals (Shared Only)" titleIcon="✦">
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

                <Card title="Confession History" titleIcon="✝">
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
              <Card title="Assigned Canon" titleIcon="📜">
                {canons.length === 0 ? (
                  <Text style={styles.emptyText}>No canon assigned yet.</Text>
                ) : canons.map((c, i) => (
                  <View key={c.id} style={[styles.canonRow, i < canons.length - 1 && styles.histBorder]}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.canonComponent}>{c.component}</Text>
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
              <Card title="Prayer Requests (FOC Only)" titleIcon="◇">
                <View style={styles.privacyNote}>
                  <Text style={styles.privacyNoteText}>✦ Only requests explicitly shared with Father of Confession.</Text>
                </View>
                {prayerRequests.length === 0 ? (
                  <Text style={styles.emptyText}>No FOC-shared prayer requests.</Text>
                ) : prayerRequests.map((p, i) => (
                  <View key={i} style={[styles.histRow, i < prayerRequests.length - 1 && styles.histBorder]}>
                    <Text style={styles.histDate}>{p.date}</Text>
                    <Text style={styles.histType}>{p.topic}</Text>
                  </View>
                ))}
              </Card>
            )}

            {/* ── Notes ── */}
            {tab === 'notes' && (
              <Card title="Pastoral Notes (Private)" titleIcon="✎">
                <View style={styles.privacyNote}>
                  <Text style={styles.privacyNoteText}>✦ Your private FOC notes. Never visible to the member.</Text>
                </View>
                {savedNote ? (
                  <Text style={styles.savedNoteText}>{savedNote}</Text>
                ) : null}
                <TextInput
                  style={styles.noteInput}
                  placeholder="Add a pastoral note..."
                  placeholderTextColor="rgba(245,240,232,0.22)"
                  multiline
                  numberOfLines={4}
                  value={noteInput}
                  onChangeText={setNoteInput}
                />
                <TouchableOpacity
                  style={[styles.btnGold, { alignSelf: 'flex-start', marginTop: 12, opacity: (!noteInput.trim() || savingNote) ? 0.4 : 1 }]}
                  onPress={handleSaveNote}
                  disabled={!noteInput.trim() || savingNote}
                >
                  <Text style={styles.btnGoldText}>{savingNote ? 'SAVING…' : 'SAVE NOTE'}</Text>
                </TouchableOpacity>
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
  btnGhost: { borderWidth: 1, borderColor: colors.border, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 9, alignItems: 'center' },
  btnGhostText: { fontFamily: fonts.latoBold, fontSize: 10, color: colors.muted, letterSpacing: 0.8 },

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

  emptyText: { fontFamily: fonts.latoLight, fontSize: 13, color: colors.muted, textAlign: 'center', paddingVertical: 16 },

  savedNoteText: { fontFamily: fonts.latoLight, fontSize: 13, color: colors.muted, lineHeight: 20, marginBottom: 12, padding: 12, backgroundColor: 'rgba(10,16,30,0.4)', borderRadius: 8 },
  noteInput: { backgroundColor: 'rgba(10,16,30,0.7)', borderWidth: 1, borderColor: colors.border, borderRadius: 8, color: colors.cream, fontFamily: fonts.latoLight, fontSize: 13, padding: 12, textAlignVertical: 'top', minHeight: 100 },

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
