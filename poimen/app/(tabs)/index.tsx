import React, { useState, useEffect } from 'react';
import {
  ScrollView, View, Text, StyleSheet, TouchableOpacity,
  Pressable, Modal, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { colors, fonts } from '@/lib/theme';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { PrivacyNote } from '@/components/ui/PrivacyNote';
import { useSession } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { useDemoMode } from '@/lib/demo';

// ── Demo data ────────────────────────────────────────────────
const DEMO_VITALS_BARS = [
  { label: 'Daily Prayer (Agpeya)', pct: 65 },
  { label: 'Scripture Reading', pct: 80 },
  { label: 'Divine Liturgy', pct: 80 },
  { label: 'Small Group', pct: 90 },
  { label: 'Service / Diakonia', pct: 50 },
];

const DEMO_TIMELINE = [
  { date: 'MAY 21, 2026', title: 'Holy Confession', body: 'Fr. Bishoy assigned a 40-day reading plan from the Psalms.', tag: '✝ Confession', tagBg: 'rgba(201,168,76,0.15)', tagColor: colors.goldLight },
  { date: 'MAY 4, 2026', title: 'Pastoral Visit — Home', body: 'Fr. Bishoy visited following the birth of your daughter. Prayers and blessings offered.', tag: '◎ Pastoral Visit', tagBg: 'rgba(41,128,185,0.15)', tagColor: colors.blue },
  { date: 'APR 20, 2026', title: 'Holy Week Confession', body: 'Guidance on marriage and family prayer practices.', tag: '✝ Confession', tagBg: 'rgba(201,168,76,0.15)', tagColor: colors.goldLight },
  { date: 'MAR 12, 2026', title: 'Small Group Check-in', body: 'Discussed the Book of Job with the young couples\' group.', tag: '◇ Note', tagBg: 'rgba(245,240,232,0.07)', tagColor: colors.muted, dim: true },
];

const FEASTS = [
  { month: 'JUN', day: '12', title: 'Feast of the Apostles', desc: 'End of Apostles\' Fast. Breaking of fast after Divine Liturgy.' },
  { month: 'JUN', day: '29', title: 'Sts. Peter & Paul', desc: 'Feast of the chief apostles. Divine Liturgy at 7:00 AM.' },
  { month: 'JUL', day: '19', title: 'Feast of Archangel Michael', desc: 'Monthly feast. Tasbeha at 11:00 PM the prior evening.' },
];

const VITAL_LABELS = [
  'Daily Prayer (Agpeya)',
  'Scripture Reading',
  'Divine Liturgy',
  'Small Group',
  'Service / Diakonia',
];

const PCT_STEPS = [0, 25, 50, 75, 100];

// ── Component ────────────────────────────────────────────────
export default function DashboardScreen() {
  const router = useRouter();
  const { profile, user } = useSession();
  const { demoMode } = useDemoMode();
  const firstName = profile?.full_name?.split(' ')[0] ?? 'friend';

  const [vitals, setVitals] = useState<number[]>(VITAL_LABELS.map(() => 0));
  const [editingVitals, setEditingVitals] = useState(false);
  const [timeline, setTimeline] = useState<any[]>([]);
  const [focProfile, setFocProfile] = useState<any>(null);
  const [savingVitals, setSavingVitals] = useState(false);

  useEffect(() => {
    if (demoMode) return;
    loadVitals();
    loadTimeline();
    loadFoc();
  }, [user]);

  async function loadVitals() {
    if (!user) return;
    const { data } = await supabase
      .from('agent_progress')
      .select('payload')
      .eq('user_id', user.id)
      .eq('agent_slug', 'vitals')
      .single();
    if (data?.payload?.vitals) setVitals(data.payload.vitals);
  }

  async function loadTimeline() {
    if (!user) return;
    const { data } = await supabase
      .from('pastoral_encounters')
      .select('encounter_type, encountered_at, member_note')
      .eq('congregant_id', user.id)
      .order('encountered_at', { ascending: false })
      .limit(4);
    if (data) setTimeline(data);
  }

  async function loadFoc() {
    if (!profile?.foc_id) return;
    const { data } = await supabase
      .from('profiles')
      .select('full_name, church_name')
      .eq('id', profile.foc_id)
      .single();
    if (data) setFocProfile(data);
  }

  async function saveVitals() {
    if (!user) return;
    setSavingVitals(true);
    await supabase.from('agent_progress').upsert({
      user_id: user.id,
      agent_slug: 'vitals',
      payload: { vitals },
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id,agent_slug' });
    setSavingVitals(false);
    setEditingVitals(false);
  }

  function cycleVital(index: number) {
    setVitals(prev => {
      const next = [...prev];
      const currentStep = PCT_STEPS.indexOf(next[index]);
      next[index] = PCT_STEPS[(currentStep + 1) % PCT_STEPS.length];
      return next;
    });
  }

  const displayVitals = demoMode ? DEMO_VITALS_BARS : VITAL_LABELS.map((label, i) => ({ label, pct: vitals[i] }));
  const displayTimeline = demoMode ? DEMO_TIMELINE : timeline;

  const encounterTagMap: Record<string, { tag: string; tagBg: string; tagColor: string }> = {
    confession: { tag: '✝ Confession', tagBg: 'rgba(201,168,76,0.15)', tagColor: colors.goldLight },
    counseling: { tag: '◎ Counseling', tagBg: 'rgba(41,128,185,0.15)', tagColor: colors.blue },
    visit: { tag: '⊕ Pastoral Visit', tagBg: 'rgba(41,128,185,0.15)', tagColor: colors.blue },
    advice: { tag: '◇ Advice', tagBg: 'rgba(245,240,232,0.07)', tagColor: colors.muted },
    phone: { tag: '◈ Call', tagBg: 'rgba(245,240,232,0.07)', tagColor: colors.muted },
    group: { tag: '◉ Group', tagBg: 'rgba(93,202,135,0.12)', tagColor: colors.green },
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>

        {/* Header */}
        <View style={styles.topbar}>
          <View style={{ flex: 1, marginRight: 12 }}>
            <Text style={styles.greeting}>Peace be with you, {firstName}</Text>
            <Text style={styles.subtitle}>Sunday, June 7 · Apostles' Fast · Day 12</Text>
          </View>
          <View style={styles.topbarButtons}>
            {profile?.role === 'priest' && (
              <TouchableOpacity style={styles.btnPriestToggle} onPress={() => router.push('/(priest)')}>
                <Text style={styles.btnPriestToggleText}>FOC VIEW</Text>
              </TouchableOpacity>
            )}
            {profile?.role === 'servant' && (
              <TouchableOpacity style={styles.btnPriestToggle} onPress={() => router.push('/(servant)')}>
                <Text style={styles.btnPriestToggleText}>STUDENTS</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity style={styles.avatarBtn} onPress={() => router.push('/profile')}>
              <Text style={styles.avatarBtnText}>{firstName.charAt(0).toUpperCase()}</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Vital Cards */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.vitalsScroll} contentContainerStyle={styles.vitalsContent}>
          <View style={styles.vitalCard}>
            <View style={styles.vitalGoldLine} />
            <Text style={styles.vitalLabel}>Last Confession</Text>
            {demoMode ? (
              <>
                <Text style={styles.vitalValue}>47</Text>
                <Text style={styles.vitalMeta}>days ago · May 21st</Text>
                <Badge variant="yellow" label="⚠ Due for visit" />
              </>
            ) : (
              <>
                <Text style={styles.vitalValue}>—</Text>
                <Text style={styles.vitalMeta}>No record yet</Text>
              </>
            )}
          </View>
          <View style={styles.vitalCard}>
            <View style={styles.vitalGoldLine} />
            <Text style={styles.vitalLabel}>Church Attendance</Text>
            {demoMode ? (
              <>
                <Text style={styles.vitalValue}>8 / 10</Text>
                <Text style={styles.vitalMeta}>Sundays this quarter</Text>
                <Badge variant="green" label="✓ Consistent" />
              </>
            ) : (
              <>
                <Text style={styles.vitalValue}>—</Text>
                <Text style={styles.vitalMeta}>Self-report in Vitals</Text>
              </>
            )}
          </View>
        </ScrollView>

        {/* Confession CTA Banner */}
        <View style={styles.banner}>
          <Text style={styles.bannerCross}>✝</Text>
          <Text style={styles.bannerLabel}>UPCOMING</Text>
          <Text style={styles.bannerTitle}>Prepare for Holy Confession</Text>
          <Text style={styles.bannerBody}>
            {demoMode
              ? 'Fr. Bishoy has confession hours this Sunday after the Divine Liturgy. You last confessed 47 days ago. The Apostles\' Fast is a blessed time to receive the sacrament.'
              : 'Use the Confession tab to examine your conscience before meeting with your Father of Confession.'}
          </Text>
          <View style={styles.bannerActions}>
            <TouchableOpacity style={styles.btnGold} onPress={() => router.push('/(tabs)/confession')}>
              <Text style={styles.btnGoldText}>BEGIN EXAMINATION</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Pastoral Journey Timeline */}
        <Card title="Pastoral Journey" titleIcon="◎" action={<Text style={styles.cardAction}>View all</Text>}>
          {demoMode ? (
            DEMO_TIMELINE.map((item, i) => (
              <TimelineRow key={i} item={item} last={i === DEMO_TIMELINE.length - 1} />
            ))
          ) : timeline.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyIcon}>◎</Text>
              <Text style={styles.emptyTitle}>No encounters yet</Text>
              <Text style={styles.emptyBody}>Your pastoral journey will appear here as you meet with your Father of Confession.</Text>
            </View>
          ) : (
            timeline.map((enc, i) => {
              const meta = encounterTagMap[enc.encounter_type] ?? encounterTagMap.advice;
              const item = {
                date: new Date(enc.encountered_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).toUpperCase(),
                title: meta.tag.replace(/^[^\s]+\s/, ''),
                body: enc.member_note ?? '',
                ...meta,
              };
              return <TimelineRow key={i} item={item} last={i === timeline.length - 1} />;
            })
          )}
        </Card>

        {/* Spiritual Vitals */}
        <Card
          title="Spiritual Vitals"
          titleIcon="✦"
          action={
            !demoMode ? (
              <TouchableOpacity onPress={() => setEditingVitals(true)}>
                <Text style={styles.cardAction}>Edit</Text>
              </TouchableOpacity>
            ) : <Text style={styles.cardAction}>Edit</Text>
          }
        >
          {displayVitals.map((v, i) => (
            <View key={i} style={[styles.vitalRow, i < displayVitals.length - 1 && { marginBottom: 12 }]}>
              <Text style={styles.vitalRowLabel}>{v.label}</Text>
              <View style={styles.vitalBarTrack}>
                <View style={[styles.vitalBarFill, { width: `${v.pct}%` as any }]} />
              </View>
              <Text style={styles.vitalRowVal}>{v.pct > 0 ? `${v.pct}%` : '—'}</Text>
            </View>
          ))}
          <PrivacyNote text="Self-reported. Only you and your Father of Confession can see this." />
        </Card>

        {/* Upcoming Feasts — same in both modes */}
        <Card title="Upcoming Feasts" titleIcon="⊕" action={<Text style={styles.cardAction}>Full calendar</Text>}>
          {FEASTS.map((feast, i) => (
            <View key={i} style={[styles.feastItem, i < FEASTS.length - 1 && styles.feastBorder]}>
              <View style={styles.feastDateBlock}>
                <Text style={styles.feastMonth}>{feast.month}</Text>
                <Text style={styles.feastDay}>{feast.day}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.feastTitle}>{feast.title}</Text>
                <Text style={styles.feastDesc}>{feast.desc}</Text>
              </View>
            </View>
          ))}
        </Card>

        {/* Father of Confession */}
        <Card title="My Father of Confession" titleIcon="◉">
          {demoMode ? (
            <>
              <View style={styles.focRow}>
                <View style={styles.focAvatar}><Text style={styles.focAvatarText}>BM</Text></View>
                <View>
                  <Text style={styles.focName}>Fr. Bishoy Marcos</Text>
                  <Text style={styles.focChurch}>St. Mary's Coptic Orthodox Church</Text>
                </View>
              </View>
              <Pressable style={styles.scheduleChip} onPress={() => router.push('/(tabs)/confession')}>
                <Text style={styles.scheduleIcon}>✝</Text>
                <View>
                  <Text style={styles.scheduleText}>Request Confession Appointment</Text>
                  <Text style={styles.scheduleSub}>Next available: Sunday after Liturgy</Text>
                </View>
              </Pressable>
            </>
          ) : focProfile ? (
            <>
              <View style={styles.focRow}>
                <View style={styles.focAvatar}>
                  <Text style={styles.focAvatarText}>
                    {focProfile.full_name?.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase()}
                  </Text>
                </View>
                <View>
                  <Text style={styles.focName}>{focProfile.full_name}</Text>
                  <Text style={styles.focChurch}>{focProfile.church_name ?? ''}</Text>
                </View>
              </View>
              <Pressable style={styles.scheduleChip} onPress={() => router.push('/(tabs)/confession')}>
                <Text style={styles.scheduleIcon}>✝</Text>
                <View>
                  <Text style={styles.scheduleText}>Begin Confession Examination</Text>
                  <Text style={styles.scheduleSub}>Prepare before your next meeting</Text>
                </View>
              </Pressable>
            </>
          ) : (
            <View style={styles.emptyState}>
              <Text style={styles.emptyIcon}>◉</Text>
              <Text style={styles.emptyTitle}>No FOC connected yet</Text>
              <Text style={styles.emptyBody}>Your Father of Confession will link your account when they set up their Poimen profile.</Text>
            </View>
          )}
        </Card>

      </ScrollView>

      {/* Edit Vitals Modal */}
      <Modal visible={editingVitals} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Edit Spiritual Vitals</Text>
            <Text style={styles.modalSub}>Tap a bar to cycle: 0 → 25 → 50 → 75 → 100%</Text>
            {VITAL_LABELS.map((label, i) => (
              <TouchableOpacity key={i} style={styles.modalVitalRow} onPress={() => cycleVital(i)}>
                <Text style={styles.modalVitalLabel}>{label}</Text>
                <View style={styles.vitalBarTrack}>
                  <View style={[styles.vitalBarFill, { width: `${vitals[i]}%` as any }]} />
                </View>
                <Text style={styles.vitalRowVal}>{vitals[i]}%</Text>
              </TouchableOpacity>
            ))}
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.btnGhost} onPress={() => setEditingVitals(false)}>
                <Text style={styles.btnGhostText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.btnGold} onPress={saveVitals} disabled={savingVitals}>
                <Text style={styles.btnGoldText}>{savingVitals ? 'SAVING...' : 'SAVE'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

    </SafeAreaView>
  );
}

