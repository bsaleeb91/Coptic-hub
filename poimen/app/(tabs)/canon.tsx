import React, { useState, useEffect, useRef } from 'react';
import {
  ScrollView, View, Text, StyleSheet, TouchableOpacity, ActivityIndicator,
  Animated, PanResponder,
} from 'react-native';
import * as H from '@/lib/haptics';
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

// ── Swipeable canon row — swipe right to complete / undo ─────
const REVEAL_W = 72;
const THRESHOLD = REVEAL_W * 0.55;

function SwipeableCanonRow({ comp, done, onToggle }: {
  comp: any; done: boolean; onToggle: () => void;
}) {
  const tx = useRef(new Animated.Value(0)).current;
  const doneRef = useRef(done);
  const onToggleRef = useRef(onToggle);
  useEffect(() => { doneRef.current = done; }, [done]);
  useEffect(() => { onToggleRef.current = onToggle; }, [onToggle]);

  const springBack = () => Animated.spring(tx, { toValue: 0, useNativeDriver: true, tension: 100, friction: 10 }).start();

  const pan = useRef(PanResponder.create({
    onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 6 && Math.abs(g.dy) < 16,
    onPanResponderMove: (_, g) => {
      // Only allow swipe right (positive dx)
      if (g.dx > 0) tx.setValue(Math.min(g.dx, REVEAL_W + 10));
    },
    onPanResponderRelease: (_, g) => {
      if (g.dx > THRESHOLD) {
        // Snap to reveal, fire toggle, then spring back
        Animated.spring(tx, { toValue: REVEAL_W, useNativeDriver: true, tension: 120, friction: 10 }).start(() => {
          doneRef.current ? H.tap() : H.done();
          onToggleRef.current();
          setTimeout(springBack, 420);
        });
      } else {
        springBack();
      }
    },
    onPanResponderTerminate: springBack,
  })).current;

  const isWeekly = comp.frequency === 'Weekly' || comp.freq === 'WEEKLY';

  return (
    <View style={styles.swipeOuter}>
      {/* Action revealed behind */}
      <View style={[styles.swipeAction, { backgroundColor: done ? 'rgba(149,165,166,0.2)' : `${colors.green}30` }]}>
        <Text style={[styles.swipeActionText, { color: done ? colors.muted : colors.green }]}>
          {done ? '↩ Undo' : '✓ Done'}
        </Text>
      </View>

      {/* Row sliding over it */}
      <Animated.View style={[styles.compItem, done && styles.compItemDone, { transform: [{ translateX: tx }] }]} {...pan.panHandlers}>
        <TouchableOpacity style={styles.compHeader} onPress={() => { done ? H.tap() : H.done(); onToggle(); }} activeOpacity={0.85}>
          <View style={[styles.compCheck, done && styles.compCheckDone]}>
            {done && <Text style={styles.compCheckMark}>✓</Text>}
          </View>
          <View style={styles.compIcon}>
            <Text style={styles.compIconEmoji}>{comp.icon ?? '📜'}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.compName, done && styles.compNameDone]}>{comp.name ?? comp.component}</Text>
            <View style={styles.compMeta}>
              <Text style={[styles.compFreq, isWeekly ? { color: colors.green } : { color: colors.blue }]}>
                {(comp.freq ?? comp.frequency ?? 'DAILY').toUpperCase()}
              </Text>
              <Text style={styles.compStatus}>{done ? '✓ Done today' : '← swipe'}</Text>
            </View>
          </View>
          {comp.desc || comp.reflection_prompt ? (
            <Text style={styles.compDesc} numberOfLines={2}>{comp.desc ?? comp.reflection_prompt}</Text>
          ) : null}
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
}

