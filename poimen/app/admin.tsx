import React, { useState, useEffect } from 'react';
import { ScrollView, View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { colors, fonts } from '@/lib/theme';
import { Card } from '@/components/ui/Card';
import { useSession } from '@/lib/auth';
import * as db from '@/lib/db';
import type { AdminSummary, MonthlyActivity, ChurchBreakdown } from '@/lib/db';

type ChartMetric = 'signups' | 'prayers' | 'confessions' | 'canon_completions' | 'journal_active';

const CHART_METRICS: { key: ChartMetric; label: string; color: string }[] = [
  { key: 'signups',          label: 'Signups',     color: colors.gold },
  { key: 'prayers',          label: 'Prayers',     color: colors.blue },
  { key: 'confessions',      label: 'Confessions', color: colors.purple },
  { key: 'canon_completions',label: 'Canons',      color: colors.green },
  { key: 'journal_active',   label: 'Journal',     color: colors.cream },
];

function pct(value: number, total: number) {
  if (!total) return '0%';
  return `${Math.round((value / total) * 100)}%`;
}

function growthLabel(current: number, prev: number) {
  if (!prev) return current > 0 ? `+${current} new` : '—';
  const diff = current - prev;
  const sign = diff >= 0 ? '+' : '';
  const arrow = diff >= 0 ? '↑' : '↓';
  return `${arrow} ${sign}${diff} vs last month`;
}

function StatCard({ value, label, sub }: { value: string | number; label: string; sub?: string }) {
  return (
    <View style={styles.statCard}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
      {sub ? <Text style={styles.statSub}>{sub}</Text> : null}
    </View>
  );
}

function HealthPill({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <View style={styles.healthPill}>
      <Text style={[styles.healthValue, { color }]}>{value}</Text>
      <Text style={styles.healthLabel}>{label}</Text>
    </View>
  );
}

function MiniBar({ value, max, color }: { value: number; max: number; color: string }) {
  const w = max > 0 ? Math.max((value / max) * 100, 2) : 0;
  return (
    <View style={styles.barTrack}>
      <View style={[styles.barFill, { width: `${w}%` as any, backgroundColor: color }]} />
    </View>
  );
}

export default function AdminScreen() {
  const router = useRouter();
  const { profile } = useSession();
  const [summary, setSummary] = useState<AdminSummary | null>(null);
  const [monthly, setMonthly] = useState<MonthlyActivity[]>([]);
  const [churches, setChurches] = useState<ChurchBreakdown[]>([]);
  const [loading, setLoading] = useState(true);
  const [metric, setMetric] = useState<ChartMetric>('signups');

  useEffect(() => {
    if (!profile || profile.role !== 'admin') return;
    Promise.all([
      db.getAdminSummary(),
      db.getMonthlyActivity(),
      db.getChurchBreakdown(),
    ]).then(([s, m, c]) => {
      setSummary(s);
      setMonthly(m);
      setChurches(c);
      setLoading(false);
    });
  }, [profile]);

  if (Platform.OS !== 'web') {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <Text style={styles.gateTitle}>Web Only</Text>
          <Text style={styles.gateSub}>The admin dashboard is only available at poimen-app.vercel.app.</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (profile && profile.role !== 'admin') {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <Text style={styles.gateTitle}>Access Denied</Text>
          <Text style={styles.gateSub}>This screen is restricted to admins.</Text>
        </View>
      </SafeAreaView>
    );
  }

  const activeMetric = CHART_METRICS.find(m => m.key === metric)!;
  const maxBarValue = Math.max(...monthly.map(m => m[metric] ?? 0), 1);
  const focRate = summary && summary.congregants > 0
    ? Math.round((summary.foc_linked / summary.congregants) * 100) : 0;
  const answeredRate = summary && summary.total_prayers > 0
    ? Math.round((summary.answered_prayers / summary.total_prayers) * 100) : 0;
  const retentionRate = summary && summary.total_users > 0
    ? Math.round((summary.active_month / summary.total_users) * 100) : 0;
  const avgFlock = summary && summary.priests > 0
    ? Math.round(summary.congregants / summary.priests) : 0;

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>

        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>

        <Text style={styles.eyebrow}>ADMIN</Text>
        <Text style={styles.title}>Dashboard</Text>

        <TouchableOpacity style={styles.roadmapLink} onPress={() => router.push('/roadmap')}>
          <Text style={styles.roadmapLinkText}>App Store Roadmap →</Text>
        </TouchableOpacity>

        {loading ? (
          <ActivityIndicator color={colors.gold} style={{ marginTop: 60 }} />
        ) : !summary ? (
          <Text style={styles.errorText}>Could not load stats. Make sure your role is set to admin in Supabase.</Text>
        ) : (
          <>
            {/* ── Summary grid ── */}
            <Text style={styles.sectionLabel}>OVERVIEW</Text>
            <View style={styles.statGrid}>
              <StatCard value={summary.total_users} label="Total Users" />
              <StatCard value={summary.active_week} label="Active This Week" sub={`${retentionRate}% monthly retention`} />
              <StatCard value={summary.churches} label="Churches" />
              <StatCard value={summary.priests} label="Priests" sub={`~${avgFlock} congregants each`} />
              <StatCard value={summary.congregants} label="Congregants" />
              <StatCard value={summary.servants} label="Servants" />
            </View>

            {/* ── Health metrics ── */}
            <Text style={[styles.sectionLabel, { marginTop: 24 }]}>HEALTH</Text>
            <Card title="" titleIcon="">
              <View style={styles.healthRow}>
                <HealthPill
                  label="Growth"
                  value={`+${summary.new_this_month}`}
                  color={summary.new_this_month >= summary.new_last_month ? colors.green : colors.red}
                />
                <HealthPill label="FOC Linkage" value={`${focRate}%`}
                  color={focRate >= 60 ? colors.green : focRate >= 30 ? colors.yellow : colors.red} />
                <HealthPill label="Prayer Answered" value={`${answeredRate}%`} color={colors.gold} />
              </View>
              <View style={[styles.healthRow, { marginTop: 0 }]}>
                <HealthPill label="Journal Users" value={`${summary.journal_users}`} color={colors.cream} />
                <HealthPill label="Active Canons" value={`${summary.active_canons}`} color={colors.blue} />
                <HealthPill label="Confessions" value={`${summary.total_confessions}`} color={colors.purple} />
              </View>
              <View style={styles.growthNote}>
                <Text style={styles.growthText}>
                  {growthLabel(summary.new_this_month, summary.new_last_month)}
                </Text>
                <Text style={styles.growthSub}>{summary.new_last_month} new users last month</Text>
              </View>
            </Card>

            {/* ── Activity over time ── */}
            <Text style={[styles.sectionLabel, { marginTop: 24 }]}>ACTIVITY — LAST 6 MONTHS</Text>
            <Card title="" titleIcon="">
              <View style={styles.metricTabs}>
                {CHART_METRICS.map(m => (
                  <TouchableOpacity key={m.key} style={styles.metricTab} onPress={() => setMetric(m.key)}>
                    <Text style={[styles.metricTabText, metric === m.key && { color: m.color }]}>{m.label}</Text>
                    {metric === m.key && <View style={[styles.metricTabLine, { backgroundColor: m.color }]} />}
                  </TouchableOpacity>
                ))}
              </View>

              {monthly.length === 0 ? (
                <Text style={styles.emptyText}>No data yet.</Text>
              ) : (
                monthly.map((row) => (
                  <View key={row.month} style={styles.barRow}>
                    <Text style={styles.barMonth}>{row.month}</Text>
                    <View style={{ flex: 1 }}>
                      <MiniBar value={row[metric] ?? 0} max={maxBarValue} color={activeMetric.color} />
                    </View>
                    <Text style={[styles.barCount, { color: activeMetric.color }]}>
                      {row[metric] ?? 0}
                    </Text>
                  </View>
                ))
              )}
            </Card>

            {/* ── Churches ── */}
            <Text style={[styles.sectionLabel, { marginTop: 24 }]}>CHURCHES</Text>
            {churches.length === 0 ? (
              <Text style={styles.emptyText}>No churches added yet.</Text>
            ) : (
              churches.map((c) => (
                <Card key={c.church_id} title={c.church_name} titleIcon="✦">
                  <View style={styles.churchStats}>
                    <View style={styles.churchStat}>
                      <Text style={[styles.churchStatVal, { color: colors.blue }]}>{c.priests}</Text>
                      <Text style={styles.churchStatLabel}>Priests</Text>
                    </View>
                    <View style={styles.churchStat}>
                      <Text style={[styles.churchStatVal, { color: colors.gold }]}>{c.congregants}</Text>
                      <Text style={styles.churchStatLabel}>Congregants</Text>
                    </View>
                    <View style={styles.churchStat}>
                      <Text style={[styles.churchStatVal, { color: colors.green }]}>{c.servants}</Text>
                      <Text style={styles.churchStatLabel}>Servants</Text>
                    </View>
                    <View style={styles.churchStat}>
                      <Text style={[styles.churchStatVal, { color: colors.green }]}>
                        {c.congregants > 0 ? Math.round((c.foc_linked / c.congregants) * 100) : 0}%
                      </Text>
                      <Text style={styles.churchStatLabel}>FOC Linked</Text>
                    </View>
                  </View>
                </Card>
              ))
            )}
          </>
        )}

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.navy },
  scroll: { flex: 1 },
  content: { padding: 20, paddingBottom: 48 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },

  backBtn: { marginBottom: 20 },
  backText: { fontFamily: fonts.lato, fontSize: 13, color: colors.gold },
  roadmapLink: { marginBottom: 24, alignSelf: 'flex-start' as any, paddingVertical: 8, paddingHorizontal: 14, borderRadius: 8, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.goldDim },
  roadmapLinkText: { fontFamily: fonts.latoBold, fontSize: 12, letterSpacing: 0.5, color: colors.gold },
  eyebrow: { fontFamily: fonts.latoBold, fontSize: 9, letterSpacing: 2.5, color: colors.gold, marginBottom: 6 },
  title: { fontFamily: fonts.cormorantMedium, fontSize: 34, color: colors.cream, marginBottom: 20 },
  sectionLabel: { fontFamily: fonts.latoBold, fontSize: 9, letterSpacing: 2.5, color: colors.muted, marginBottom: 10 },
  errorText: { fontFamily: fonts.latoLight, fontSize: 13, color: colors.red, marginTop: 20, lineHeight: 20 },
  emptyText: { fontFamily: fonts.latoLight, fontSize: 13, color: colors.muted, marginTop: 8 },

  gateTitle: { fontFamily: fonts.cormorantMedium, fontSize: 22, color: colors.cream, marginBottom: 8 },
  gateSub: { fontFamily: fonts.latoLight, fontSize: 13, color: colors.muted, textAlign: 'center' },

  // Summary grid
  statGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  statCard: { width: '31%' as any, backgroundColor: 'rgba(201,168,76,0.06)', borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 14, alignItems: 'center' },
  statValue: { fontFamily: fonts.cormorantMedium, fontSize: 30, color: colors.cream, lineHeight: 34 },
  statLabel: { fontFamily: fonts.latoBold, fontSize: 8, letterSpacing: 1.2, color: colors.muted, textTransform: 'uppercase', marginTop: 4, textAlign: 'center' },
  statSub: { fontFamily: fonts.latoLight, fontSize: 9, color: colors.muted, textAlign: 'center', marginTop: 3, opacity: 0.7 },

  // Health
  healthRow: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  healthPill: { flex: 1, backgroundColor: 'rgba(10,16,30,0.5)', borderWidth: 1, borderColor: colors.border, borderRadius: 10, padding: 12, alignItems: 'center' },
  healthValue: { fontFamily: fonts.cormorantMedium, fontSize: 22, lineHeight: 26 },
  healthLabel: { fontFamily: fonts.latoBold, fontSize: 8, letterSpacing: 1, color: colors.muted, textTransform: 'uppercase', marginTop: 3, textAlign: 'center' },
  growthNote: { marginTop: 8, paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.border },
  growthText: { fontFamily: fonts.latoBold, fontSize: 12, color: colors.cream },
  growthSub: { fontFamily: fonts.latoLight, fontSize: 11, color: colors.muted, marginTop: 2 },

  // Chart
  metricTabs: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: colors.border, marginBottom: 16 },
  metricTab: { flex: 1, paddingBottom: 10, alignItems: 'center', position: 'relative' },
  metricTabText: { fontFamily: fonts.latoBold, fontSize: 9, letterSpacing: 0.6, textTransform: 'uppercase', color: colors.muted },
  metricTabLine: { position: 'absolute', bottom: 0, left: 4, right: 4, height: 2, borderRadius: 1 },
  barRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  barMonth: { fontFamily: fonts.latoBold, fontSize: 9, color: colors.muted, width: 42, letterSpacing: 0.4 },
  barTrack: { flex: 1, height: 8, backgroundColor: 'rgba(245,240,232,0.07)', borderRadius: 4, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 4 },
  barCount: { fontFamily: fonts.latoBold, fontSize: 12, width: 28, textAlign: 'right' },

  // Churches
  churchStats: { flexDirection: 'row', justifyContent: 'space-around', paddingVertical: 4 },
  churchStat: { alignItems: 'center', gap: 4 },
  churchStatVal: { fontFamily: fonts.cormorantMedium, fontSize: 24 },
  churchStatLabel: { fontFamily: fonts.latoBold, fontSize: 8, letterSpacing: 1, color: colors.muted, textTransform: 'uppercase' },
});
