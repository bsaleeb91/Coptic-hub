import React, { useState, useEffect, useRef } from 'react';
import {
  ScrollView, View, Text, StyleSheet, TouchableOpacity,
  Animated, PanResponder, Alert, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Circle } from 'react-native-svg';
import { colors, fonts } from '@/lib/theme';
import { Card } from '@/components/ui/Card';
import { PrivacyNote } from '@/components/ui/PrivacyNote';
import { useSession } from '@/lib/auth';
import * as db from '@/lib/db';
import { useDemoMode } from '@/lib/demo';

// ── Progress ring ────────────────────────────────────────────
const RING_RADIUS = 22;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

function ProgressRing({ pct }: { pct: number }) {
  const offset = RING_CIRCUMFERENCE * (1 - pct / 100);
  return (
    <View style={styles.ring}>
      <Svg width={56} height={56} viewBox="0 0 56 56" style={{ transform: [{ rotate: '-90deg' }] }}>
        <Circle cx={28} cy={28} r={RING_RADIUS} stroke="rgba(245,240,232,0.08)" strokeWidth={4} fill="none" />
        <Circle cx={28} cy={28} r={RING_RADIUS} stroke={colors.gold} strokeWidth={4} fill="none"
          strokeDasharray={`${RING_CIRCUMFERENCE}`} strokeDashoffset={offset} strokeLinecap="round" />
      </Svg>
      <View style={styles.ringCenter}>
        <Text style={styles.ringPct}>{pct}%</Text>
      </View>
    </View>
  );
}

// ── Demo data ────────────────────────────────────────────────
const DEMO_COMPONENTS = [
  { id: 'c1', icon: '📖', name: 'Daily Psalm Reading', freq: 'DAILY', desc: 'Read one Psalm slowly, with reflection. Today: Psalm 18.', done: true },
  { id: 'c2', icon: '🙏', name: 'Morning Prostrations', freq: 'DAILY', desc: '12 prostrations upon waking, with the prayer of St. Ephrem.', done: true },
  { id: 'c3', icon: '✝', name: 'Psalm 50 Before Sleep', freq: 'DAILY', desc: 'Recite Psalm 50 as the last prayer before sleeping.', done: false },
  { id: 'c4', icon: '🕯', name: 'Vespers Attendance', freq: 'WEEKLY', desc: 'Attend Saturday Vespers or Tasbeha when available.', done: false },
];

const DEMO_HISTORY = [
  { id: 'h1', component: 'Great Lent Canon', start_date: '2026-03-01', end_date: '2026-04-19', pct: 84, active: false },
  { id: 'h2', component: 'New Year Canon', start_date: '2026-01-07', end_date: '2026-03-01', pct: 72, active: false },
];

// ── Swipeable canon component row ────────────────────────────
function SwipeableComponent({ comp, done, onToggle }: {
  comp: any; done: boolean; onToggle: () => void;
}) {
  return (
    <View style={[styles.compItem, done && styles.compItemDone]}>
      <View style={styles.compHeader}>
        <TouchableOpacity onPress={onToggle}>
          <View style={[styles.compCheck, done && styles.compCheckDone]}>
            {done && <Text style={styles.compCheckMark}>✓</Text>}
          </View>
        </TouchableOpacity>
        <View style={styles.compIcon}>
          <Text style={styles.compIconEmoji}>{comp.icon ?? '📜'}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.compName, done && styles.compNameDone]}>{comp.name ?? comp.component}</Text>
          <View style={styles.compMeta}>
            <Text style={[styles.compFreq, comp.frequency === 'Weekly' || comp.freq === 'WEEKLY' ? { color: colors.green } : { color: colors.blue }]}>
              {(comp.freq ?? comp.frequency ?? 'DAILY').toUpperCase()}
            </Text>
            <Text style={styles.compStatus}>{done ? '✓ Done today' : 'Pending'}</Text>
          </View>
        </View>
        {comp.desc || comp.reflection_prompt ? (
          <Text style={styles.compDesc} numberOfLines={2}>{comp.desc ?? comp.reflection_prompt}</Text>
        ) : null}
      </View>
    </View>
  );
}

