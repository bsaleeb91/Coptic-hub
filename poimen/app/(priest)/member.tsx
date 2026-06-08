import React, { useState, useEffect } from 'react';
import { ScrollView, View, Text, StyleSheet, TouchableOpacity, TextInput, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { colors, fonts } from '@/lib/theme';
import { Card } from '@/components/ui/Card';
import { useSession } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { DEMO_MODE } from '@/lib/config';

// ── Demo data ─────────────────────────────────────────────────
const DEMO_MEMBER = { initials: 'PB', name: 'Peter Botros', stage: 'New', phone: '(614) 555-0182', joined: 'February 2026', daysSince: 74, flagged: true, flagNote: 'Missed two follow-up appointments.' };
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

export default function MemberScreen() {
  const router = useRouter();
  const { id: memberId, name: memberName } = useLocalSearchParams<{ id: string; name: string }>();
  const { user } = useSession();
  const [tab, setTab] = useState<TabType>('overview');
  const [loading, setLoading] = useState(!DEMO_MODE);

  // Display data
  const [memberInfo, setMemberInfo] = useState<any>(DEMO_MEMBER);
  const [vitals, setVitals] = useState<any[]>(DEMO_VITALS);
  const [confessions, setConfessions] = useState<any[]>(DEMO_CONFESSIONS);
  const [prayerRequests, setPrayerRequests] = useState<any[]>(DEMO_PRAYER);
  const [canons, setCanons] = useState<any[]>(DEMO_CANONS);

  // Notes state
  const [noteInput, setNoteInput] = useState('');
  const [savedNote, setSavedNote] = useState(DEMO_NOTE);
  const [savingNote, setSavingNote] = useState(false);

  useEffect(() => {
    if (!DEMO_MODE && memberId) {
      loadMemberData();
    }
  }, [memberId, user]);

  async function loadMemberData() {
    if (!user || !memberId) return;
    setLoading(true);

    const [profileRes, vitalsRes, confRes, prayerRes, canonRes, noteRes] = await Promise.all([
      supabase.from('profiles').select('full_name, created_at, role').eq('id', memberId).single(),
      supabase.from('agent_progress').select('payload').eq('user_id', memberId).eq('agent_slug', 'vitals').single(),
      supabase.from('pastoral_encounters').select('encountered_at, member_note').eq('congregant_id', memberId).eq('encounter_type', 'confession').order('encountered_at', { ascending: false }),
      supabase.from('prayer_requests').select('created_at, topic').eq('user_id', memberId).eq('visibility', 'foc_only').eq('answered', false).order('created_at', { ascending: false }),
      supabase.from('spiritual_canons').select('id, component, frequency, start_date').eq('congregant_id', memberId).eq('active', true),
      supabase.from('agent_progress').select('payload').eq('user_id', user.id).eq('agent_slug', `pastoral-notes-${memberId}`).single(),
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
    } else if (!DEMO_MODE) {
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
    } else if (!DEMO_MODE) {
      setSavedNote('');
    }

    setLoading(false);
  }

  async function handleSaveNote() {
    if (!noteInput.trim()) return;
    const newNote = savedNote ? `${savedNote}\n\n${noteInput.trim()}` : noteInput.trim();
    if (DEMO_MODE) {
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

  const daysSince = memberInfo?.daysSince;
  const sinceTxt = daysSince !== null && daysSince !== undefined ? `${daysSince}d` : '—';
  const sinceColor = daysSince === null || daysSince === undefined ? colors.muted : daysSince < 30 ? colors.green : daysSince < 60 ? colors.yellow : colors.red;

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
                {memberInfo?.flagged && (
                  <View style={styles.flagBadge}>
                    <Text style={styles.flagBadgeText}>⚑ {memberInfo.flagNote}</Text>
                  </View>
                )}
              </View>
            </View>

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

            <View style={styles.actionRow}>
              <TouchableOpacity style={styles.btnGold} onPress={() => router.push({ pathname: '/(priest)/log-encounter', params: { memberId: memberId ?? '', memberName: memberName ?? memberInfo?.name ?? '' } })}>
                <Text style={styles.btnGoldText}>LOG ENCOUNTER</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.btnGhost} onPress={() => router.push({ pathname: '/(priest)/assign-canon', params: { memberId: memberId ?? '', memberName: memberName ?? memberInfo?.name ?? '' } })}>
                <Text style={styles.btnGhostText}>ASSIGN CANON</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.tabBar}>
              {TABS.map(t => (
                <TouchableOpacity key={t.value} style={[styles.tabItem, tab === t.value && styles.tabItemActive]} onPress={() => setTab(t.value)}>
                  <Text style={[styles.tabText, tab === t.value && styles.tabTextActive]}>{t.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Overview */}
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

            {/* Canon */}
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

            {/* Prayer */}
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

            {/* Notes */}
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
    </SafeAreaView>
  );
}

function initials(name: string | null | undefined): string {
  if (!name) return '?';
  const parts = name.split(' ');
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase();
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
  flagBadge: { backgroundColor: 'rgba(192,57,43,0.12)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20, alignSelf: 'flex-start', marginTop: 6 },
  flagBadgeText: { fontFamily: fonts.latoBold, fontSize: 9, color: colors.red, letterSpacing: 0.5 },

  statStrip: { flexDirection: 'row', backgroundColor: colors.cardBg, borderWidth: 1, borderColor: colors.border, borderRadius: 12, marginBottom: 16, overflow: 'hidden' },
  statItem: { flex: 1, paddingVertical: 14, alignItems: 'center' },
  statVal: { fontFamily: fonts.cormorantMedium, fontSize: 22 },
  statLabel: { fontFamily: fonts.latoBold, fontSize: 8, letterSpacing: 1.5, color: colors.muted, textTransform: 'uppercase', marginTop: 2 },
  statDivider: { width: 1, backgroundColor: colors.border },

  actionRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  btnGold: { backgroundColor: colors.gold, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 9 },
  btnGoldText: { fontFamily: fonts.latoBold, fontSize: 10, color: colors.navy, letterSpacing: 0.8 },
  btnGhost: { borderWidth: 1, borderColor: colors.border, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 9 },
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
});
