import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  ScrollView, View, Text, StyleSheet, TouchableOpacity, ActivityIndicator,
  Animated, PanResponder,
} from 'react-native';
import * as H from '@/lib/haptics';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { colors, fonts } from '@/lib/theme';
import { Card } from '@/components/ui/Card';
import { PrivacyNote } from '@/components/ui/PrivacyNote';
import { useSession } from '@/lib/auth';
import * as db from '@/lib/db';
import { useDemoMode } from '@/lib/demo';
import { loadRule } from '@/lib/canon/rule-store';
import { hydrateRuleFromCloud } from '@/lib/canon/rule-sync';
import { todayItems, RuleItem } from '@/lib/canon/today';
import { isFastDay } from '@/lib/canon/fasting';
import { loadTodayChecks, saveTodayChecks } from '@/lib/canon/checks';

// The canon shown here is the user's OWN spiritual canon (their rule of prayer,
// set with their Father of Confession in the rule editor) — built per weekday
// by lib/canon/today.ts. The old priest-assigned components checklist was
// removed; Past Canons history below still reflects assigned canons.

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

  // The action panel fades in with the swipe — otherwise it shows through the
  // row at rest (done rows are semi-transparent via compItemDone's opacity).
  const actionOpacity = tx.interpolate({ inputRange: [0, REVEAL_W], outputRange: [0, 1], extrapolate: 'clamp' });

  return (
    <View style={styles.swipeOuter}>
      {/* Action revealed behind */}
      <Animated.View style={[styles.swipeAction, { opacity: actionOpacity, backgroundColor: done ? 'rgba(149,165,166,0.2)' : `${colors.green}30` }]}>
        <Text style={[styles.swipeActionText, { color: done ? colors.muted : colors.green }]}>
          {done ? '↩ Undo' : '✓ Done'}
        </Text>
      </Animated.View>

      {/* Row sliding over it */}
      <Animated.View style={[styles.compItem, done && styles.compItemDone, { transform: [{ translateX: tx }] }]} {...pan.panHandlers}>
        <TouchableOpacity style={styles.compHeader} onPress={() => { done ? H.tap() : H.done(); onToggle(); }} activeOpacity={0.85}>
          <View style={[styles.compCheck, done && styles.compCheckDone]}>
            {done && <Text style={styles.compCheckMark}>✓</Text>}
          </View>
          <View style={styles.compIcon}>
            <Text style={styles.compIconEmoji}>{comp.icon ?? '📜'}</Text>
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={[styles.compName, done && styles.compNameDone]}>{comp.name}</Text>
            <Text style={styles.compStatus}>{done ? '✓ Done today' : '← swipe to complete'}</Text>
          </View>
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
  const router = useRouter();
  const { user } = useSession();
  const { demoMode } = useDemoMode();
  const [history, setHistory] = useState<any[]>([]);
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [ruleItems, setRuleItems] = useState<RuleItem[] | null>(null); // null = loading

  useEffect(() => {
    if (demoMode) {
      setHistory(DEMO_HISTORY);
    } else {
      loadHistory();
    }
  }, [user]);

  // Reload the canon every time the tab gains focus, so edits made in the
  // rule editor reflect here immediately.
  useFocusEffect(useCallback(() => {
    loadCanon();
  }, [user, demoMode]));

  async function loadCanon() {
    if (user && !demoMode) await hydrateRuleFromCloud(user.id);
    const rule = await loadRule();
    setRuleItems(todayItems(rule, new Date()));
    setChecked(await loadTodayChecks());
  }

  async function loadHistory() {
    if (!user) return;
    const past = await db.getInactiveCanons(user.id);
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
  }

  // Check-offs persist on-device for the current day (auto-reset at local
  // midnight) so the Home "canon today" tile can track them too.
  function toggleCheck(id: string) {
    setChecked(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      saveTodayChecks(next);
      return next;
    });
  }

  const items = ruleItems ?? [];
  const completedCount = items.filter(it => checked.has(`rule_${it.key}`)).length;
  const fastingToday = isFastDay(new Date());

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>

        <Text style={styles.pageTitle}>Spiritual Canon</Text>
        <Text style={styles.pageSubtitle}>A remedy for the soul, not a task list</Text>

        {/* My Spiritual Canon — the user's own rule of prayer for today */}
        <Card
          title="My Spiritual Canon"
          flat
          action={
            <View style={styles.headerActions}>
              {fastingToday && (
                <View style={styles.fastBadge}><Text style={styles.fastBadgeText}>Fasting day</Text></View>
              )}
              {items.length > 0 && (
                <Text style={styles.headerCount}>{completedCount}/{items.length}</Text>
              )}
              <TouchableOpacity onPress={() => { H.tap(); router.push('/canon/rule'); }} hitSlop={8}>
                <Text style={styles.editLink}>Edit ›</Text>
              </TouchableOpacity>
            </View>
          }
        >
          {ruleItems == null ? (
            <ActivityIndicator color={colors.gold} style={{ paddingVertical: 20 }} />
          ) : items.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyIcon}>📜</Text>
              <Text style={styles.emptyTitle}>No canon set yet</Text>
              <Text style={styles.emptyBody}>
                Set your spiritual canon with your Father of Confession — Agpeya hours, church services,
                fasting, prostrations, quiet time, and reading, per day of the week.
              </Text>
              <TouchableOpacity style={styles.setBtn} onPress={() => { H.tap(); router.push('/canon/rule'); }} activeOpacity={0.85}>
                <Text style={styles.setBtnText}>Set my canon</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              {items.map(item => (
                <View key={item.key} style={{ marginBottom: 10 }}>
                  <SwipeableCanonRow
                    comp={{ id: `rule_${item.key}`, icon: item.icon, name: item.label }}
                    done={checked.has(`rule_${item.key}`)}
                    onToggle={() => toggleCheck(`rule_${item.key}`)}
                  />
                </View>
              ))}
              <PrivacyNote text="Your spiritual canon stays private to you — it is never shared with anyone." />
            </>
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

  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  headerCount: { fontFamily: fonts.latoBold, fontSize: 12, color: colors.muted },
  editLink: { fontFamily: fonts.latoBold, fontSize: 12, color: colors.gold },
  fastBadge: { backgroundColor: 'rgba(201,168,76,0.15)', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3 },
  fastBadgeText: { fontFamily: fonts.latoBold, fontSize: 10, color: colors.goldLight },

  swipeOuter: { position: 'relative', borderRadius: 12, overflow: 'hidden' },
  swipeAction: { position: 'absolute', left: 0, top: 0, bottom: 0, width: REVEAL_W, justifyContent: 'center', alignItems: 'center' },
  swipeActionText: { fontFamily: fonts.latoBold, fontSize: 10, letterSpacing: 0.8 },

  // Opaque background — the "✓ Done" swipe action sits behind the left edge of
  // this row (under the checkbox) and must not show through until swiped.
  compItem: { backgroundColor: '#0d182e', borderWidth: 1, borderColor: colors.border, borderRadius: 12, overflow: 'hidden' },
  compItemDone: { opacity: 0.65 },
  compHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 13 },
  compCheck: { width: 22, height: 22, borderRadius: 11, borderWidth: 1.5, borderColor: colors.border, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  compCheckDone: { backgroundColor: colors.gold, borderColor: colors.gold },
  compCheckMark: { fontSize: 12, color: colors.navy, fontWeight: '700' },
  compIcon: { width: 32, height: 32, borderRadius: 8, backgroundColor: colors.goldDim, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  compIconEmoji: { fontSize: 16 },
  compName: { fontFamily: fonts.latoBold, fontSize: 13, color: colors.cream, marginBottom: 2, flexShrink: 1 },
  compNameDone: { textDecorationLine: 'line-through' },
  compStatus: { fontFamily: fonts.latoLight, fontSize: 10, color: colors.muted },

  setBtn: { marginTop: 12, backgroundColor: colors.gold, paddingVertical: 11, paddingHorizontal: 24, borderRadius: 10 },
  setBtnText: { fontFamily: fonts.latoBold, fontSize: 13, color: colors.navy, letterSpacing: 0.4 },

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
