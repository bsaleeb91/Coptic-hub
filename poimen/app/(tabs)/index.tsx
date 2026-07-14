import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  ScrollView, View, Text, StyleSheet, TouchableOpacity,
  Animated, PanResponder, Modal, Dimensions, AccessibilityInfo,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { colors, fonts } from '@/lib/theme';
import { Card } from '@/components/ui/Card';
import { PrivacyNote } from '@/components/ui/PrivacyNote';
import { useSession } from '@/lib/auth';
import * as db from '@/lib/db';
import { useDemoMode } from '@/lib/demo';
import { loadSections, saveSections, SECTION_DEFS, DEFAULT_SECTIONS, type SectionId } from '@/lib/dashboard-layout';
import * as H from '@/lib/haptics';
import { loadRule } from '@/lib/canon/rule-store';
import { todayItems } from '@/lib/canon/today';
import { loadTodayChecks } from '@/lib/canon/checks';

const { width: SW } = Dimensions.get('window');
const TILE_W = (SW - 48) / 2;

// ── Demo data ────────────────────────────────────────────────
const DEMO_VITALS = [
  { label: 'Daily Prayer (Agpeya)', pct: 65 },
  { label: 'Scripture Reading', pct: 80 },
  { label: 'Divine Liturgy', pct: 80 },
  { label: 'Fasting', pct: 90 },
  { label: 'Service / Diakonia', pct: 50 },
];

const DEMO_TIMELINE = [
  { date: 'MAY 21, 2026', title: 'Holy Confession', body: 'Fr. Bishoy assigned a 40-day reading plan from the Psalms.', tag: '✝ Confession', tagBg: 'rgba(201,168,76,0.15)', tagColor: colors.goldLight },
  { date: 'MAY 4, 2026', title: 'Pastoral Visit — Home', body: 'Pastoral visit following the birth of your daughter.', tag: '◎ Pastoral Visit', tagBg: 'rgba(41,128,185,0.15)', tagColor: colors.blue },
  { date: 'APR 20, 2026', title: 'Holy Week Confession', body: 'Guidance on marriage and family prayer practices.', tag: '✝ Confession', tagBg: 'rgba(201,168,76,0.15)', tagColor: colors.goldLight },
  { date: 'MAR 12, 2026', title: 'Small Group Check-in', body: "Discussed the Book of Job with the young couples' group.", tag: '◇ Note', tagBg: 'rgba(245,240,232,0.07)', tagColor: colors.muted, dim: true },
];

const FEASTS = [
  { month: 'JUL', day: '12', title: 'Feast of the Apostles', desc: "End of Apostles' Fast. Breaking of fast after Divine Liturgy." },
  { month: 'JUL', day: '19', title: 'Feast of Archangel Michael', desc: 'Monthly feast. Tasbeha at 11:00 PM the prior evening.' },
  { month: 'AUG', day: '7', title: 'Feast of the Transfiguration', desc: 'Feast of the Transfiguration of our Lord Jesus Christ.' },
];

const VITAL_LABELS = ['Daily Prayer (Agpeya)', 'Scripture Reading', 'Divine Liturgy', 'Fasting', 'Service / Diakonia'];
const VITAL_KEYS = ['prayer', 'scripture', 'liturgy', 'fasting', 'service'] as const;

function getDashboardSubtitle(): string {
  const today = new Date();
  const dateStr = today.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
  const apostlesStart = new Date(2026, 4, 25);
  const apostlesEnd = new Date(2026, 6, 11);
  if (today >= apostlesStart && today <= apostlesEnd) {
    const day = Math.round((today.getTime() - apostlesStart.getTime()) / 86400000) + 1;
    return `${dateStr} · Apostles' Fast · Day ${day}`;
  }
  const m = today.getMonth() + 1; const d = today.getDate();
  if (m === 8 && d >= 1 && d <= 14) return `${dateStr} · St. Mary's Fast · Day ${d}`;
  if ((m === 11 && d >= 25) || m === 12 || (m === 1 && d <= 6)) {
    const y = m === 1 ? today.getFullYear() - 1 : today.getFullYear();
    const day = Math.round((today.getTime() - new Date(y, 10, 25).getTime()) / 86400000) + 1;
    return `${dateStr} · Advent Fast · Day ${day}`;
  }
  return dateStr;
}

