import React, { useState, useEffect } from 'react';
import { ScrollView, View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { colors, fonts } from '@/lib/theme';
import { Card } from '@/components/ui/Card';
import { useSession } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { useDemoMode } from '@/lib/demo';

const DEMO_CANONS = [
  { id: 'ds1', component: 'Morning Agpeya', frequency: 'Daily', startDate: 'Jun 1, 2026', completions: 5, totalDays: 7 },
  { id: 'ds2', component: 'Gospel Reading (1 chapter)', frequency: 'Daily', startDate: 'Jun 1, 2026', completions: 4, totalDays: 7 },
];

export default function StudentScreen() {
  const router = useRouter();
  const { id: studentId, name: studentName } = useLocalSearchParams<{ id: string; name: string }>();
  const { user } = useSession();
  const { demoMode } = useDemoMode();
  const [loading, setLoading] = useState(!demoMode);
  const [canons, setCanons] = useState<any[]>([]);

  const displayName = studentName ?? 'Student';
  const initials = displayName.split(' ').map((n: string) => n[0]).slice(0, 2).join('').toUpperCase();

  useEffect(() => {
    if (demoMode) {
      setCanons(DEMO_CANONS);
    } else if (studentId) {
      loadStudentData();
    }
  }, [studentId]);

  async function loadStudentData() {
    if (!user || !studentId) return;
    setLoading(true);

    // Load canons this servant assigned to the student
    const { data: canonData } = await supabase
      .from('spiritual_canons')
      .select('id, component, frequency, start_date')
      .eq('congregant_id', studentId)
      .eq('priest_id', user.id)
      .eq('active', true);

    if (canonData) {
      // For each canon, count completions in the last 7 days
      const enriched = await Promise.all(canonData.map(async c => {
        const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0];
        const { count } = await supabase
          .from('canon_completions')
          .select('id', { count: 'exact', head: true })
          .eq('canon_id', c.id)
          .gte('completed_on', sevenDaysAgo);
        return { id: c.id, component: c.component, frequency: c.frequency, startDate: c.start_date, completions: count ?? 0, totalDays: 7 };
      }));
      setCanons(enriched);
    }

    setLoading(false);
  }

  async function handleDeactivateCanon(canonId: string) {
    if (demoMode) {
      setCanons(prev => prev.filter(c => c.id !== canonId));
      return;
    }
    await supabase.from('spiritual_canons').update({ active: false }).eq('id', canonId);
    setCanons(prev => prev.filter(c => c.id !== canonId));
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>

        <TouchableOpacity style={styles.backRow} onPress={() => router.push('/(servant)')}>
          <Text style={styles.backArrow}>‹</Text>
          <Text style={styles.backText}>My Students</Text>
        </TouchableOpacity>

        <View style={styles.heroCard}>
          <View style={styles.heroAvatar}>
            <Text style={styles.heroAvatarText}>{initials}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.heroName}>{displayName}</Text>
            <Text style={styles.heroMeta}>Sunday School Student</Text>
          </View>
        </View>

        <View style={styles.actionRow}>
          <TouchableOpacity
            style={styles.btnGold}
            onPress={() => router.push({ pathname: '/(servant)/assign-canon', params: { studentId: studentId ?? '', studentName: displayName } })}
          >
            <Text style={styles.btnGoldText}>+ ASSIGN CANON</Text>
          </TouchableOpacity>
        </View>

        {loading ? (
          <ActivityIndicator color={colors.gold} style={{ paddingTop: 20 }} />
        ) : (
          <Card title={`Assigned Canons (${canons.length})`} titleIcon="📜">
            {canons.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyTitle}>No canons assigned yet</Text>
                <Text style={styles.emptyBody}>Assign a Bible reading or prayer practice to get started.</Text>
              </View>
            ) : (
              canons.map((c, i) => {
                const pct = Math.round((c.completions / c.totalDays) * 100);
                return (
                  <View key={c.id} style={[styles.canonRow, i < canons.length - 1 && styles.canonBorder]}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.canonComponent}>{c.component}</Text>
                      <Text style={styles.canonMeta}>{c.frequency} · since {c.startDate}</Text>
                      <View style={styles.progressRow}>
                        <View style={styles.progressTrack}>
                          <View style={[styles.progressFill, { width: `${Math.min(pct, 100)}%` as any }]} />
                        </View>
                        <Text style={[styles.progressPct, { color: pct < 50 ? colors.yellow : colors.green }]}>
                          {c.completions}/{c.totalDays} this week
                        </Text>
                      </View>
                    </View>
                    <TouchableOpacity style={styles.removeBtn} onPress={() => handleDeactivateCanon(c.id)}>
                      <Text style={styles.removeBtnText}>Remove</Text>
                    </TouchableOpacity>
                  </View>
                );
              })
            )}
          </Card>
        )}

        <View style={styles.scopeNote}>
          <Text style={styles.scopeNoteText}>
            ✦ You can see canon progress your students self-report. Confession history and pastoral notes are accessible only to their Father of Confession.
          </Text>
        </View>

      </ScrollView>
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

  heroCard: { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: colors.cardBg, borderWidth: 1, borderColor: colors.border, borderRadius: 14, padding: 16, marginBottom: 16 },
  heroAvatar: { width: 52, height: 52, borderRadius: 26, backgroundColor: '#1e3a5f', borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  heroAvatarText: { fontFamily: fonts.cormorantMedium, fontSize: 20, color: colors.cream },
  heroName: { fontFamily: fonts.cormorantMedium, fontSize: 22, color: colors.cream, marginBottom: 2 },
  heroMeta: { fontFamily: fonts.latoLight, fontSize: 11, color: colors.muted },

  actionRow: { marginBottom: 16 },
  btnGold: { backgroundColor: colors.gold, borderRadius: 8, paddingHorizontal: 16, paddingVertical: 10, alignSelf: 'flex-start' },
  btnGoldText: { fontFamily: fonts.latoBold, fontSize: 10, color: colors.navy, letterSpacing: 0.8 },

  emptyState: { alignItems: 'center', paddingVertical: 24, gap: 6 },
  emptyTitle: { fontFamily: fonts.latoBold, fontSize: 13, color: colors.muted },
  emptyBody: { fontFamily: fonts.latoLight, fontSize: 11, color: colors.muted, textAlign: 'center', lineHeight: 17, opacity: 0.7 },

  canonRow: { paddingVertical: 14, flexDirection: 'row', alignItems: 'center', gap: 12 },
  canonBorder: { borderBottomWidth: 1, borderBottomColor: colors.border },
  canonComponent: { fontFamily: fonts.latoBold, fontSize: 13, color: colors.cream, marginBottom: 2 },
  canonMeta: { fontFamily: fonts.latoLight, fontSize: 11, color: colors.muted, marginBottom: 8 },
  progressRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  progressTrack: { flex: 1, height: 4, backgroundColor: 'rgba(245,240,232,0.08)', borderRadius: 4, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: colors.gold, borderRadius: 4 },
  progressPct: { fontFamily: fonts.latoBold, fontSize: 11, flexShrink: 0 },
  removeBtn: { borderWidth: 1, borderColor: 'rgba(192,57,43,0.3)', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4 },
  removeBtnText: { fontFamily: fonts.latoBold, fontSize: 9, color: colors.red, letterSpacing: 0.5 },

  scopeNote: { backgroundColor: 'rgba(201,168,76,0.05)', borderWidth: 1, borderColor: 'rgba(201,168,76,0.15)', borderRadius: 10, padding: 14, marginTop: 8 },
  scopeNoteText: { fontFamily: fonts.latoLight, fontSize: 11, color: colors.muted, lineHeight: 17, letterSpacing: 0.2 },
});