// ── Swipeable history row ─────────────────────────────────────
function SwipeableHistoryRow({ item, onDelete }: { item: any; onDelete: () => void }) {
  const translateX = useRef(new Animated.Value(0)).current;
  const ACTION_WIDTH = 70;

  const panResponder = useRef(PanResponder.create({
    onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 8 && Math.abs(g.dy) < 20,
    onPanResponderMove: (_, g) => { if (g.dx < 0) translateX.setValue(Math.max(g.dx, -ACTION_WIDTH)); },
    onPanResponderRelease: (_, g) => {
      if (g.dx < -ACTION_WIDTH / 2) Animated.spring(translateX, { toValue: -ACTION_WIDTH, useNativeDriver: true }).start();
      else Animated.spring(translateX, { toValue: 0, useNativeDriver: true }).start();
    },
  })).current;

  function close() { Animated.spring(translateX, { toValue: 0, useNativeDriver: true }).start(); }

  const pct = item.pct ?? 0;
  const startFmt = item.start_date ? new Date(item.start_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '';
  const endFmt = item.end_date ? new Date(item.end_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Ongoing';

  return (
    <View style={styles.swipeContainer}>
      <View style={styles.swipeActions}>
        <TouchableOpacity style={styles.swipeActionDelete} onPress={() => { close(); onDelete(); }}>
          <Text style={styles.swipeActionText}>✕{'\n'}Delete</Text>
        </TouchableOpacity>
      </View>
      <Animated.View style={{ transform: [{ translateX }] }} {...panResponder.panHandlers}>
        <View style={styles.histItem}>
          <View style={styles.histTop}>
            <Text style={styles.histTitle}>{item.component ?? item.title}</Text>
            <View style={[styles.histBadge, pct >= 80 ? styles.badgeGreen : styles.badgeMuted]}>
              <Text style={[styles.histBadgeText, { color: pct >= 80 ? colors.green : colors.muted }]}>
                {pct >= 80 ? '✓ Completed' : 'Partial'}
              </Text>
            </View>
          </View>
          <Text style={styles.histDates}>{startFmt}{endFmt ? ` – ${endFmt}` : ''}</Text>
          <View style={styles.histBarRow}>
            <View style={styles.histBarTrack}>
              <View style={[styles.histBarFill, { width: `${pct}%` as any }]} />
            </View>
            <Text style={styles.histPct}>{pct}%</Text>
          </View>
        </View>
      </Animated.View>
    </View>
  );
}

// ── Screen ───────────────────────────────────────────────────
export default function CanonScreen() {
  const { user } = useSession();
  const { demoMode } = useDemoMode();
  const [components, setComponents] = useState<any[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(!demoMode);

  useEffect(() => {
    if (demoMode) {
      setComponents(DEMO_COMPONENTS);
      setChecked(new Set(DEMO_COMPONENTS.filter(c => c.done).map(c => c.id)));
      setHistory(DEMO_HISTORY);
    } else {
      load();
    }
  }, [user]);

  async function load() {
    if (!user) return;
    setLoading(true);
    const active = await db.getActiveCanons(user.id);
    const past = await db.getInactiveCanons(user.id);

    if (active) setComponents(active);
    if (past) {
      const withPct = await Promise.all(past.map(async (c) => {
        const count = await db.countCanonCompletions(c.id);
        const start = new Date(c.start_date).getTime();
        const end = c.end_date ? new Date(c.end_date).getTime() : Date.now();
        const durationDays = Math.max(Math.round((end - start) / 86400000), 1);
        return { ...c, pct: Math.min(Math.round((count / durationDays) * 100), 100) };
      }));
      setHistory(withPct);
    }
    setLoading(false);
  }

  async function toggleCheck(id: string) {
    setChecked(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
    if (!demoMode && user) {
      const today = new Date().toISOString().split('T')[0];
      await db.upsertCanonCompletion(id, user.id, today);
    }
  }

  function deleteHistory(id: string) {
    Alert.alert('Remove', 'Remove this canon from history?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => setHistory(prev => prev.filter(h => h.id !== id)) },
    ]);
  }

  const completedCount = checked.size;
  const total = components.length || 1;
  const pct = Math.round((completedCount / total) * 100);

  const activeCanon = demoMode
    ? { label: 'ACTIVE CANON · ASSIGNED MAY 21', title: '40-Day Psalm & Prostration Plan', meta: 'Assigned after Holy Confession · Fr. Bishoy Marcos · Day 18 of 40' }
    : components.length > 0
    ? { label: `ACTIVE CANON · ${components.length} COMPONENT${components.length !== 1 ? 'S' : ''}`, title: 'Spiritual Canon', meta: 'Assigned by your Father of Confession' }
    : null;

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>

        <Text style={styles.pageTitle}>Spiritual Canon</Text>
        <Text style={styles.pageSubtitle}>A remedy for the soul, not a task list</Text>

        {/* Status bar */}
        {activeCanon ? (
          <View style={styles.statusBar}>
            <Text style={styles.statusBarDecor}>✦</Text>
            <Text style={styles.statusIcon}>📜</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.statusLabel}>{activeCanon.label}</Text>
              <Text style={styles.statusTitle}>{activeCanon.title}</Text>
              <Text style={styles.statusMeta}>{activeCanon.meta}</Text>
            </View>
            <ProgressRing pct={pct} />
          </View>
        ) : !demoMode ? (
          <View style={styles.emptyBanner}>
            <Text style={styles.emptyBannerTitle}>No active canon yet</Text>
            <Text style={styles.emptyBannerBody}>Your Father of Confession will assign a spiritual canon after your next confession. It will appear here.</Text>
          </View>
        ) : null}

        {/* Today's Canon */}
        <Card title="Today's Canon" titleIcon="◈">
          {loading ? (
            <ActivityIndicator color={colors.gold} style={{ paddingVertical: 20 }} />
          ) : components.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyIcon}>📜</Text>
              <Text style={styles.emptyTitle}>No canon components yet</Text>
              <Text style={styles.emptyBody}>Your Father of Confession will assign components after your next meeting.</Text>
            </View>
          ) : (
            components.map((comp, i) => (
              <View key={comp.id} style={i < components.length - 1 ? { marginBottom: 10 } : {}}>
                <SwipeableComponent
                  comp={comp}
                  done={checked.has(comp.id)}
                  onToggle={() => toggleCheck(comp.id)}
                />
              </View>
            ))
          )}
        </Card>

        {/* Communion Readiness */}
        <Card title="Communion Readiness" titleIcon="✝">
          {demoMode ? (
            <>
              <View style={styles.readinessCard}>
                <Text style={styles.readinessLabel}>CURRENT STATUS</Text>
                <Text style={styles.readinessStatus}>⚠ Confession recommended</Text>
                <Text style={styles.readinessBody}>
                  It has been 47 days since your last confession. Consider scheduling with Fr. Bishoy before receiving Holy Communion.
                </Text>
              </View>
              <View style={styles.divider} />
              <View>
                <Text style={styles.readinessLabel}>NEXT DIVINE LITURGY</Text>
                <Text style={styles.liturgyVal}>Sunday, June 8 · 8:00 AM</Text>
                <Text style={styles.liturgySub}>St. Mary's Coptic Orthodox Church</Text>
              </View>
            </>
          ) : (
            <View style={styles.emptyState}>
              <Text style={styles.emptyIcon}>✝</Text>
              <Text style={styles.emptyTitle}>Readiness based on your data</Text>
              <Text style={styles.emptyBody}>Once your confession history and canon progress are recorded, readiness guidance will appear here.</Text>
            </View>
          )}
          <PrivacyNote text="Communion readiness is based on your confession date and fasting observance. Your Father of Confession may adjust this guidance." />
        </Card>

        {/* Canon History */}
        {history.length > 0 && (
          <Card title={`Canon History (${history.length})`} titleIcon="◎">
            {history.map((item, i) => (
              <View key={item.id}>
                <SwipeableHistoryRow item={item} onDelete={() => deleteHistory(item.id)} />
                {i < history.length - 1 && <View style={styles.divider} />}
              </View>
            ))}
          </Card>
        )}

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.navy },
  scroll: { flex: 1 },
  content: { padding: 20, paddingBottom: 40 },

  pageTitle: { fontFamily: fonts.cormorantMedium, fontSize: 28, color: colors.cream, marginBottom: 4 },
  pageSubtitle: { fontFamily: fonts.latoLight, fontSize: 12, color: colors.muted, marginBottom: 20, fontStyle: 'italic' },

  statusBar: { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: 'rgba(201,168,76,0.11)', borderWidth: 1, borderColor: 'rgba(201,168,76,0.32)', borderRadius: 12, padding: 18, marginBottom: 20, position: 'relative', overflow: 'hidden' },
  statusBarDecor: { position: 'absolute', right: 16, fontSize: 52, color: 'rgba(201,168,76,0.06)', fontFamily: fonts.cormorant },
  statusIcon: { fontSize: 28, flexShrink: 0 },
  statusLabel: { fontFamily: fonts.latoBold, fontSize: 10, letterSpacing: 2, textTransform: 'uppercase', color: colors.gold, marginBottom: 3 },
  statusTitle: { fontFamily: fonts.cormorantMedium, fontSize: 18, color: colors.cream, marginBottom: 2 },
  statusMeta: { fontFamily: fonts.latoLight, fontSize: 11, color: colors.muted },

  ring: { width: 56, height: 56, flexShrink: 0, position: 'relative' },
  ringCenter: { position: 'absolute', inset: 0, alignItems: 'center', justifyContent: 'center' },
  ringPct: { fontFamily: fonts.latoBold, fontSize: 12, color: colors.cream },

  emptyBanner: { backgroundColor: colors.cardBg, borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 18, marginBottom: 20 },
  emptyBannerTitle: { fontFamily: fonts.cormorantMedium, fontSize: 18, color: colors.cream, marginBottom: 6 },
  emptyBannerBody: { fontFamily: fonts.latoLight, fontSize: 12, color: colors.muted, lineHeight: 18 },

  compItem: { backgroundColor: 'rgba(10,16,30,0.5)', borderWidth: 1, borderColor: colors.border, borderRadius: 12, overflow: 'hidden' },
  compItemDone: { opacity: 0.65 },
  compHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 13 },
  compCheck: { width: 22, height: 22, borderRadius: 11, borderWidth: 1.5, borderColor: colors.border, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  compCheckDone: { backgroundColor: colors.gold, borderColor: colors.gold },
  compCheckMark: { fontSize: 12, color: colors.navy, fontWeight: '700' },
  compIcon: { width: 32, height: 32, borderRadius: 8, backgroundColor: colors.goldDim, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  compIconEmoji: { fontSize: 16 },
  compName: { fontFamily: fonts.latoBold, fontSize: 13, color: colors.cream, marginBottom: 2 },
  compNameDone: { textDecorationLine: 'line-through' },
  compMeta: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  compFreq: { fontFamily: fonts.latoBold, fontSize: 10, letterSpacing: 0.8 },
  compStatus: { fontFamily: fonts.latoLight, fontSize: 10, color: colors.muted },
  compDesc: { fontFamily: fonts.latoLight, fontSize: 11, color: colors.muted, maxWidth: 90, textAlign: 'right', lineHeight: 15 },

  readinessCard: { backgroundColor: 'rgba(10,16,30,0.5)', borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 14, marginBottom: 12 },
  readinessLabel: { fontFamily: fonts.latoBold, fontSize: 10, letterSpacing: 2, textTransform: 'uppercase', color: colors.gold, opacity: 0.8, marginBottom: 6 },
  readinessStatus: { fontFamily: fonts.cormorantMedium, fontSize: 18, color: colors.yellow, marginBottom: 5 },
  readinessBody: { fontFamily: fonts.latoLight, fontSize: 12, color: colors.muted, lineHeight: 18 },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: 12 },
  liturgyVal: { fontFamily: fonts.latoBold, fontSize: 13, color: colors.cream, marginTop: 4 },
  liturgySub: { fontFamily: fonts.latoLight, fontSize: 11, color: colors.muted, marginTop: 2 },

  swipeContainer: { position: 'relative', overflow: 'hidden' },
  swipeActions: { position: 'absolute', right: 0, top: 0, bottom: 0, flexDirection: 'row' },
  swipeActionDelete: { width: 70, backgroundColor: 'rgba(192,57,43,0.25)', alignItems: 'center', justifyContent: 'center' },
  swipeActionText: { fontFamily: fonts.latoBold, fontSize: 10, color: colors.cream, textAlign: 'center', letterSpacing: 0.5 },

  histItem: { paddingVertical: 14, backgroundColor: colors.navyMid },
  histTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 4 },
  histTitle: { fontFamily: fonts.latoBold, fontSize: 13, color: colors.cream, flex: 1 },
  histBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 20 },
  badgeGreen: { backgroundColor: colors.greenBg },
  badgeMuted: { backgroundColor: 'rgba(245,240,232,0.07)' },
  histBadgeText: { fontFamily: fonts.latoBold, fontSize: 10 },
  histDates: { fontFamily: fonts.latoLight, fontSize: 10, color: colors.muted, marginBottom: 8 },
  histBarRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  histBarTrack: { flex: 1, height: 3, backgroundColor: 'rgba(245,240,232,0.07)', borderRadius: 3, overflow: 'hidden' },
  histBarFill: { height: '100%', backgroundColor: colors.gold, borderRadius: 3 },
  histPct: { fontFamily: fonts.latoBold, fontSize: 11, color: colors.goldLight },

  emptyState: { alignItems: 'center', paddingVertical: 20, gap: 6 },
  emptyIcon: { fontSize: 28, color: colors.muted, opacity: 0.4 },
  emptyTitle: { fontFamily: fonts.latoBold, fontSize: 13, color: colors.muted },
  emptyBody: { fontFamily: fonts.latoLight, fontSize: 11, color: colors.muted, textAlign: 'center', lineHeight: 17, opacity: 0.7 },
});