// ── VitalRow with drag slider ─────────────────────────────────
function VitalRow({ label, value, onChange, last }: { label: string; value: number; onChange: (v: number) => void; last: boolean }) {
  const trackWidthRef = useRef(1);
  const startValueRef = useRef(value);
  const valueRef = useRef(value);
  const onChangeRef = useRef(onChange);
  useEffect(() => { valueRef.current = value; }, [value]);
  useEffect(() => { onChangeRef.current = onChange; }, [onChange]);

  const panResponder = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 4,
    onPanResponderGrant: (evt) => {
      startValueRef.current = valueRef.current;
      const pct = Math.max(0, Math.min(100, (evt.nativeEvent.locationX / trackWidthRef.current) * 100));
      onChangeRef.current(Math.round(pct / 5) * 5);
    },
    onPanResponderMove: (_, g) => {
      const delta = (g.dx / trackWidthRef.current) * 100;
      const raw = Math.max(0, Math.min(100, startValueRef.current + delta));
      const snapped = Math.round(raw / 5) * 5;
      if (snapped !== valueRef.current) {
        if (snapped % 25 === 0) H.tap();
        onChangeRef.current(snapped);
      }
    },
  })).current;

  return (
    <View style={[styles.vitalRow, !last && { marginBottom: 16 }]}>
      <Text style={styles.vitalLabel}>{label}</Text>
      <View
        style={styles.vitalTrack}
        onLayout={e => { trackWidthRef.current = e.nativeEvent.layout.width; }}
        {...panResponder.panHandlers}
      >
        <View style={[styles.vitalFill, { width: `${value}%` as any }]} />
        <View style={[styles.vitalThumb, { left: `${Math.max(0, value)}%` as any, marginLeft: value > 0 ? -5 : 0 }]} />
      </View>
      <Text style={styles.vitalVal}>{value > 0 ? `${value}%` : '—'}</Text>
    </View>
  );
}

