import React, { useState, useEffect } from 'react';
import { ScrollView, View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Platform, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { goBack } from '@/lib/nav';
import { colors, fonts , lazyThemed } from '@/lib/theme';
import { Card } from '@/components/ui/Card';
import { useSession } from '@/lib/auth';
import type { Feedback, FeedbackStatus } from '@/lib/db/feedback';
import type { SurveyRow } from '@/lib/db/survey';
import * as db from '@/lib/db';
import type { AdminSummary, MonthlyActivity, ChurchBreakdown } from '@/lib/db';
import { FEEDBACK_PAGE_SIZE } from '@/lib/db/feedback';
import { toCsv, downloadCsv } from '@/lib/csv';

// Chart ranges in months; null = all time.
const CHART_RANGES: { months: number | null; label: string }[] = [
  { months: 3, label: '3M' },
  { months: 6, label: '6M' },
  { months: 12, label: '12M' },
  { months: null, label: 'All' },
];

// Survey answers as shown on screen and in the export.
type Opt = { v: string; label: string };
const FREQUENCY_OPTS: Opt[] = [
  { v: 'daily', label: 'Daily' }, { v: 'weekly_several', label: 'Several times a week' },
  { v: 'weekly', label: 'About once a week' }, { v: 'rarely', label: 'Rarely' }];
const CONSISTENCY_OPTS: Opt[] = [
  { v: 'yes_clearly', label: 'Yes, noticeably' }, { v: 'a_little', label: 'A little' },
  { v: 'no_change', label: 'No change' }, { v: 'no_canon', label: "Doesn't use the canon" }];
const MOST_MISSED_OPTS: Opt[] = [
  { v: 'canon', label: 'Canon' }, { v: 'confession', label: 'Confession' },
  { v: 'psalms', label: 'Psalms' }, { v: 'prayer', label: 'Prayer' },
  { v: 'journal', label: 'Journal' }, { v: 'appointments', label: 'Appointments' }];
const optLabel = (opts: Opt[], v: string | null) => (v == null ? null : opts.find(o => o.v === v)?.label ?? v);
const yesNo = (b: boolean | null) => (b == null ? null : b ? 'Yes' : 'No');

const SURVEY_PAGE_SIZE = 20;

const shortDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
const today = () => new Date().toISOString().slice(0, 10);

type ChartMetric = 'signups' | 'prayers' | 'confessions' | 'canon_completions' | 'journal_active';

const CHART_METRICS: { key: ChartMetric; label: string; color: string }[] = lazyThemed(() => [
  { key: 'signups',          label: 'Signups',     color: colors.gold },
  { key: 'prayers',          label: 'Prayers',     color: colors.blue },
  { key: 'confessions',      label: 'Confessions', color: colors.purple },
  { key: 'canon_completions',label: 'Canons',      color: colors.green },
  { key: 'journal_active',   label: 'Journal',     color: colors.cream },
]);

// One section per tab instead of one long scroll. The choice is kept in the
// URL (?tab=feedback) so a refresh or a shared link opens the same tab.
type AdminTab = 'overview' | 'feedback' | 'survey' | 'churches';
const ADMIN_TABS: AdminTab[] = ['overview', 'feedback', 'survey', 'churches'];

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
  const params = useLocalSearchParams<{ tab?: string }>();
  const tab: AdminTab = ADMIN_TABS.includes(params.tab as AdminTab) ? (params.tab as AdminTab) : 'overview';
  const setTab = (t: AdminTab) => router.setParams({ tab: t });
  const [summary, setSummary] = useState<AdminSummary | null>(null);
  const [monthly, setMonthly] = useState<MonthlyActivity[]>([]);
  const [churches, setChurches] = useState<ChurchBreakdown[]>([]);
  const [feedback, setFeedback] = useState<Feedback[]>([]);
  const [feedbackFilter, setFeedbackFilter] = useState<'open' | 'all'>('open');
  const [feedbackOpenCount, setFeedbackOpenCount] = useState(0);
  const [feedbackHasMore, setFeedbackHasMore] = useState(false);
  const [feedbackLoading, setFeedbackLoading] = useState(false);
  const [survey, setSurvey] = useState<SurveyRow[]>([]);
  const [surveyShown, setSurveyShown] = useState(SURVEY_PAGE_SIZE);
  const [loading, setLoading] = useState(true);
  const [metric, setMetric] = useState<ChartMetric>('signups');
  const [range, setRange] = useState<number | null>(6);
  const [chartLoading, setChartLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [newChurchName, setNewChurchName] = useState('');
  // Structured, matching a member's address — so the picker can search on city
  // and street, not just raw text.
  const [newChurchLine1, setNewChurchLine1] = useState('');
  const [newChurchLine2, setNewChurchLine2] = useState('');
  const [newChurchCity, setNewChurchCity] = useState('');
  const [newChurchState, setNewChurchState] = useState('');
  const [newChurchZip, setNewChurchZip] = useState('');
  const [addingChurch, setAddingChurch] = useState(false);
  const [addChurchError, setAddChurchError] = useState('');

  useEffect(() => {
    if (!profile || profile.role !== 'admin') return;
    Promise.all([
      db.getAdminSummary(),
      db.getChurchBreakdown(),
      db.getSurveyResults(),
      db.countOpenFeedback(),
    ]).then(([s, c, sv, open]) => {
      setSummary(s);
      setChurches(c);
      setSurvey(sv);
      setFeedbackOpenCount(open);
      setLoading(false);
    });
  }, [profile]);

  // The chart reloads when the range changes.
  useEffect(() => {
    if (!profile || profile.role !== 'admin') return;
    let cancelled = false;
    setChartLoading(true);
    db.getMonthlyActivity(range).then(m => {
      if (cancelled) return;
      setMonthly(m);
      setChartLoading(false);
    });
    return () => { cancelled = true; };
  }, [profile, range]);

  // The first page of feedback reloads when the open/all filter changes.
  useEffect(() => {
    if (!profile || profile.role !== 'admin') return;
    let cancelled = false;
    setFeedbackLoading(true);
    db.getFeedbackPage(feedbackFilter === 'open').then(f => {
      if (cancelled) return;
      setFeedback(f);
      setFeedbackHasMore(f.length === FEEDBACK_PAGE_SIZE);
      setFeedbackLoading(false);
    });
    return () => { cancelled = true; };
  }, [profile, feedbackFilter]);

  async function loadMoreFeedback() {
    const last = feedback[feedback.length - 1];
    if (!last) return;
    setFeedbackLoading(true);
    const more = await db.getFeedbackPage(feedbackFilter === 'open', last.created_at);
    setFeedback(prev => [...prev, ...more.filter(m => !prev.some(p => p.id === m.id))]);
    setFeedbackHasMore(more.length === FEEDBACK_PAGE_SIZE);
    setFeedbackLoading(false);
  }

  // Move a report along: new → read → resolved. Optimistic, since the only
  // failure mode is a lost RLS check and the list reloads on next open.
  async function advanceFeedback(f: Feedback) {
    const next: FeedbackStatus = f.status === 'new' ? 'read' : f.status === 'read' ? 'resolved' : 'new';
    setFeedback(prev => prev.map(x => (x.id === f.id ? { ...x, status: next } : x)));
    const wasOpen = f.status !== 'resolved';
    const isOpen = next !== 'resolved';
    if (wasOpen !== isOpen) setFeedbackOpenCount(n => Math.max(0, n + (isOpen ? 1 : -1)));
    await db.setFeedbackStatus(f.id, next);
  }

  // Exports fetch every report rather than only the pages on screen.
  // No user ids are included, only what the dashboard itself shows.
  async function exportFeedback() {
    setExporting(true);
    const all = await db.getAllFeedback();
    downloadCsv(`nepsis-feedback-${today()}.csv`, toCsv(
      ['date', 'category', 'status', 'role', 'platform', 'app_version', 'account_deleted', 'message'],
      all.map(f => [f.created_at, f.category, f.status, f.role, f.platform, f.app_version, f.user_id ? 'no' : 'yes', f.message]),
    ));
    setExporting(false);
  }

  function exportSurvey() {
    downloadCsv(`nepsis-survey-${today()}.csv`, toCsv(
      ['date', 'role', 'platform', 'app_version', 'frequency', 'canon_consistency', 'would_miss_most', 'one_change', 'holding_back', 'holding_back_detail'],
      survey.map(r => [
        r.created_at, r.role, r.platform, r.app_version,
        optLabel(FREQUENCY_OPTS, r.frequency), optLabel(CONSISTENCY_OPTS, r.consistency),
        optLabel(MOST_MISSED_OPTS, r.most_missed), r.one_change,
        yesNo(r.withholding), r.withholding_detail,
      ]),
    ));
  }


  async function handleAddChurch() {
    if (!newChurchName.trim()) {
      setAddChurchError('Church name is required.');
      return;
    }
    setAddingChurch(true);
    setAddChurchError('');
    const church = await db.createChurch(newChurchName, {
      address_line1: newChurchLine1,
      address_line2: newChurchLine2,
      city: newChurchCity,
      state: newChurchState,
      zip: newChurchZip,
    });
    if (church) {
      setChurches((prev) => [
        ...prev,
        { church_id: church.id, church_name: church.name, priests: 0, servants: 0, congregants: 0, foc_linked: 0 },
      ].sort((a, b) => {
        // The unassigned row carries a null name and sorts last, matching
        // the RPC's "nulls last". localeCompare on it would throw.
        if (a.church_name === null) return 1;
        if (b.church_name === null) return -1;
        return a.church_name.localeCompare(b.church_name);
      }));
      setNewChurchName('');
      setNewChurchLine1(''); setNewChurchLine2('');
      setNewChurchCity(''); setNewChurchState(''); setNewChurchZip('');
    } else {
      setAddChurchError('Could not add that church — make sure your role is set to admin in Supabase.');
    }
    setAddingChurch(false);
  }

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

        <TouchableOpacity style={styles.backBtn} onPress={() => goBack('/(tabs)')}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>

        <Text style={styles.eyebrow}>ADMIN</Text>
        <Text style={styles.title}>Dashboard</Text>

        <TouchableOpacity style={styles.roadmapLink} onPress={() => router.push('/roadmap')}>
          <Text style={styles.roadmapLinkText}>Product Roadmap →</Text>
        </TouchableOpacity>

        {loading ? (
          <ActivityIndicator color={colors.gold} style={{ marginTop: 60 }} />
        ) : !summary ? (
          <Text style={styles.errorText}>Could not load stats. Make sure your role is set to admin in Supabase.</Text>
        ) : (
          <>
            {/* ── Tabs ── */}
            {(() => {
              const labels: Record<AdminTab, string> = {
                overview: 'Overview',
                feedback: feedbackOpenCount > 0 ? `Feedback · ${feedbackOpenCount}` : 'Feedback',
                survey: survey.length > 0 ? `Survey · ${survey.length}` : 'Survey',
                churches: 'Churches',
              };
              return (
                <View style={styles.adminTabs}>
                  {ADMIN_TABS.map(t => (
                    <TouchableOpacity key={t} style={styles.adminTab} onPress={() => setTab(t)}>
                      <Text style={[styles.adminTabText, tab === t && { color: colors.gold }]}>{labels[t]}</Text>
                      {tab === t && <View style={styles.adminTabLine} />}
                    </TouchableOpacity>
                  ))}
                </View>
              );
            })()}

            {tab === 'overview' && (<>
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
            <View style={[styles.feedbackHead, { marginTop: 24 }]}>
              <Text style={styles.sectionLabel}>
                {range === null ? 'ACTIVITY — ALL TIME' : `ACTIVITY — LAST ${range} MONTHS`}
              </Text>
              <View style={styles.rangeRow}>
                {CHART_RANGES.map(r => (
                  <TouchableOpacity
                    key={r.label}
                    style={[styles.rangeBtn, range === r.months && styles.rangeBtnActive]}
                    onPress={() => setRange(r.months)}
                  >
                    <Text style={[styles.rangeText, range === r.months && { color: colors.gold }]}>{r.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
            <Card title="" titleIcon="">
              <View style={styles.metricTabs}>
                {CHART_METRICS.map(m => (
                  <TouchableOpacity key={m.key} style={styles.metricTab} onPress={() => setMetric(m.key)}>
                    <Text style={[styles.metricTabText, metric === m.key && { color: m.color }]}>{m.label}</Text>
                    {metric === m.key && <View style={[styles.metricTabLine, { backgroundColor: m.color }]} />}
                  </TouchableOpacity>
                ))}
              </View>

              {chartLoading ? (
                <ActivityIndicator color={colors.gold} style={{ marginVertical: 20 }} />
              ) : monthly.length === 0 ? (
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
            </>)}

            {/* ── Survey ── */}
            {tab === 'survey' && survey.length === 0 && (
              <Text style={styles.emptyText}>No survey responses yet.</Text>
            )}
            {tab === 'survey' && survey.length > 0 && (() => {
              // Distributions first, then each response in full below them.
              // Percentages are of those who ANSWERED that question, not of all
              // responses — every question is skippable, and dividing by the
              // wrong denominator would quietly understate every bar.
              const dist = (key: keyof SurveyRow, opts: Opt[]) => {
                const answered = survey.filter(r => r[key] != null);
                return { answered: answered.length, rows: opts.map(o => ({
                  label: o.label,
                  n: answered.filter(r => r[key] === o.v).length,
                  pct: answered.length ? Math.round(answered.filter(r => r[key] === o.v).length / answered.length * 100) : 0,
                })) };
              };
              const blocks = [
                { q: 'How often do you use Nepsis?', ...dist('frequency', FREQUENCY_OPTS) },
                { q: 'Canon kept more consistently?', ...dist('consistency', CONSISTENCY_OPTS) },
                { q: 'Would miss most', ...dist('most_missed', MOST_MISSED_OPTS) },
              ];
              const withholders = survey.filter(r => r.withholding === true);
              const withholdAnswered = survey.filter(r => r.withholding != null).length;
              const changes = survey.filter(r => (r.one_change ?? '').trim());
              return (
                <>
                  <View style={styles.feedbackHead}>
                    <Text style={styles.sectionLabel}>SURVEY · {survey.length} RESPONSES</Text>
                    <TouchableOpacity onPress={exportSurvey}>
                      <Text style={styles.feedbackToggle}>Export CSV</Text>
                    </TouchableOpacity>
                  </View>
                  {blocks.map(b => (
                    <Card key={b.q} title={b.q} titleIcon="◈">
                      {b.rows.map(r => (
                        <View key={r.label} style={styles.svRow}>
                          <Text style={styles.svLabel}>{r.label}</Text>
                          <View style={styles.svTrack}><View style={[styles.svFill, { width: `${r.pct}%` as any }]} /></View>
                          <Text style={styles.svVal}>{r.pct}%</Text>
                        </View>
                      ))}
                      <Text style={styles.svMeta}>{b.answered} answered</Text>
                    </Card>
                  ))}
                  <Card title="Holding things back?" titleIcon="🔒">
                    <Text style={styles.svBig}>
                      {withholdAnswered ? Math.round(withholders.length / withholdAnswered * 100) : 0}%
                    </Text>
                    <Text style={styles.svMeta}>
                      {withholders.length} of {withholdAnswered} say they avoid putting something in the app
                    </Text>
                    {withholders.filter(r => (r.withholding_detail ?? '').trim()).map(r => (
                      <Text key={r.id} style={styles.svQuote}>“{r.withholding_detail}”</Text>
                    ))}
                  </Card>
                  {changes.length > 0 && (
                    <Card title={`One thing to change (${changes.length})`} flat>
                      {changes.map(r => (
                        <Text key={r.id} style={styles.svQuote}>“{r.one_change}”</Text>
                      ))}
                    </Card>
                  )}

                  {/* ── Individual responses, newest first ── */}
                  <Text style={[styles.sectionLabel, { marginTop: 24 }]}>RESPONSES</Text>
                  {survey.slice(0, surveyShown).map(r => {
                    const answers: [string, string | null][] = [
                      ['Uses Nepsis', optLabel(FREQUENCY_OPTS, r.frequency)],
                      ['Canon more consistent', optLabel(CONSISTENCY_OPTS, r.consistency)],
                      ['Would miss most', optLabel(MOST_MISSED_OPTS, r.most_missed)],
                      ['Holding things back', yesNo(r.withholding)],
                    ];
                    return (
                      <Card key={r.id} title="" titleIcon="">
                        <Text style={styles.fbCat}>
                          {[shortDate(r.created_at), r.role ?? 'unknown role', r.platform, r.app_version ? `v${r.app_version}` : null]
                            .filter(Boolean).join(' · ').toUpperCase()}
                        </Text>
                        {answers.map(([q, a]) => (
                          <View key={q} style={styles.respRow}>
                            <Text style={styles.respQ}>{q}</Text>
                            <Text style={[styles.respA, a == null && { color: colors.faint }]}>{a ?? 'Skipped'}</Text>
                          </View>
                        ))}
                        {(r.withholding_detail ?? '').trim() ? (
                          <Text style={styles.svQuote}>Holding back: “{r.withholding_detail}”</Text>
                        ) : null}
                        {(r.one_change ?? '').trim() ? (
                          <Text style={styles.svQuote}>One change: “{r.one_change}”</Text>
                        ) : null}
                      </Card>
                    );
                  })}
                  {surveyShown < survey.length && (
                    <TouchableOpacity style={styles.addChurchBtn} onPress={() => setSurveyShown(n => n + SURVEY_PAGE_SIZE)}>
                      <Text style={styles.addChurchBtnText}>
                        Show more ({survey.length - surveyShown} left)
                      </Text>
                    </TouchableOpacity>
                  )}
                </>
              );
            })()}

            {/* ── Feedback ── */}
            {tab === 'feedback' && (() => {
              const shown = feedbackFilter === 'open'
                ? feedback.filter(f => f.status !== 'resolved')
                : feedback;
              return (
                <>
                  <View style={styles.feedbackHead}>
                    <Text style={styles.sectionLabel}>FEEDBACK{feedbackOpenCount > 0 ? ` · ${feedbackOpenCount} OPEN` : ''}</Text>
                    <View style={styles.rangeRow}>
                      <TouchableOpacity onPress={() => setFeedbackFilter(p => (p === 'open' ? 'all' : 'open'))}>
                        <Text style={styles.feedbackToggle}>
                          {feedbackFilter === 'open' ? 'Show resolved' : 'Hide resolved'}
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity onPress={exportFeedback} disabled={exporting}>
                        <Text style={[styles.feedbackToggle, exporting && { opacity: 0.5 }]}>
                          {exporting ? 'Exporting…' : 'Export CSV'}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                  {feedbackLoading && feedback.length === 0 ? (
                    <ActivityIndicator color={colors.gold} style={{ marginTop: 20 }} />
                  ) : shown.length === 0 ? (
                    <Text style={styles.emptyText}>
                      {feedback.length === 0 ? 'No feedback yet.' : 'Nothing open — all resolved.'}
                    </Text>
                  ) : shown.map(f => (
                    <Card key={f.id} title="" titleIcon="">
                      <View style={styles.fbHead}>
                        <Text style={styles.fbCat}>{f.category.toUpperCase()}</Text>
                        {/* Tap cycles new → read → resolved. */}
                        <TouchableOpacity onPress={() => advanceFeedback(f)} activeOpacity={0.7}>
                          <Text style={[
                            styles.fbStatus,
                            f.status === 'new' && { color: colors.gold },
                            f.status === 'resolved' && { color: colors.green },
                          ]}>{f.status.toUpperCase()} ▸</Text>
                        </TouchableOpacity>
                      </View>
                      <Text style={styles.fbMsg}>{f.message}</Text>
                      <Text style={styles.fbMeta}>
                        {[
                          f.role ?? 'unknown role',
                          f.platform,
                          f.app_version ? `v${f.app_version}` : null,
                          new Date(f.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
                          f.user_id ? null : 'account deleted',
                        ].filter(Boolean).join(' · ')}
                      </Text>
                    </Card>
                  ))}
                  {feedbackHasMore && (
                    <TouchableOpacity
                      style={[styles.addChurchBtn, feedbackLoading && { opacity: 0.5 }]}
                      disabled={feedbackLoading}
                      onPress={loadMoreFeedback}
                    >
                      <Text style={styles.addChurchBtnText}>{feedbackLoading ? 'Loading…' : 'Load more'}</Text>
                    </TouchableOpacity>
                  )}
                </>
              );
            })()}

            {/* ── Churches ── */}
            {tab === 'churches' && (<>
            <Text style={styles.sectionLabel}>CHURCHES</Text>
            <Card title="" titleIcon="">
              <TextInput
                style={styles.addChurchInput}
                value={newChurchName}
                onChangeText={setNewChurchName}
                placeholder="Church name"
                placeholderTextColor={colors.faint}
              />
              <TextInput
                style={[styles.addChurchInput, { marginTop: 8 }]}
                value={newChurchLine1}
                onChangeText={setNewChurchLine1}
                placeholder="Street address (optional)"
                placeholderTextColor={colors.faint}
              />
              <TextInput
                style={[styles.addChurchInput, { marginTop: 8 }]}
                value={newChurchLine2}
                onChangeText={setNewChurchLine2}
                placeholder="Suite, building, etc. (optional)"
                placeholderTextColor={colors.faint}
              />
              <View style={styles.churchAddrRow}>
                <TextInput
                  style={[styles.addChurchInput, { flex: 2 }]}
                  value={newChurchCity}
                  onChangeText={setNewChurchCity}
                  placeholder="City"
                  placeholderTextColor={colors.faint}
                />
                <TextInput
                  style={[styles.addChurchInput, { flex: 1 }]}
                  value={newChurchState}
                  onChangeText={setNewChurchState}
                  placeholder="ST"
                  placeholderTextColor={colors.faint}
                  autoCapitalize="characters"
                  maxLength={2}
                />
                <TextInput
                  style={[styles.addChurchInput, { flex: 1 }]}
                  value={newChurchZip}
                  onChangeText={setNewChurchZip}
                  placeholder="ZIP"
                  placeholderTextColor={colors.faint}
                  keyboardType="numeric"
                  maxLength={10}
                />
              </View>
              {addChurchError ? <Text style={styles.requestErrorText}>{addChurchError}</Text> : null}
              <TouchableOpacity
                style={[styles.addChurchBtn, addingChurch && { opacity: 0.5 }]}
                disabled={addingChurch}
                onPress={handleAddChurch}
              >
                <Text style={styles.addChurchBtnText}>{addingChurch ? 'Adding…' : '+ Add Church'}</Text>
              </TouchableOpacity>
            </Card>
            {churches.length === 0 ? (
              <Text style={styles.emptyText}>No churches added yet.</Text>
            ) : (
              churches.map((c) => {
                // null church_id = the trailing row for accounts that never
                // picked a church. It is not a church and has no members to
                // compare against, so it is labelled rather than named.
                const unassigned = c.church_id === null;
                return (
                  <Card
                    key={c.church_id ?? '__unassigned__'}
                    title={c.church_name ?? 'No Church Selected'}
                    titleIcon={unassigned ? '◌' : '✦'}
                  >
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
                        {/* A church with no congregants has no linked rate —
                            0% would read as a failure rather than as absence. */}
                        <Text style={[styles.churchStatVal, { color: colors.green }]}>
                          {c.congregants > 0 ? `${Math.round((c.foc_linked / c.congregants) * 100)}%` : '—'}
                        </Text>
                        <Text style={styles.churchStatLabel}>
                          FOC Linked {c.congregants > 0 ? `· ${c.foc_linked}/${c.congregants}` : ''}
                        </Text>
                      </View>
                    </View>
                    {unassigned ? (
                      <Text style={styles.churchNote}>
                        These accounts never picked a church on their Profile, so they are
                        counted in the totals above but in none of the churches listed.
                      </Text>
                    ) : null}
                  </Card>
                );
              })
            )}
            </>)}
          </>
        )}

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = lazyThemed(() => StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.navy },
  scroll: { flex: 1 },
  content: { padding: 20, paddingBottom: 48 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },

  backBtn: { marginBottom: 20 },
  backText: { fontFamily: fonts.lato, fontSize: 13, color: colors.gold },
  svRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  svLabel: { fontFamily: fonts.lato, fontSize: 12, color: colors.textSecond, width: 130 },
  svTrack: { flex: 1, height: 4, backgroundColor: 'rgba(201,168,76,0.15)', borderRadius: 2, overflow: 'hidden' },
  svFill: { height: '100%' as any, backgroundColor: colors.gold, borderRadius: 2 },
  svVal: { fontFamily: fonts.latoBold, fontSize: 11, color: colors.muted, width: 34, textAlign: 'right' },
  svMeta: { fontFamily: fonts.latoLight, fontSize: 11, color: colors.faint, marginTop: 6 },
  svBig: { fontFamily: fonts.cormorantMedium, fontSize: 34, color: colors.gold },
  svQuote: { fontFamily: fonts.lato, fontSize: 13, color: colors.cream, lineHeight: 20, marginTop: 10, fontStyle: 'italic' as any },
  adminTabs: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: colors.border, marginBottom: 20 },
  adminTab: { flex: 1, paddingBottom: 10, alignItems: 'center', position: 'relative' },
  adminTabText: { fontFamily: fonts.latoBold, fontSize: 11, letterSpacing: 0.6, textTransform: 'uppercase', color: colors.muted },
  adminTabLine: { position: 'absolute', bottom: 0, left: 4, right: 4, height: 2, borderRadius: 1, backgroundColor: colors.gold },
  feedbackHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  rangeRow: { flexDirection: 'row', gap: 14, alignItems: 'center', marginBottom: 10 },
  rangeBtn: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, borderWidth: 1, borderColor: 'transparent' },
  rangeBtnActive: { borderColor: colors.gold },
  rangeText: { fontFamily: fonts.latoBold, fontSize: 10, letterSpacing: 0.6, color: colors.muted },
  respRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, marginTop: 8 },
  respQ: { fontFamily: fonts.latoLight, fontSize: 12, color: colors.muted, flex: 1 },
  respA: { fontFamily: fonts.lato, fontSize: 12, color: colors.cream, textAlign: 'right' },
  feedbackToggle: { fontFamily: fonts.lato, fontSize: 11, color: colors.gold },
  fbHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  fbCat: { fontFamily: fonts.latoBold, fontSize: 10, letterSpacing: 1.2, color: colors.muted },
  fbStatus: { fontFamily: fonts.latoBold, fontSize: 10, letterSpacing: 1, color: colors.muted },
  fbMsg: { fontFamily: fonts.lato, fontSize: 13, color: colors.cream, lineHeight: 20 },
  fbMeta: { fontFamily: fonts.latoLight, fontSize: 11, color: colors.faint, marginTop: 8 },
  churchAddrRow: { flexDirection: 'row', gap: 8, marginTop: 8 },
  roadmapLink: { marginBottom: 24, alignSelf: 'flex-start' as any, paddingVertical: 8, paddingHorizontal: 14, borderRadius: 8, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.goldDim },
  roadmapLinkText: { fontFamily: fonts.latoBold, fontSize: 12, letterSpacing: 0.5, color: colors.gold },
  eyebrow: { fontFamily: fonts.latoBold, fontSize: 9, letterSpacing: 2.5, color: colors.gold, marginBottom: 6 },
  title: { fontFamily: fonts.cormorantMedium, fontSize: 34, color: colors.cream, marginBottom: 20 },
  sectionLabel: { fontFamily: fonts.latoBold, fontSize: 9, letterSpacing: 2.5, color: colors.muted, marginBottom: 10 },
  errorText: { fontFamily: fonts.latoLight, fontSize: 13, color: colors.red, marginTop: 20, lineHeight: 20 },
  emptyText: { fontFamily: fonts.latoLight, fontSize: 13, color: colors.muted, marginTop: 8 },

  requestErrorText: { fontFamily: fonts.latoLight, fontSize: 12, color: colors.red, marginBottom: 8, lineHeight: 17 },

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
  healthPill: { flex: 1, backgroundColor: colors.panel, borderWidth: 1, borderColor: colors.border, borderRadius: 10, padding: 12, alignItems: 'center' },
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
  // No flex: 1 here: the wrapper already fills the row, and on web flex: 1
  // inside that column wrapper overrides the height and collapses it to 0.
  barTrack: { height: 8, backgroundColor: colors.creamDim, borderRadius: 4, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 4 },
  barCount: { fontFamily: fonts.latoBold, fontSize: 12, width: 28, textAlign: 'right' },

  // Churches
  addChurchInput: { borderWidth: 1, borderColor: colors.border, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontFamily: fonts.latoLight, fontSize: 13, color: colors.cream },
  addChurchBtn: { marginTop: 10, alignSelf: 'flex-start' as any, borderWidth: 1, borderColor: colors.gold, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 8 },
  addChurchBtnText: { fontFamily: fonts.latoBold, fontSize: 11, letterSpacing: 0.5, color: colors.gold },
  churchStats: { flexDirection: 'row', justifyContent: 'space-around', paddingVertical: 4 },
  churchNote: { fontFamily: fonts.latoLight, fontSize: 11, lineHeight: 16, color: colors.muted, marginTop: 10 },
  churchStat: { alignItems: 'center', gap: 4 },
  churchStatVal: { fontFamily: fonts.cormorantMedium, fontSize: 24 },
  churchStatLabel: { fontFamily: fonts.latoBold, fontSize: 8, letterSpacing: 1, color: colors.muted, textTransform: 'uppercase' },
}));
