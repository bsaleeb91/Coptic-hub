// Shepherd-facing view of a congregant's psalm memorization summary.
// Renders the 'psalm-stats' agent_progress payload (see lib/psalms/stats.ts).
// Read access is consent-gated by RLS; a null payload means nothing shared.
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, fonts } from '@/lib/theme';
import { Card } from '@/components/ui/Card';
import type { PsalmStatsSnapshot } from '@/lib/psalms/stats';

export const DEMO_PSALM_STATS: PsalmStatsSnapshot = {
  streak: 12,
  counts: { mastered: 34, learning: 9, notStarted: 41, dueToday: 6 },
  currentlyLearning: 'Psalm 50',
  memorized: ['Psalm 3', 'Psalm 62', 'Psalm 66', 'Psalm 118 · Section 1'],
  totalSelected: 9,
  updatedAt: new Date(Date.now() - 86400000).toISOString(),
};

function asOf(iso: string): string {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  return `${days} days ago`;
}

export function PsalmStatsCard({ stats }: { stats: PsalmStatsSnapshot | null }) {
  return (
    <Card title="Psalm Memorization" flat>
      {!stats ? (
        <Text style={styles.emptyText}>No psalm activity shared yet.</Text>
      ) : (
        <>
          <View style={styles.topRow}>
            {stats.streak > 0 && (
              <View style={styles.streakPill}>
                <Text style={styles.streakText}>🔥 {stats.streak}-day streak</Text>
              </View>
            )}
            <Text style={styles.asOf}>as of {asOf(stats.updatedAt)}</Text>
          </View>

          <View style={styles.countRow}>
            <View style={styles.count}>
              <Text style={[styles.countVal, { color: colors.green }]}>{stats.counts.mastered}</Text>
              <Text style={styles.countLabel}>MEMORIZED</Text>
            </View>
            <View style={styles.count}>
              <Text style={[styles.countVal, { color: colors.yellow }]}>{stats.counts.learning}</Text>
              <Text style={styles.countLabel}>LEARNING</Text>
            </View>
            <View style={styles.count}>
              <Text style={[styles.countVal, { color: colors.muted }]}>{stats.counts.notStarted}</Text>
              <Text style={styles.countLabel}>NOT STARTED</Text>
            </View>
          </View>

          {stats.currentlyLearning && (
            <Text style={styles.line}>
              <Text style={styles.lineLabel}>Learning now:  </Text>
              {stats.currentlyLearning}
            </Text>
          )}
          <Text style={styles.line}>
            <Text style={styles.lineLabel}>Memorized in full:  </Text>
            {stats.memorized.length ? stats.memorized.join(' · ') : 'None yet'}
          </Text>
        </>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  emptyText: { fontFamily: fonts.latoLight, fontSize: 12, color: colors.muted, paddingVertical: 10 },

  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 10, marginBottom: 12 },
  streakPill: { backgroundColor: colors.goldDim, borderWidth: 1, borderColor: colors.border, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  streakText: { fontFamily: fonts.latoBold, fontSize: 11, color: colors.goldLight },
  asOf: { fontFamily: fonts.latoLight, fontSize: 10, color: colors.muted },

  countRow: { flexDirection: 'row', gap: 10, marginBottom: 12 },
  count: { flex: 1, backgroundColor: colors.creamDim, borderRadius: 10, paddingVertical: 10, alignItems: 'center' },
  countVal: { fontFamily: fonts.cormorantMedium, fontSize: 20 },
  countLabel: { fontFamily: fonts.latoBold, fontSize: 8, letterSpacing: 1, color: colors.muted, marginTop: 2 },

  line: { fontFamily: fonts.latoLight, fontSize: 12, color: colors.cream, lineHeight: 19, marginBottom: 6 },
  lineLabel: { fontFamily: fonts.latoBold, fontSize: 10, letterSpacing: 0.8, color: colors.gold, textTransform: 'uppercase' },
});