// ── Customize sheet ───────────────────────────────────────────
function CustomizeSheet({ visible, active, onSave, onClose }: {
  visible: boolean; active: SectionId[];
  onSave: (ids: SectionId[]) => void; onClose: () => void;
}) {
  const [local, setLocal] = useState(active);
  useEffect(() => { if (visible) setLocal(active); }, [visible]);

  const toggle = (id: SectionId) => {
    H.tap();
    setLocal(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={cs.backdrop}>
        <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={onClose} />
        <View style={cs.sheet}>
          <View style={cs.handle} />
          <Text style={cs.title}>Customize Dashboard</Text>
          <Text style={cs.sub}>The confession and canon tiles are always pinned at the top.</Text>
          {(Object.entries(SECTION_DEFS) as [SectionId, typeof SECTION_DEFS[SectionId]][]).map(([id, def]) => (
            <TouchableOpacity key={id} style={cs.row} onPress={() => toggle(id)} activeOpacity={0.7}>
              <Text style={cs.rowIcon}>{def.icon}</Text>
              <Text style={cs.rowLabel}>{def.label}</Text>
              <View style={[cs.check, local.includes(id) && cs.checkOn]}>
                {local.includes(id) && <Text style={cs.checkMark}>✓</Text>}
              </View>
            </TouchableOpacity>
          ))}
          <TouchableOpacity style={cs.saveBtn} onPress={() => { H.success(); onSave(local); }}>
            <Text style={cs.saveBtnText}>SAVE LAYOUT</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const cs = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' },
  sheet: { backgroundColor: '#0b1423', borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingHorizontal: 24, paddingBottom: 40, paddingTop: 16 },
  handle: { width: 36, height: 4, backgroundColor: colors.border, borderRadius: 2, alignSelf: 'center', marginBottom: 20 },
  title: { fontFamily: fonts.cormorantMedium, fontSize: 22, color: colors.cream, marginBottom: 4 },
  sub: { fontFamily: fonts.latoLight, fontSize: 12, color: colors.muted, lineHeight: 18, marginBottom: 20 },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.border },
  rowIcon: { fontSize: 16, marginRight: 12, color: colors.muted },
  rowLabel: { fontFamily: fonts.lato, fontSize: 14, color: colors.cream, flex: 1 },
  check: { width: 22, height: 22, borderRadius: 11, borderWidth: 1.5, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  checkOn: { backgroundColor: colors.gold, borderColor: colors.gold },
  checkMark: { fontSize: 12, color: colors.navy, fontFamily: fonts.latoBold },
  saveBtn: { backgroundColor: colors.gold, borderRadius: 10, paddingVertical: 14, alignItems: 'center', marginTop: 24 },
  saveBtnText: { fontFamily: fonts.latoBold, fontSize: 12, color: colors.navy, letterSpacing: 1.5 },
});

// ── Timeline row ──────────────────────────────────────────────
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

// ── Main screen ───────────────────────────────────────────────
export default function DashboardScreen() {
  const router = useRouter();
  const { profile, user, refreshProfile } = useSession();
  const { demoMode, demoRole } = useDemoMode();
  const firstName = profile?.full_name?.split(' ')[0] ?? 'friend';

  const [vitals, setVitals] = useState<number[]>(VITAL_LABELS.map(() => 0));
  const [timeline, setTimeline] = useState<any[]>([]);
  const [focProfile, setFocProfile] = useState<any>(null);
  const [sections, setSections] = useState<SectionId[]>(DEFAULT_SECTIONS);
  const [customizing, setCustomizing] = useState(false);
  const [savingVitals, setSavingVitals] = useState(false);
  const [vitalsError, setVitalsError] = useState('');
  const [showVitalsConsent, setShowVitalsConsent] = useState(false);
  const [settingConsent, setSettingConsent] = useState(false);

  // Auto-show vitals consent modal when congregant has an FOC but hasn't decided yet
  useEffect(() => {
    if (demoMode) return;
    if (profile?.foc_id && profile?.vitals_consent === null) {
      setShowVitalsConsent(true);
    }
  }, [profile?.foc_id, profile?.vitals_consent, demoMode]);

  async function handleVitalsConsent(consent: boolean) {
    if (!user) return;
    setSettingConsent(true);
    await db.setVitalsConsent(user.id, consent);
    await refreshProfile();
    setSettingConsent(false);
    setShowVitalsConsent(false);
  }

  // Wiggle animation for customize mode
  const wiggle = useRef(new Animated.Value(0)).current;
  const wiggleLoop = useRef<Animated.CompositeAnimation | null>(null);

  useEffect(() => {
    loadSections().then(setSections);
    if (demoMode) return;
    loadAll();
  }, [user]);

  // "Canon today" tile — tracks My Spiritual Canon (rule items + today's
  // check-offs). Reloaded on every focus so checking items on the Canon tab
  // reflects here immediately.
  const [canonToday, setCanonToday] = useState<{ done: number; total: number } | null>(null);
  useFocusEffect(useCallback(() => {
    (async () => {
      const [rule, checks] = await Promise.all([loadRule(), loadTodayChecks()]);
      const items = todayItems(rule, new Date());
      const done = items.filter(it => checks.has(`rule_${it.key}`)).length;
      setCanonToday({ done, total: items.length });
    })();
  }, []));

  async function loadAll() {
    if (!user) return;
    const [prog, enc, foc] = await Promise.all([
      db.getAgentProgress(user.id, 'vitals'),
      db.getRecentEncounters(user.id, 4),
      profile?.foc_id ? db.getFocProfile(profile.foc_id) : null,
    ]);
    if (prog) setVitals(VITAL_KEYS.map(k => (prog as any)[k] ?? 0));
    if (enc) setTimeline(enc);
    if (foc) setFocProfile(foc);
  }

  async function saveVitals() {
    if (!user) return;
    setSavingVitals(true);
    setVitalsError('');
    const { error } = await db.upsertAgentProgress({
      user_id: user.id,
      agent_slug: 'vitals',
      payload: Object.fromEntries(VITAL_KEYS.map((k, i) => [k, vitals[i]])),
      updated_at: new Date().toISOString(),
    });
    setSavingVitals(false);
    if (error) {
      setVitalsError('Failed to save — please try again.');
    } else {
      H.success();
    }
  }

  const updateVital = useCallback((i: number, v: number) => {
    setVitals(prev => { const next = [...prev]; next[i] = v; return next; });
  }, []);

  function enterCustomize() {
    H.heavy();
    setCustomizing(true);
    wiggleLoop.current = Animated.loop(Animated.sequence([
      Animated.timing(wiggle, { toValue: 1,    duration: 80, useNativeDriver: true }),
      Animated.timing(wiggle, { toValue: -1,   duration: 80, useNativeDriver: true }),
      Animated.timing(wiggle, { toValue: 0.6,  duration: 80, useNativeDriver: true }),
      Animated.timing(wiggle, { toValue: -0.6, duration: 80, useNativeDriver: true }),
      Animated.timing(wiggle, { toValue: 0,    duration: 80, useNativeDriver: true }),
      Animated.delay(600),
    ]));
    AccessibilityInfo.isReduceMotionEnabled().then(reduced => {
      if (!reduced) wiggleLoop.current?.start();
    });
  }

  function handleSaveSections(ids: SectionId[]) {
    setSections(ids);
    saveSections(ids);
    setCustomizing(false);
  }

  const wiggleStyle = { transform: [{ rotate: wiggle.interpolate({ inputRange: [-1, 0, 1], outputRange: ['-2.5deg', '0deg', '2.5deg'] }) }] };

  const displayVitals = demoMode ? DEMO_VITALS.map(v => v.pct) : vitals;
  const displayTimeline = demoMode ? DEMO_TIMELINE : timeline;

  const role = demoMode ? demoRole : profile?.role;
  const demoDaysSince = 47;

  // Canon tile display state, derived from My Spiritual Canon.
  const canonAllDone = canonToday != null && canonToday.total > 0 && canonToday.done === canonToday.total;
  const canonSet = canonToday != null && canonToday.total > 0;

  const daysSinceConfession = demoMode
    ? demoDaysSince
    : profile?.last_confession_at
      ? Math.floor((Date.now() - new Date(profile.last_confession_at).getTime()) / 86400000)
      : null;

  const confessionStatus = daysSinceConfession === null ? null
    : daysSinceConfession < 30 ? 'recent'
    : daysSinceConfession < 60 ? 'due'
    : 'overdue';
  const statusColor = confessionStatus === 'recent' ? colors.green : confessionStatus === 'overdue' ? colors.red : colors.yellow;
  const statusLabel = confessionStatus === 'recent' ? '✓ Recent'
    : confessionStatus === 'due' ? '⚠ Due'
    : confessionStatus === 'overdue' ? '⚠ Overdue'
    : '— log it';

  const encounterTagMap: Record<string, any> = {
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
            <Text style={styles.subtitle}>{getDashboardSubtitle()}</Text>
            <Text style={styles.greeting}>{firstName}</Text>
          </View>
          <View style={styles.topbarBtns}>
            {role === 'priest' && (
              <TouchableOpacity style={styles.chipBtn} onPress={() => { H.tap(); router.push('/(priest)'); }}>
                <Text style={styles.chipBtnText}>FOC</Text>
              </TouchableOpacity>
            )}
            {role === 'servant' && (
              <TouchableOpacity style={styles.chipBtn} onPress={() => { H.tap(); router.push('/(servant)'); }}>
                <Text style={styles.chipBtnText}>CLASS</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity style={styles.chipBtn} onPress={enterCustomize}>
              <Text style={styles.chipBtnText}>⊞</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.avatarBtn} onPress={() => { H.tap(); router.push('/profile'); }}>
              <Text style={styles.avatarBtnText}>{firstName.charAt(0).toUpperCase()}</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Pinned tile pair — confession + canon */}
        <View style={styles.tileRow}>
          {/* Confession tile */}
          <TouchableOpacity
            style={[styles.tile, { borderColor: confessionStatus && confessionStatus !== 'recent' ? `${statusColor}50` : colors.border }]}
            onPress={() => { H.tap(); router.push('/(tabs)/confession'); }}
            onLongPress={enterCustomize}
            activeOpacity={0.8}
          >
            <Text style={styles.tileIcon}>✝</Text>
            <Text style={styles.tileBigNum}>{daysSinceConfession ?? '—'}</Text>
            <Text style={styles.tileSubLabel}>days since confession</Text>
            <View style={[styles.tileStatus, { backgroundColor: confessionStatus ? `${statusColor}20` : 'transparent' }]}>
              <Text style={[styles.tileStatusText, { color: confessionStatus ? statusColor : colors.muted }]}>{statusLabel}</Text>
            </View>
          </TouchableOpacity>

          {/* Canon tile */}
          <TouchableOpacity
            style={styles.tile}
            onPress={() => { H.tap(); router.push('/(tabs)/canon'); }}
            onLongPress={enterCustomize}
            activeOpacity={0.8}
          >
            <Text style={styles.tileIcon}>📜</Text>
            <Text style={styles.tileBigNum}>
              {canonSet ? `${canonToday!.done}/${canonToday!.total}` : '—'}
            </Text>
            <Text style={styles.tileSubLabel}>canon today</Text>
            <View style={[styles.tileStatus, {
              backgroundColor: canonAllDone ? `${colors.green}20` : `${colors.yellow}20`
            }]}>
              <Text style={[styles.tileStatusText, {
                color: canonAllDone ? colors.green : colors.yellow
              }]}>
                {!canonSet ? '— set up' : canonAllDone ? '✓ All done' : '↑ In progress'}
              </Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* Psalms memorization entry */}
        <TouchableOpacity
          style={{ flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: colors.cardBg, borderWidth: 1, borderColor: colors.border, borderRadius: 14, padding: 16, marginBottom: 20 }}
          onPress={() => { H.tap(); router.push('/psalms'); }}
          activeOpacity={0.85}
        >
          <Text style={{ fontSize: 24 }}>📖</Text>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={{ fontFamily: fonts.latoBold, fontSize: 14, color: colors.cream, marginBottom: 2, flexShrink: 1 }}>Memorize the Psalms</Text>
            <Text style={{ fontFamily: fonts.latoLight, fontSize: 12, color: colors.muted, flexShrink: 1 }}>Agpeya psalter · spaced repetition</Text>
          </View>
          <Text style={{ fontSize: 18, color: colors.gold }}>›</Text>
        </TouchableOpacity>

        {/* Confession CTA banner — only if due or overdue */}
        {(confessionStatus === 'due' || confessionStatus === 'overdue') && (
          <TouchableOpacity
            style={styles.banner}
            onPress={() => { H.tap(); router.push('/(tabs)/confession'); }}
            activeOpacity={0.85}
          >
            <Text style={styles.bannerCross}>✝</Text>
            <Text style={styles.bannerLabel}>PREPARE</Text>
            <Text style={styles.bannerTitle}>Examination of Conscience</Text>
            <Text style={styles.bannerBody}>
              {demoMode
                ? `Fr. Bishoy has confession hours this Sunday. You last confessed ${demoDaysSince} days ago.`
                : `You last confessed ${daysSinceConfession} days ago. Use the Confession tab to prepare before your next meeting.`}
            </Text>
            <View style={styles.bannerArrow}><Text style={styles.bannerArrowText}>Begin →</Text></View>
          </TouchableOpacity>
        )}

        {/* Customizable sections */}
        {sections.includes('vitals') && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Spiritual Vitals</Text>
              {!demoMode && (
                <TouchableOpacity onPress={saveVitals} disabled={savingVitals}>
                  <Text style={[styles.sectionAction, vitalsError ? { color: colors.red } : {}]}>
                    {savingVitals ? 'Saving…' : vitalsError ? 'Error — retry' : 'Save'}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
            {!demoMode && profile?.foc_id && profile?.vitals_consent === false && (
              <TouchableOpacity style={styles.vitalNudge} onPress={() => setShowVitalsConsent(true)} activeOpacity={0.8}>
                <Text style={styles.vitalNudgeText}>
                  ◇ Your FOC can't see your vitals yet. Sharing helps him guide you better.{' '}
                  <Text style={styles.vitalNudgeLink}>Turn on sharing →</Text>
                </Text>
              </TouchableOpacity>
            )}
            {VITAL_LABELS.map((label, i) => (
              <VitalRow
                key={i}
                label={label}
                value={displayVitals[i] ?? 0}
                onChange={v => updateVital(i, v)}
                last={i === VITAL_LABELS.length - 1}
              />
            ))}
            <PrivacyNote text="Self-reported. Visible only to you and your Father of Confession." />
          </View>
        )}

        {sections.includes('journey') && (
          <Card title="Pastoral Journey" titleIcon="◎" action={<Text style={styles.cardAction}>View all</Text>}>
            {demoMode ? (
              DEMO_TIMELINE.map((item, i) => (
                <TimelineRow key={i} item={item} last={i === DEMO_TIMELINE.length - 1} />
              ))
            ) : displayTimeline.length === 0 ? (
              <Text style={styles.emptyInline}>Your encounters with your FOC will appear here.</Text>
            ) : (
              displayTimeline.map((enc, i) => {
                const meta = encounterTagMap[enc.encounter_type] ?? encounterTagMap.advice;
                const item = {
                  date: new Date(enc.encountered_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).toUpperCase(),
                  title: meta.tag.replace(/^[^\s]+\s/, ''),
                  body: enc.member_note ?? '',
                  ...meta,
                };
                return <TimelineRow key={i} item={item} last={i === displayTimeline.length - 1} />;
              })
            )}
          </Card>
        )}

        {sections.includes('feasts') && (
          <Card title="Upcoming Feasts" titleIcon="⊕">
            {FEASTS.map((feast, i) => (
              <View key={i} style={[styles.feastItem, i < FEASTS.length - 1 && styles.feastBorder]}>
                <View style={styles.feastDate}>
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
        )}

        {sections.includes('foc') && (
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
                <TouchableOpacity style={styles.scheduleChip} onPress={() => { H.tap(); router.push('/(tabs)/confession'); }} activeOpacity={0.8}>
                  <Text style={styles.scheduleIcon}>✝</Text>
                  <View>
                    <Text style={styles.scheduleText}>Request Confession Appointment</Text>
                    <Text style={styles.scheduleSub}>Next available: Sunday after Liturgy</Text>
                  </View>
                </TouchableOpacity>
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
                <TouchableOpacity style={styles.scheduleChip} onPress={() => { H.tap(); router.push('/(tabs)/confession'); }} activeOpacity={0.8}>
                  <Text style={styles.scheduleIcon}>✝</Text>
                  <View>
                    <Text style={styles.scheduleText}>Begin Confession Examination</Text>
                    <Text style={styles.scheduleSub}>Prepare before your next meeting</Text>
                  </View>
                </TouchableOpacity>
              </>
            ) : (
              <Text style={styles.emptyInline}>Your Father of Confession will link your account when they set up their Poimen profile.</Text>
            )}
          </Card>
        )}

      </ScrollView>

      {/* Vitals consent modal */}
      <Modal visible={showVitalsConsent} transparent animationType="fade" onRequestClose={() => {}}>
        <View style={styles.consentModalBg}>
          <View style={styles.consentModal}>
            <Text style={styles.consentCross}>✝</Text>
            <Text style={styles.consentTitle}>Share Your Vitals?</Text>
            <Text style={styles.consentSub}>with {focProfile?.full_name ?? 'your Father of Confession'}</Text>
            <Text style={styles.consentBody}>
              Sharing your spiritual vitals lets your FOC understand how you're doing and guide you more intentionally between confessions. You can change this at any time in your profile.
            </Text>
            <TouchableOpacity
              style={[styles.consentGoldBtn, settingConsent && { opacity: 0.6 }]}
              onPress={() => handleVitalsConsent(true)}
              disabled={settingConsent}
              activeOpacity={0.85}
            >
              <Text style={styles.consentGoldBtnText}>
                {settingConsent ? 'Saving…' : 'SHARE WITH MY FOC'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => handleVitalsConsent(false)} disabled={settingConsent}>
              <Text style={styles.consentSkipText}>Keep private for now</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Customize sheet */}
      <CustomizeSheet
        visible={customizing}
        active={sections}
        onSave={handleSaveSections}
        onClose={() => { wiggleLoop.current?.stop(); wiggle.setValue(0); setCustomizing(false); }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.navy },
  scroll: { flex: 1 },
  content: { padding: 20, paddingBottom: 48 },

  topbar: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20 },
  topbarBtns: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  chipBtn: { borderWidth: 1, borderColor: colors.border, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8 },
  chipBtnText: { fontFamily: fonts.latoBold, fontSize: 10, color: colors.muted, letterSpacing: 1 },
  avatarBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: colors.goldDim, borderWidth: 1, borderColor: colors.gold, alignItems: 'center', justifyContent: 'center' },
  avatarBtnText: { fontFamily: fonts.cormorantMedium, fontSize: 16, color: colors.goldLight },
  subtitle: { fontFamily: fonts.latoBold, fontSize: 9, letterSpacing: 2, textTransform: 'uppercase', color: colors.gold, opacity: 0.7, marginBottom: 4 },
  greeting: { fontFamily: fonts.cormorantMedium, fontSize: 30, color: colors.cream, lineHeight: 36 },

  // Tile pair
  tileRow: { flexDirection: 'row', gap: 8, marginBottom: 20 },
  tile: {
    width: TILE_W, height: 138, backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1, borderColor: colors.border, borderRadius: 16,
    padding: 14, justifyContent: 'space-between',
  },
  tileIcon: { fontSize: 18 },
  tileBigNum: { fontFamily: fonts.cormorantMedium, fontSize: 34, color: colors.cream, lineHeight: 38, marginTop: 4 },
  tileSubLabel: { fontFamily: fonts.latoLight, fontSize: 10, color: colors.muted, lineHeight: 14, marginTop: -2 },
  tileStatus: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20, alignSelf: 'flex-start' },
  tileStatusText: { fontFamily: fonts.latoBold, fontSize: 9, letterSpacing: 0.5 },

  // Confession CTA banner
  banner: {
    backgroundColor: 'rgba(201,168,76,0.07)', borderWidth: 1,
    borderColor: 'rgba(201,168,76,0.25)', borderRadius: 14, padding: 18,
    marginBottom: 20, overflow: 'hidden', position: 'relative',
  },
  bannerCross: { position: 'absolute', right: 12, top: 6, fontSize: 52, color: 'rgba(201,168,76,0.07)', fontFamily: fonts.cormorant },
  bannerLabel: { fontFamily: fonts.latoBold, fontSize: 9, letterSpacing: 2.5, color: colors.gold, marginBottom: 4 },
  bannerTitle: { fontFamily: fonts.cormorantMedium, fontSize: 19, color: colors.cream, marginBottom: 6 },
  bannerBody: { fontFamily: fonts.latoLight, fontSize: 13, color: colors.muted, lineHeight: 20, maxWidth: '88%' },
  bannerArrow: { marginTop: 12 },
  bannerArrowText: { fontFamily: fonts.latoBold, fontSize: 11, color: colors.gold, letterSpacing: 0.5 },

  // Sections
  section: { marginBottom: 24 },
  sectionHeader: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 16 },
  sectionTitle: { fontFamily: fonts.cormorantItalic, fontSize: 18, color: colors.cream },
  sectionAction: { fontFamily: fonts.latoBold, fontSize: 11, color: colors.gold },

  // Vital drag rows
  vitalRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  vitalLabel: { fontFamily: fonts.latoLight, fontSize: 12, color: colors.muted, flex: 1 },
  vitalTrack: { width: 80, height: 18, justifyContent: 'center', flexShrink: 0 },
  vitalFill: { height: 4, backgroundColor: colors.gold, borderRadius: 4 },
  vitalThumb: {
    position: 'absolute', width: 10, height: 10, borderRadius: 5,
    backgroundColor: colors.gold, borderWidth: 2, borderColor: colors.navy,
    top: 4,
  },
  vitalVal: { fontFamily: fonts.latoBold, fontSize: 12, color: colors.cream, width: 34, textAlign: 'right' },

  // Vitals nudge banner
  vitalNudge: {
    backgroundColor: 'rgba(201,168,76,0.07)', borderWidth: 1,
    borderColor: 'rgba(201,168,76,0.2)', borderRadius: 10,
    padding: 12, marginBottom: 14,
  },
  vitalNudgeText: { fontFamily: fonts.latoLight, fontSize: 12, color: colors.muted, lineHeight: 18 },
  vitalNudgeLink: { fontFamily: fonts.latoBold, color: colors.gold },

  // Vitals consent modal
  consentModalBg: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.72)',
    alignItems: 'center', justifyContent: 'center', padding: 24,
  },
  consentModal: {
    backgroundColor: '#0b1423', borderWidth: 1, borderColor: 'rgba(201,168,76,0.25)',
    borderRadius: 20, padding: 28, alignItems: 'center', width: '100%', maxWidth: 360,
  },
  consentCross: { fontSize: 32, color: colors.gold, marginBottom: 12 },
  consentTitle: { fontFamily: fonts.cormorantMedium, fontSize: 24, color: colors.cream, textAlign: 'center', marginBottom: 4 },
  consentSub: { fontFamily: fonts.latoLight, fontSize: 12, color: colors.gold, textAlign: 'center', marginBottom: 16, opacity: 0.85 },
  consentBody: { fontFamily: fonts.latoLight, fontSize: 13, color: colors.muted, textAlign: 'center', lineHeight: 20, marginBottom: 24 },
  consentGoldBtn: {
    backgroundColor: colors.gold, borderRadius: 10,
    paddingVertical: 14, paddingHorizontal: 24, width: '100%', alignItems: 'center', marginBottom: 16,
  },
  consentGoldBtnText: { fontFamily: fonts.latoBold, fontSize: 12, color: colors.navy, letterSpacing: 1.5 },
  consentSkipText: { fontFamily: fonts.latoLight, fontSize: 13, color: colors.muted, textDecorationLine: 'underline' },

  cardAction: { fontFamily: fonts.lato, fontSize: 11, color: colors.gold },
  emptyInline: { fontFamily: fonts.latoLight, fontSize: 12, color: colors.muted, lineHeight: 18, opacity: 0.7 },

  // Timeline
  tlRow: { flexDirection: 'row', gap: 14 },
  tlDotCol: { alignItems: 'center', width: 14 },
  tlDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.gold, marginTop: 4 },
  tlDotDim: { backgroundColor: colors.muted },
  tlLine: { width: 1, flex: 1, backgroundColor: colors.border, marginTop: 4 },
  tlBodyCol: { flex: 1, paddingBottom: 4 },
  tlDate: { fontFamily: fonts.latoBold, fontSize: 9, letterSpacing: 1.5, color: colors.gold, opacity: 0.7, marginBottom: 3 },
  tlTitle: { fontFamily: fonts.latoBold, fontSize: 13, color: colors.cream, marginBottom: 2 },
  tlBody: { fontFamily: fonts.latoLight, fontSize: 12, color: colors.muted, lineHeight: 18 },
  tlTag: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 20, alignSelf: 'flex-start', marginTop: 6 },
  tlTagText: { fontFamily: fonts.latoBold, fontSize: 10, letterSpacing: 0.5 },

  // Feasts
  feastItem: { flexDirection: 'row', gap: 14, paddingVertical: 12, alignItems: 'flex-start' },
  feastBorder: { borderBottomWidth: 1, borderBottomColor: colors.border },
  feastDate: { backgroundColor: colors.goldDim, borderWidth: 1, borderColor: colors.border, borderRadius: 8, paddingVertical: 6, paddingHorizontal: 8, alignItems: 'center', minWidth: 42 },
  feastMonth: { fontFamily: fonts.latoBold, fontSize: 9, letterSpacing: 1, color: colors.gold },
  feastDay: { fontFamily: fonts.cormorantMedium, fontSize: 22, color: colors.cream, lineHeight: 26 },
  feastTitle: { fontFamily: fonts.latoBold, fontSize: 13, color: colors.cream, marginBottom: 2 },
  feastDesc: { fontFamily: fonts.latoLight, fontSize: 11, color: colors.muted, lineHeight: 16 },

  // FOC
  focRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14 },
  focAvatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#2c4a7c', borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  focAvatarText: { fontFamily: fonts.cormorantMedium, fontSize: 16, color: colors.cream },
  focName: { fontFamily: fonts.latoBold, fontSize: 14, color: colors.cream },
  focChurch: { fontFamily: fonts.latoLight, fontSize: 11, color: colors.muted },
  scheduleChip: { flexDirection: 'row', gap: 10, backgroundColor: colors.goldDim, borderWidth: 1, borderColor: colors.border, borderRadius: 10, padding: 12, alignItems: 'center' },
  scheduleIcon: { fontSize: 18 },
  scheduleText: { fontFamily: fonts.latoBold, fontSize: 12, color: colors.cream },
  scheduleSub: { fontFamily: fonts.latoLight, fontSize: 11, color: colors.muted, marginTop: 1 },
});