// ── Readiness indicator ──────────────────────────────────────
function ReadinessIndicator({ daysSince }: { daysSince: number }) {
  const state = daysSince < 30
    ? { icon: '✓', label: 'Ready', body: `${daysSince} days since confession. You are in good standing for Holy Communion.`, color: colors.green }
    : daysSince < 60
    ? { icon: '⚠', label: 'Check required', body: `${daysSince} days since your last confession. Consider scheduling before your next Communion.`, color: colors.yellow }
    : { icon: '✝', label: 'Confession needed', body: `${daysSince} days since confession. Confession is strongly recommended before receiving Holy Communion.`, color: colors.red };

  return (
    <View style={[styles.readinessRow, { borderColor: `${state.color}33` }]}>
      <Text style={[styles.readinessIcon, { color: state.color }]}>{state.icon}</Text>
      <View style={{ flex: 1 }}>
        <Text style={[styles.readinessStatus, { color: state.color }]}>{state.label}</Text>
        <Text style={styles.readinessBody}>{state.body}</Text>
      </View>
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
      const { error } = await db.upsertCanonCompletion(id, user.id, today);
      if (error) {
        // Revert the optimistic toggle — the save didn't actually persist.
        setChecked(prev => {
          const next = new Set(prev);
          next.has(id) ? next.delete(id) : next.add(id);
          return next;
        });
      }
    }
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
        <Card title="Today's Canon" flat>
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
                <SwipeableCanonRow
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
            <ReadinessIndicator daysSince={47} />
          ) : (
            <View style={styles.emptyState}>
              <Text style={styles.emptyBody}>Once your confession history is recorded, readiness guidance will appear here.</Text>
            </View>
          )}
          <PrivacyNote text="Based on your confession date. Your Father of Confession may adjust this guidance." />
        </Card>

        {/* Canon History */}
        {history.length > 0 && (
          <Card title={`Past Canons (${history.length})`} flat>
            {history.map((item, i) => {
              const pct = item.pct ?? 0;
              const startFmt = item.start_date ? new Date(item.start_date).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) : '';
              const endFmt = item.end_date ? new Date(item.end_date).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) : 'Ongoing';
              return (
                <View key={item.id} style={[styles.histItem, i < history.length - 1 && styles.divider]}>
                  <View style={styles.histTop}>
                    <Text style={styles.histTitle}>{item.component ?? item.title}</Text>
                    <Text style={[styles.histPct, { color: pct >= 80 ? colors.green : colors.muted }]}>{pct}%</Text>
                  </View>
                  <Text style={styles.histDates}>{startFmt} – {endFmt}</Text>
                </View>
              );
            })}
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

  swipeOuter: { position: 'relative', borderRadius: 12, overflow: 'hidden' },
  swipeAction: { position: 'absolute', left: 0, top: 0, bottom: 0, width: REVEAL_W, justifyContent: 'center', alignItems: 'center' },
  swipeActionText: { fontFamily: fonts.latoBold, fontSize: 10, letterSpacing: 0.8 },

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

  readinessRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, borderWidth: 1, borderRadius: 10, padding: 14, marginBottom: 4 },
  readinessIcon: { fontSize: 18, marginTop: 1 },
  readinessStatus: { fontFamily: fonts.latoBold, fontSize: 13, marginBottom: 4 },
  readinessBody: { fontFamily: fonts.latoLight, fontSize: 12, color: colors.muted, lineHeight: 18 },

  divider: { borderBottomWidth: 1, borderBottomColor: colors.border, marginBottom: 0 },
  histItem: { paddingVertical: 13 },
  histTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 3 },
  histTitle: { fontFamily: fonts.latoBold, fontSize: 13, color: colors.cream, flex: 1 },
  histDates: { fontFamily: fonts.latoLight, fontSize: 10, color: colors.muted },
  histPct: { fontFamily: fonts.latoBold, fontSize: 12 },

  emptyState: { alignItems: 'center', paddingVertical: 20, gap: 6 },
  emptyIcon: { fontSize: 28, color: colors.muted, opacity: 0.4 },
  emptyTitle: { fontFamily: fonts.latoBold, fontSize: 13, color: colors.muted },
  emptyBody: { fontFamily: fonts.latoLight, fontSize: 11, color: colors.muted, textAlign: 'center', lineHeight: 17, opacity: 0.7 },
});
