import React, { useState } from 'react';
import { ScrollView, View, Text, StyleSheet, TouchableOpacity, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Circle } from 'react-native-svg';
import { colors, fonts } from '@/lib/theme';
import { Card } from '@/components/ui/Card';
import { PrivacyNote } from '@/components/ui/PrivacyNote';

const RING_RADIUS = 22;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

function ProgressRing({ pct }: { pct: number }) {
  const offset = RING_CIRCUMFERENCE * (1 - pct / 100);
  return (
    <View style={styles.ring}>
      <Svg width={56} height={56} viewBox="0 0 56 56" style={{ transform: [{ rotate: '-90deg' }] }}>
        <Circle cx={28} cy={28} r={RING_RADIUS} stroke="rgba(245,240,232,0.08)" strokeWidth={4} fill="none" />
        <Circle
          cx={28} cy={28} r={RING_RADIUS}
          stroke={colors.gold} strokeWidth={4} fill="none"
          strokeDasharray={`${RING_CIRCUMFERENCE}`}
          strokeDashoffset={offset}
          strokeLinecap="round"
        />
      </Svg>
      <View style={styles.ringCenter}>
        <Text style={styles.ringPct}>{pct}%</Text>
      </View>
    </View>
  );
}

const COMPONENTS = [
  { icon: '📖', name: 'Daily Psalm Reading', freq: 'DAILY', desc: 'Read one Psalm slowly, with reflection. Today: Psalm 18.', done: true },
  { icon: '🙏', name: 'Morning Prostrations', freq: 'DAILY', desc: '12 prostrations upon waking, with the prayer of St. Ephrem.', done: true },
  { icon: '✝', name: 'Psalm 50 Before Sleep', freq: 'DAILY', desc: 'Recite Psalm 50 as the last prayer before sleeping.', done: false },
  { icon: '🕯', name: 'Vespers Attendance', freq: 'WEEKLY', desc: 'Attend Saturday Vespers or Tasbeha when available.', done: false },
];

const CANON_HISTORY = [
  { title: 'Great Lent Canon', dates: 'Mar 1 – Apr 19, 2026', desc: 'Daily prostrations, nightly Psalm reading, and fasting from entertainment.', pct: 84, status: 'completed' as const },
  { title: 'New Year Canon', dates: 'Jan 7 – Mar 1, 2026', desc: 'Weekly Vespers attendance and daily Scripture meditation.', pct: 72, status: 'superseded' as const },
];