function TimelineRow({ item, last }: { item: any; last: boolean }) {
  return (
    <View style={styles.tlRow}>
      <View style={styles.tlDotCol}>
        <View style={[styles.tlDot, item.dim && styles.tlDotDim]} />
        {!last && <View style={styles.tlLine} />}
      </View>
      <View style={[styles.tlBodyCol, !last && { paddingBottom: 16 }]}>
        <Text style={[styles.tlDate, item.dim && { opacity: 0.5 }]}>{item.date}</Text>
        <Text style={styles.tlTitle}>{item.title}</Text>
        {item.body ? <Text style={styles.tlBody}>{item.body}</Text> : null}
        <View style={[styles.tlTag, { backgroundColor: item.tagBg }]}>
          <Text style={[styles.tlTagText, { color: item.tagColor }]}>{item.tag}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.navy },
  scroll: { flex: 1 },
  content: { padding: 20, paddingBottom: 40 },

  topbar: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20 },
  topbarButtons: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  btnPriestToggle: { borderWidth: 1, borderColor: colors.border, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8 },
  btnPriestToggleText: { fontFamily: fonts.latoBold, fontSize: 9, color: colors.muted, letterSpacing: 1.5 },
  avatarBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: colors.goldDim, borderWidth: 1, borderColor: colors.gold, alignItems: 'center', justifyContent: 'center' },
  avatarBtnText: { fontFamily: fonts.cormorantMedium, fontSize: 16, color: colors.goldLight },
  greeting: { fontFamily: fonts.cormorantMedium, fontSize: 26, color: colors.cream, lineHeight: 32 },
  subtitle: { fontFamily: fonts.latoLight, fontSize: 11, color: colors.muted, marginTop: 4 },

  btnGold: { backgroundColor: colors.gold, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 9, alignSelf: 'flex-start' },
  btnGoldText: { fontFamily: fonts.latoBold, fontSize: 10, color: colors.navy, letterSpacing: 0.8 },
  btnGhost: { borderWidth: 1, borderColor: colors.border, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 9 },
  btnGhostText: { fontFamily: fonts.lato, fontSize: 11, color: colors.muted },

  vitalsScroll: { marginHorizontal: -20, marginBottom: 20 },
  vitalsContent: { paddingHorizontal: 20, gap: 12 },
  vitalCard: { width: 160, backgroundColor: colors.cardBg, borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 16, position: 'relative', overflow: 'hidden' },
  vitalGoldLine: { position: 'absolute', top: 0, left: 0, right: 0, height: 2, backgroundColor: colors.gold, opacity: 0.6 },
  vitalLabel: { fontFamily: fonts.latoBold, fontSize: 9, letterSpacing: 2, textTransform: 'uppercase', color: colors.muted, marginBottom: 10 },
  vitalValue: { fontFamily: fonts.cormorantMedium, fontSize: 28, color: colors.cream, lineHeight: 32 },
  vitalMeta: { fontFamily: fonts.latoLight, fontSize: 11, color: colors.muted, marginTop: 6 },

  banner: { backgroundColor: 'rgba(201,168,76,0.08)', borderWidth: 1, borderColor: 'rgba(201,168,76,0.3)', borderRadius: 14, padding: 20, marginBottom: 16, position: 'relative', overflow: 'hidden' },
  bannerCross: { position: 'absolute', right: 16, top: 10, fontSize: 56, color: 'rgba(201,168,76,0.07)', fontFamily: fonts.cormorant },
  bannerLabel: { fontFamily: fonts.latoBold, fontSize: 9, letterSpacing: 2.5, textTransform: 'uppercase', color: colors.gold, marginBottom: 4 },
  bannerTitle: { fontFamily: fonts.cormorantMedium, fontSize: 20, color: colors.cream, marginBottom: 6 },
  bannerBody: { fontFamily: fonts.latoLight, fontSize: 12, color: colors.muted, lineHeight: 18, maxWidth: '85%' },
  bannerActions: { flexDirection: 'row', gap: 10, marginTop: 14, flexWrap: 'wrap' },

  tlRow: { flexDirection: 'row', gap: 14 },
  tlDotCol: { alignItems: 'center', width: 14 },
  tlDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.gold, marginTop: 4, flexShrink: 0 },
  tlDotDim: { backgroundColor: colors.muted },
  tlLine: { width: 1, flex: 1, backgroundColor: colors.border, marginTop: 4 },
  tlBodyCol: { flex: 1, paddingBottom: 4 },
  tlDate: { fontFamily: fonts.latoBold, fontSize: 9, letterSpacing: 1.5, textTransform: 'uppercase', color: colors.gold, opacity: 0.7, marginBottom: 3 },
  tlTitle: { fontFamily: fonts.latoBold, fontSize: 13, color: colors.cream, marginBottom: 2 },
  tlBody: { fontFamily: fonts.latoLight, fontSize: 12, color: colors.muted, lineHeight: 18 },
  tlTag: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 20, alignSelf: 'flex-start', marginTop: 6 },
  tlTagText: { fontFamily: fonts.latoBold, fontSize: 10, letterSpacing: 0.5 },

  vitalRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  vitalRowLabel: { fontFamily: fonts.latoLight, fontSize: 12, color: colors.muted, flex: 1 },
  vitalBarTrack: { width: 80, height: 4, backgroundColor: 'rgba(245,240,232,0.08)', borderRadius: 4, overflow: 'hidden', flexShrink: 0 },
  vitalBarFill: { height: '100%', backgroundColor: colors.gold, borderRadius: 4 },
  vitalRowVal: { fontFamily: fonts.latoBold, fontSize: 12, color: colors.cream, width: 34, textAlign: 'right' },

  feastItem: { flexDirection: 'row', gap: 14, paddingVertical: 12, alignItems: 'flex-start' },
  feastBorder: { borderBottomWidth: 1, borderBottomColor: colors.border },
  feastDateBlock: { backgroundColor: colors.goldDim, borderWidth: 1, borderColor: colors.border, borderRadius: 8, paddingVertical: 6, paddingHorizontal: 8, alignItems: 'center', minWidth: 42 },
  feastMonth: { fontFamily: fonts.latoBold, fontSize: 9, letterSpacing: 1, textTransform: 'uppercase', color: colors.gold },
  feastDay: { fontFamily: fonts.cormorantMedium, fontSize: 22, color: colors.cream, lineHeight: 26 },
  feastTitle: { fontFamily: fonts.latoBold, fontSize: 13, color: colors.cream, marginBottom: 2 },
  feastDesc: { fontFamily: fonts.latoLight, fontSize: 11, color: colors.muted, lineHeight: 16 },

  cardAction: { fontFamily: fonts.lato, fontSize: 11, color: colors.gold },

  focRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14 },
  focAvatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#2c4a7c', borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  focAvatarText: { fontFamily: fonts.cormorantMedium, fontSize: 16, color: colors.cream },
  focName: { fontFamily: fonts.latoBold, fontSize: 14, color: colors.cream },
  focChurch: { fontFamily: fonts.latoLight, fontSize: 11, color: colors.muted },
  scheduleChip: { flexDirection: 'row', gap: 10, backgroundColor: colors.goldDim, borderWidth: 1, borderColor: colors.border, borderRadius: 10, padding: 12, alignItems: 'center' },
  scheduleIcon: { fontSize: 18 },
  scheduleText: { fontFamily: fonts.latoBold, fontSize: 12, color: colors.cream },
  scheduleSub: { fontFamily: fonts.latoLight, fontSize: 11, color: colors.muted, marginTop: 1 },

  emptyState: { alignItems: 'center', paddingVertical: 20, gap: 6 },
  emptyIcon: { fontSize: 28, color: colors.muted, opacity: 0.4 },
  emptyTitle: { fontFamily: fonts.latoBold, fontSize: 13, color: colors.muted },
  emptyBody: { fontFamily: fonts.latoLight, fontSize: 11, color: colors.muted, textAlign: 'center', lineHeight: 17, opacity: 0.7 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modalCard: { backgroundColor: colors.navyMid, borderTopLeftRadius: 20, borderTopRightRadius: 20, borderWidth: 1, borderColor: colors.border, padding: 24, paddingBottom: 40 },
  modalTitle: { fontFamily: fonts.cormorantMedium, fontSize: 22, color: colors.cream, marginBottom: 4 },
  modalSub: { fontFamily: fonts.latoLight, fontSize: 11, color: colors.muted, marginBottom: 20 },
  modalVitalRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.border },
  modalVitalLabel: { fontFamily: fonts.latoLight, fontSize: 12, color: colors.muted, flex: 1 },
  modalActions: { flexDirection: 'row', gap: 12, marginTop: 20, justifyContent: 'flex-end' },
});