export default function CanonScreen() {
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [checked, setChecked] = useState<Set<number>>(
    new Set(COMPONENTS.map((c, i) => c.done ? i : -1).filter(i => i >= 0))
  );

  const toggleExpand = (i: number) => {
    setExpanded(prev => {
      const next = new Set(prev);
      next.has(i) ? next.delete(i) : next.add(i);
      return next;
    });
  };

  const toggleCheck = (i: number) => {
    setChecked(prev => {
      const next = new Set(prev);
      next.has(i) ? next.delete(i) : next.add(i);
      return next;
    });
  };

  const completedCount = checked.size;
  const pct = Math.round((completedCount / COMPONENTS.length) * 100);

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>

        <Text style={styles.pageTitle}>Spiritual Canon</Text>
        <Text style={styles.pageSubtitle}>Assigned by Fr. Bishoy · A remedy for the soul, not a task list</Text>

        {/* Canon Status Bar */}
        <View style={styles.statusBar}>
          <Text style={styles.statusBarDecor}>✦</Text>
          <Text style={styles.statusIcon}>📜</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.statusLabel}>ACTIVE CANON · ASSIGNED MAY 21</Text>
            <Text style={styles.statusTitle}>40-Day Psalm & Prostration Plan</Text>
            <Text style={styles.statusMeta}>Assigned after Holy Confession · Fr. Bishoy Marcos · Day 18 of 40</Text>
          </View>
          <ProgressRing pct={pct} />
        </View>

        {/* Today's Canon Components */}
        <Card title="Today's Canon" titleIcon="◈">
          {COMPONENTS.map((comp, i) => {
            const done = checked.has(i);
            const open = expanded.has(i);
            return (
              <View key={i} style={[styles.compItem, done && styles.compItemDone, i < COMPONENTS.length - 1 && { marginBottom: 10 }]}>
                {/* Header */}
                <TouchableOpacity style={styles.compHeader} onPress={() => toggleExpand(i)} activeOpacity={0.7}>
                  <TouchableOpacity onPress={() => toggleCheck(i)}>
                    <View style={[styles.compCheck, done && styles.compCheckDone]}>
                      {done && <Text style={styles.compCheckMark}>✓</Text>}
                    </View>
                  </TouchableOpacity>
                  <View style={styles.compIcon}>
                    <Text style={styles.compIconEmoji}>{comp.icon}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.compName, done && styles.compNameDone]}>{comp.name}</Text>
                    <View style={styles.compMeta}>
                      <Text style={[styles.compFreq, comp.freq === 'DAILY' ? { color: colors.blue } : { color: colors.green }]}>
                        {comp.freq}
                      </Text>
                      <Text style={styles.compStatus}>
                        {done ? '✓ Done today' : 'Pending'}
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.compDesc} numberOfLines={2}>{comp.desc}</Text>
                  <Text style={[styles.chevron, open && styles.chevronOpen]}>▾</Text>
                </TouchableOpacity>

                {/* Notes (collapsible) */}
                {open && (
                  <View style={styles.compNotes}>
                    <Text style={styles.compNotesLabel}>REFLECTION FOR TODAY</Text>
                    <TextInput
                      style={styles.textarea}
                      multiline
                      placeholder="How did this practice land today? What stirred in you? What was difficult?"
                      placeholderTextColor="rgba(245,240,232,0.22)"
                    />
                    <TouchableOpacity style={styles.shareRow}>
                      <View style={styles.shareCheck} />
                      <Text style={styles.shareLabel}>Share this reflection with Fr. Bishoy</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            );
          })}
        </Card>

        {/* Communion Readiness */}
        <Card title="Communion Readiness" titleIcon="✝">
          <View style={styles.readinessCard}>
            <Text style={styles.readinessLabel}>CURRENT STATUS</Text>
            <Text style={styles.readinessStatus}>⚠ Confession recommended</Text>
            <Text style={styles.readinessBody}>
              It has been 47 days since your last confession. Consider scheduling with Fr. Bishoy before receiving Holy Communion.
            </Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.liturgyRow}>
            <Text style={styles.readinessLabel}>NEXT DIVINE LITURGY</Text>
            <Text style={styles.liturgyVal}>Sunday, June 8 · 8:00 AM</Text>
            <Text style={styles.liturgySub}>St. Mary's Coptic Orthodox Church</Text>
          </View>
          <PrivacyNote text="Communion readiness is based on your confession date and fasting observance. Fr. Bishoy may adjust this guidance." />
        </Card>

        {/* Canon History */}
        <Card title="Canon History" titleIcon="◎">
          {CANON_HISTORY.map((item, i) => (
            <View key={i} style={[styles.histItem, i < CANON_HISTORY.length - 1 && styles.histBorder]}>
              <View style={styles.histTop}>
                <Text style={styles.histTitle}>{item.title}</Text>
                <View style={[styles.histBadge, item.status === 'completed' ? styles.badgeGreen : styles.badgeMuted]}>
                  <Text style={[styles.histBadgeText, item.status === 'completed' ? { color: colors.green } : { color: colors.muted }]}>
                    {item.status === 'completed' ? '✓ Completed' : 'Superseded'}
                  </Text>
                </View>
              </View>
              <Text style={styles.histDates}>{item.dates}</Text>
              <Text style={styles.histDesc}>{item.desc}</Text>
              <View style={styles.histBarRow}>
                <View style={styles.histBarTrack}>
                  <View style={[styles.histBarFill, { width: `${item.pct}%` as any }]} />
                </View>
                <Text style={styles.histPct}>{item.pct}%</Text>
              </View>
            </View>
          ))}
        </Card>

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

  statusBar: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: 'rgba(201,168,76,0.11)', borderWidth: 1, borderColor: 'rgba(201,168,76,0.32)',
    borderRadius: 12, padding: 18, marginBottom: 20, position: 'relative', overflow: 'hidden',
  },
  statusBarDecor: { position: 'absolute', right: 16, fontSize: 52, color: 'rgba(201,168,76,0.06)', fontFamily: fonts.cormorant },
  statusIcon: { fontSize: 28, flexShrink: 0 },
  statusLabel: { fontFamily: fonts.latoBold, fontSize: 10, letterSpacing: 2, textTransform: 'uppercase', color: colors.gold, marginBottom: 3 },
  statusTitle: { fontFamily: fonts.cormorantMedium, fontSize: 18, color: colors.cream, marginBottom: 2 },
  statusMeta: { fontFamily: fonts.latoLight, fontSize: 11, color: colors.muted },

  ring: { width: 56, height: 56, flexShrink: 0, position: 'relative' },
  ringCenter: { position: 'absolute', inset: 0, alignItems: 'center', justifyContent: 'center' },
  ringPct: { fontFamily: fonts.latoBold, fontSize: 12, color: colors.cream },

  compItem: {
    backgroundColor: 'rgba(10,16,30,0.5)', borderWidth: 1, borderColor: colors.border,
    borderRadius: 12, overflow: 'hidden',
  },
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
  chevron: { fontFamily: fonts.lato, fontSize: 11, color: colors.muted, flexShrink: 0 },
  chevronOpen: { transform: [{ rotate: '180deg' }] },

  compNotes: { borderTopWidth: 1, borderTopColor: colors.border, padding: 14 },
  compNotesLabel: { fontFamily: fonts.latoBold, fontSize: 10, letterSpacing: 1.5, textTransform: 'uppercase', color: colors.gold, opacity: 0.75, marginBottom: 8 },
  textarea: {
    backgroundColor: 'rgba(10,16,30,0.6)', borderWidth: 1, borderColor: colors.border,
    borderRadius: 8, color: colors.cream, fontFamily: fonts.latoLight,
    fontSize: 12, padding: 10, minHeight: 64, textAlignVertical: 'top', lineHeight: 20,
  },
  shareRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 },
  shareCheck: { width: 14, height: 14, borderRadius: 3, borderWidth: 1, borderColor: colors.border, backgroundColor: 'transparent' },
  shareLabel: { fontFamily: fonts.latoLight, fontSize: 11, color: colors.muted },

  readinessCard: { backgroundColor: 'rgba(10,16,30,0.5)', borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 14, marginBottom: 12 },
  readinessLabel: { fontFamily: fonts.latoBold, fontSize: 10, letterSpacing: 2, textTransform: 'uppercase', color: colors.gold, opacity: 0.8, marginBottom: 6 },
  readinessStatus: { fontFamily: fonts.cormorantMedium, fontSize: 18, color: colors.yellow, marginBottom: 5 },
  readinessBody: { fontFamily: fonts.latoLight, fontSize: 12, color: colors.muted, lineHeight: 18 },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: 12 },
  liturgyRow: {},
  liturgyVal: { fontFamily: fonts.latoBold, fontSize: 13, color: colors.cream, marginTop: 4 },
  liturgySub: { fontFamily: fonts.latoLight, fontSize: 11, color: colors.muted, marginTop: 2 },

  histItem: { paddingVertical: 14 },
  histBorder: { borderBottomWidth: 1, borderBottomColor: colors.border },
  histTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 4 },
  histTitle: { fontFamily: fonts.latoBold, fontSize: 13, color: colors.cream, flex: 1 },
  histBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 20 },
  badgeGreen: { backgroundColor: colors.greenBg },
  badgeMuted: { backgroundColor: 'rgba(245,240,232,0.07)' },
  histBadgeText: { fontFamily: fonts.latoBold, fontSize: 10 },
  histDates: { fontFamily: fonts.latoLight, fontSize: 10, color: colors.muted, marginBottom: 4 },
  histDesc: { fontFamily: fonts.latoLight, fontSize: 12, color: colors.muted, lineHeight: 18, marginBottom: 8 },
  histBarRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  histBarTrack: { flex: 1, height: 3, backgroundColor: 'rgba(245,240,232,0.07)', borderRadius: 3, overflow: 'hidden' },
  histBarFill: { height: '100%', backgroundColor: colors.gold, borderRadius: 3 },
  histPct: { fontFamily: fonts.latoBold, fontSize: 11, color: colors.goldLight },
});
