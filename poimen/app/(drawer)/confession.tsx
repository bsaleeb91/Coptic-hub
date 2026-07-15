import React, { useState, useEffect } from 'react';
import {
  ScrollView, View, Text, StyleSheet, TouchableOpacity,
  TextInput, Alert, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, fonts } from '@/lib/theme';
import { Card } from '@/components/ui/Card';
import { PrivacyNote } from '@/components/ui/PrivacyNote';
import { useSession } from '@/lib/auth';
import * as db from '@/lib/db';
import { useDemoMode } from '@/lib/demo';

// ── Theological content — same in both modes, never stored ───
const TABS = ['Toward God', 'Toward Others', 'Toward Self', 'Omissions'] as const;

const EXAMINATION: Record<string, { text: string; note?: string }[]> = {
  'Toward God': [
    { text: 'Have I neglected or rushed my daily prayers (Agpeya)?', note: 'Reflect on the quality of your prayer, not only its presence.' },
    { text: 'Have I attended the Divine Liturgy with full attention and reverence?' },
    { text: 'Have I kept the fasts of the Church with sincerity?', note: 'Including the spirit of fasting — prayer, almsgiving, and avoidance of entertainment.' },
    { text: 'Have I read and meditated on Scripture regularly?' },
    { text: 'Have I harbored doubt, despair, or distrust in God\'s providence?' },
    { text: 'Have I exposed myself to content that weakens my faith or darkens my mind?' },
    { text: 'Have I been thankful to God for His gifts and blessings?' },
  ],
  'Toward Others': [
    { text: 'Have I harbored anger, bitterness, or unforgiveness toward anyone?' },
    { text: 'Have I spoken ill of others, gossiped, or judged?' },
    { text: 'Have I been honest in my dealings with others?' },
    { text: 'Have I been generous with my time, treasure, and talents?' },
    { text: 'Have I neglected those in need around me?' },
  ],
  'Toward Self': [
    { text: 'Have I indulged in impure thoughts, speech, or actions?' },
    { text: 'Have I been enslaved to any habit or addiction?' },
    { text: 'Have I given adequate care to my body as a temple of the Holy Spirit?' },
    { text: 'Have I been proud, boastful, or unwilling to receive correction?' },
    { text: 'Have I compared myself to others with envy or contempt?' },
  ],
  'Omissions': [
    { text: 'Have I neglected to pray for others — my family, enemies, or the departed?' },
    { text: 'Have I failed to give alms or help those in need when I had the means?' },
    { text: 'Have I omitted visiting the sick, the lonely, or those in hardship?' },
    { text: 'Have I failed to honor my spouse, children, or parents as God calls me to?' },
    { text: 'Have I left good works undone out of laziness, fear, or indifference?' },
    { text: 'Have I neglected to give thanks to God for His mercies?' },
  ],
};

// ── Demo history ─────────────────────────────────────────────
const DEMO_HISTORY = [
  { id: 'd1', date: 'May 21, 2026', label: '47 days ago', note: 'Fr. assigned: 40-day Psalm reading plan' },
  { id: 'd2', date: 'Apr 20, 2026', label: 'Holy Week', note: 'Fr. assigned: Marriage prayer practice' },
  { id: 'd3', date: 'Feb 5, 2026', label: '', note: 'Preparation for the Great Fast', dim: true },
];

// ── Screen ───────────────────────────────────────────────────
export default function ConfessionScreen() {
  const { user, profile, refreshProfile } = useSession();
  const { demoMode } = useDemoMode();
  const [activeTab, setActiveTab] = useState<typeof TABS[number]>('Toward God');

  // Session-only state — cleared when user leaves screen, never stored
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [reflection, setReflection] = useState('');
  const [struggles, setStruggles] = useState('');
  const [growth, setGrowth] = useState('');
  const [scheduleNote, setScheduleNote] = useState('');

  // History from Supabase (real mode)
  const [history, setHistory] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(!demoMode);
  const [requesting, setRequesting] = useState(false);
  const [requestSent, setRequestSent] = useState(false);
  const [selfReportDate, setSelfReportDate] = useState(
    new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  );
  const [selfReporting, setSelfReporting] = useState(false);
  const [selfReportSaved, setSelfReportSaved] = useState(false);
  const [selfReportError, setSelfReportError] = useState('');

  const totalItems = Object.values(EXAMINATION).flat().length;
  const checkedCount = checked.size;
  const pct = Math.round((checkedCount / totalItems) * 100);

  useEffect(() => {
    if (demoMode) {
      setHistory(DEMO_HISTORY);
    } else {
      loadHistory();
    }
  }, [user]);

  async function loadHistory() {
    if (!user) return;
    setLoadingHistory(true);
    const data = await db.getConfessionsForCongregant(user.id);
    if (data) {
      setHistory(data.map(enc => ({
        id: enc.id,
        date: new Date(enc.encountered_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }),
        label: '',
        note: enc.member_note ?? '',
      })));
    }
    setLoadingHistory(false);
  }

  function toggle(key: string) {
    setChecked(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  }

  function clearSession() {
    Alert.alert(
      'Clear Examination',
      'Clear all checkmarks and notes? This only removes session data — nothing was ever stored.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Clear', style: 'destructive', onPress: () => {
          setChecked(new Set());
          setReflection('');
          setStruggles('');
          setGrowth('');
        }},
      ]
    );
  }

  async function handleSelfReport() {
    if (!user) return;
    const parsedDate = new Date(selfReportDate);
    if (isNaN(parsedDate.getTime())) {
      setSelfReportError('Invalid date — use a format like "Jun 15, 2026"');
      return;
    }
    setSelfReportError('');
    setSelfReporting(true);
    await db.setLastConfession(user.id, parsedDate.toISOString());
    await refreshProfile();
    setSelfReporting(false);
    setSelfReportSaved(true);
    setTimeout(() => setSelfReportSaved(false), 2000);
  }

  async function handleRequestAppointment() {
    if (demoMode) { setRequestSent(true); return; }
    setRequesting(true);
    // In real mode, log a pending note to the priest via a prayer request flagged for FOC
    await db.insertPrayerRequest({
      user_id: user!.id,
      category: 'appointment',
      visibility: 'foc_only',
    });
    setRequestSent(true);
    setRequesting(false);
  }

  const currentItems = EXAMINATION[activeTab];

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>

        <Text style={styles.pageTitle}>Confession Preparation</Text>
        <Text style={styles.pageSubtitle}>Private — your entries never leave this device</Text>

        {/* Privacy banner */}
        <View style={styles.privacyBanner}>
          <Text style={styles.privacyLock}>🔒</Text>
          <Text style={styles.privacyText}>
            <Text style={styles.strong}>Complete privacy guarantee. </Text>
            Your examination notes exist only in this session. They are never stored, transmitted, or seen by anyone. Only the date of your confession is recorded.
          </Text>
        </View>

        {/* Progress strip */}
        <View style={styles.progressStrip}>
          <Text style={styles.progressLabel}>EXAMINATION PROGRESS</Text>
          <Text style={styles.progressVal}>{checkedCount} / {totalItems} reviewed</Text>
          {checkedCount > 0 && (
            <TouchableOpacity onPress={clearSession} style={styles.clearBtn}>
              <Text style={styles.clearBtnText}>Clear</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Examination of Conscience */}
        <Card title="Examination of Conscience" flat>
          {/* Tab Nav */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabScroll} contentContainerStyle={styles.tabContent}>
            {TABS.map(tab => {
              const tabItems = EXAMINATION[tab];
              const tabChecked = tabItems.filter((_, i) => checked.has(`${tab}-${i}`)).length;
              return (
                <TouchableOpacity
                  key={tab}
                  style={[styles.tab, activeTab === tab && styles.tabActive]}
                  onPress={() => setActiveTab(tab)}
                >
                  <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>{tab}</Text>
                  {tabChecked > 0 && (
                    <View style={styles.tabBadge}>
                      <Text style={styles.tabBadgeText}>{tabChecked}</Text>
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {/* Questions */}
          {currentItems.map((item, i) => {
            const key = `${activeTab}-${i}`;
            const done = checked.has(key);
            return (
              <TouchableOpacity
                key={key}
                style={[styles.examItem, i < currentItems.length - 1 && styles.examBorder]}
                onPress={() => toggle(key)}
                activeOpacity={0.7}
              >
                <View style={[styles.examCheck, done && styles.examCheckDone]}>
                  {done && <Text style={styles.checkMark}>✓</Text>}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.examText, done && styles.examTextDone]}>{item.text}</Text>
                  {item.note && <Text style={styles.examNote}>{item.note}</Text>}
                </View>
              </TouchableOpacity>
            );
          })}

          <View style={styles.divider} />

          <Text style={styles.formLabel}>PERSONAL REFLECTION</Text>
          <TextInput
            style={styles.textarea}
            multiline
            placeholder="What has been weighing on your heart since your last confession? What do you wish to bring before God?"
            placeholderTextColor="rgba(245,240,232,0.22)"
            value={reflection}
            onChangeText={setReflection}
          />

          <Text style={[styles.formLabel, { marginTop: 14 }]}>RECURRING STRUGGLES (PRIVATE)</Text>
          <TextInput
            style={styles.textarea}
            multiline
            placeholder="Note any patterns you want to address — recurring temptations, persistent habits, or areas of spiritual weakness..."
            placeholderTextColor="rgba(245,240,232,0.22)"
            value={struggles}
            onChangeText={setStruggles}
          />

          <Text style={[styles.formLabel, { marginTop: 14 }]}>ANSWERED PRAYERS & GROWTH</Text>
          <TextInput
            style={[styles.textarea, { minHeight: 64 }]}
            multiline
            placeholder="Note moments of grace, answered prayers, or growth to give thanks for..."
            placeholderTextColor="rgba(245,240,232,0.22)"
            value={growth}
            onChangeText={setGrowth}
          />

          <View style={styles.sessionNote}>
            <Text style={styles.sessionNoteText}>
              ✦ Session only — these notes disappear when you leave this screen.
            </Text>
          </View>
        </Card>

        {/* Schedule */}
        <Card title="Schedule Confession" titleIcon="◈">
          <View style={styles.comingSoonCard}>
            <Text style={styles.comingSoonIcon}>✝</Text>
            <Text style={styles.comingSoonTitle}>Contact Your Father of Confession</Text>
            <Text style={styles.comingSoonBody}>
              Reach out to your Father of Confession directly to arrange your next confession.
              In-app scheduling is coming in a future update.
            </Text>
          </View>
        </Card>

        {/* Self-report — hidden in demo mode */}
        {!demoMode && (
          <Card title="Log My Last Confession" titleIcon="✝">
            {profile?.last_confession_at && (
              <Text style={styles.lastConfDate}>
                Last recorded: {new Date(profile.last_confession_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
              </Text>
            )}
            <TextInput
              style={styles.dateInput}
              value={selfReportDate}
              onChangeText={t => { setSelfReportDate(t); setSelfReportError(''); }}
              placeholder="E.g., Jun 15, 2026"
              placeholderTextColor="rgba(245,240,232,0.22)"
            />
            {selfReportError ? <Text style={styles.selfReportError}>{selfReportError}</Text> : null}
            <TouchableOpacity
              style={[styles.logBtn, selfReporting && styles.logBtnDisabled]}
              onPress={handleSelfReport}
              disabled={selfReporting}
              activeOpacity={0.85}
            >
              <Text style={styles.logBtnText}>
                {selfReporting ? 'Saving…' : selfReportSaved ? '✓ LOGGED' : 'LOG CONFESSION'}
              </Text>
            </TouchableOpacity>
            <Text style={styles.selfReportHint}>Only the date is saved. No content is recorded.</Text>
          </Card>
        )}

        {/* History */}
        <Card title="Confession History" flat>
          {loadingHistory ? (
            <ActivityIndicator color={colors.gold} style={{ paddingVertical: 20 }} />
          ) : history.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyIcon}>✝</Text>
              <Text style={styles.emptyTitle}>No history yet</Text>
              <Text style={styles.emptyBody}>
                Confession dates appear here after your Father of Confession logs your meeting. Content is never recorded.
              </Text>
            </View>
          ) : (
            <>
              {history.map((item, i) => (
                <View key={item.id} style={[styles.histItem, i < history.length - 1 && styles.histBorder]}>
                  <Text style={[styles.histDate, item.dim && { opacity: 0.5 }]}>
                    {item.date}{item.label ? ` · ${item.label}` : ''}
                  </Text>
                  <Text style={styles.histTitle}>Holy Confession</Text>
                  {item.note ? <Text style={styles.histNote}>{item.note}</Text> : null}
                  <View style={styles.histTag}>
                    <Text style={styles.histTagText}>✝ Received</Text>
                  </View>
                </View>
              ))}
              <Text style={styles.histFooter}>
                Dates only. Content protected by the holy seal.
              </Text>
            </>
          )}
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
  pageSubtitle: { fontFamily: fonts.latoLight, fontSize: 12, color: colors.muted, marginBottom: 20 },

  privacyBanner: { flexDirection: 'row', gap: 12, alignItems: 'flex-start', backgroundColor: 'rgba(201,168,76,0.05)', borderWidth: 1, borderColor: 'rgba(201,168,76,0.2)', borderRadius: 12, padding: 16, marginBottom: 16 },
  privacyLock: { fontSize: 18, flexShrink: 0 },
  privacyText: { fontFamily: fonts.latoLight, fontSize: 12, color: colors.muted, lineHeight: 18, flex: 1 },
  strong: { fontFamily: fonts.latoBold, color: colors.cream },

  progressStrip: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, paddingHorizontal: 14, backgroundColor: colors.cardBg, borderWidth: 1, borderColor: colors.border, borderRadius: 10, marginBottom: 16 },
  progressLabel: { fontFamily: fonts.latoBold, fontSize: 9, letterSpacing: 1.5, textTransform: 'uppercase', color: colors.muted, flex: 1 },
  progressVal: { fontFamily: fonts.latoBold, fontSize: 12, color: colors.cream, flexShrink: 0 },
  clearBtn: { borderWidth: 1, borderColor: 'rgba(192,57,43,0.4)', borderRadius: 6, paddingHorizontal: 10, paddingVertical: 5 },
  clearBtnText: { fontFamily: fonts.latoBold, fontSize: 10, color: colors.red, letterSpacing: 0.5 },

  tabScroll: { marginHorizontal: -18, marginBottom: 16 },
  tabContent: { paddingHorizontal: 18, gap: 0 },
  tab: { paddingHorizontal: 14, paddingVertical: 9, borderBottomWidth: 2, borderBottomColor: 'transparent', flexDirection: 'row', alignItems: 'center', gap: 6 },
  tabActive: { borderBottomColor: colors.gold },
  tabText: { fontFamily: fonts.latoBold, fontSize: 11, letterSpacing: 0.5, textTransform: 'uppercase', color: colors.muted },
  tabTextActive: { color: colors.goldLight },
  tabBadge: { backgroundColor: colors.gold, borderRadius: 8, width: 16, height: 16, alignItems: 'center', justifyContent: 'center' },
  tabBadgeText: { fontFamily: fonts.latoBold, fontSize: 9, color: colors.navy },

  examItem: { flexDirection: 'row', gap: 10, paddingVertical: 9, alignItems: 'flex-start' },
  examBorder: { borderBottomWidth: 1, borderBottomColor: 'rgba(201,168,76,0.06)' },
  examCheck: { width: 16, height: 16, borderRadius: 4, borderWidth: 1, borderColor: colors.border, marginTop: 2, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  examCheckDone: { backgroundColor: colors.gold, borderColor: colors.gold },
  checkMark: { fontSize: 11, color: colors.navy, fontWeight: '700' },
  examText: { fontFamily: fonts.latoLight, fontSize: 13, color: colors.cream, lineHeight: 18 },
  examTextDone: { textDecorationLine: 'line-through', opacity: 0.38 },
  examNote: { fontFamily: fonts.latoLight, fontSize: 11, color: colors.muted, marginTop: 3, fontStyle: 'italic' },

  divider: { height: 1, backgroundColor: colors.border, marginVertical: 16 },
  formLabel: { fontFamily: fonts.latoBold, fontSize: 10, letterSpacing: 1.5, textTransform: 'uppercase', color: colors.gold, opacity: 0.8, marginBottom: 8 },
  textarea: { backgroundColor: 'rgba(10,16,30,0.7)', borderWidth: 1, borderColor: colors.border, borderRadius: 8, color: colors.cream, fontFamily: fonts.latoLight, fontSize: 13, padding: 12, minHeight: 80, textAlignVertical: 'top', lineHeight: 20 },

  sessionNote: { backgroundColor: 'rgba(201,168,76,0.06)', borderWidth: 1, borderColor: 'rgba(201,168,76,0.15)', borderRadius: 8, padding: 10, marginTop: 14 },
  sessionNoteText: { fontFamily: fonts.latoLight, fontSize: 11, color: colors.muted, letterSpacing: 0.2 },

  btnGoldFull: { backgroundColor: colors.gold, borderRadius: 8, padding: 12, alignItems: 'center', marginTop: 14 },
  btnDisabled: { opacity: 0.4 },
  btnGoldText: { fontFamily: fonts.latoBold, fontSize: 11, color: colors.navy, letterSpacing: 0.8 },

  requestSentCard: { alignItems: 'center', paddingVertical: 20, gap: 8 },
  requestSentIcon: { fontSize: 32, color: colors.gold },
  requestSentTitle: { fontFamily: fonts.cormorantMedium, fontSize: 20, color: colors.cream },
  requestSentBody: { fontFamily: fonts.latoLight, fontSize: 12, color: colors.muted, textAlign: 'center', lineHeight: 18 },

  comingSoonCard: { alignItems: 'center', paddingVertical: 20, gap: 8 },
  comingSoonIcon: { fontSize: 28, color: colors.muted, opacity: 0.5 },
  comingSoonTitle: { fontFamily: fonts.cormorantMedium, fontSize: 18, color: colors.cream },
  comingSoonBody: { fontFamily: fonts.latoLight, fontSize: 12, color: colors.muted, textAlign: 'center', lineHeight: 18 },

  histItem: { paddingVertical: 12 },
  histBorder: { borderBottomWidth: 1, borderBottomColor: colors.border },
  histDate: { fontFamily: fonts.latoBold, fontSize: 9, letterSpacing: 1.5, textTransform: 'uppercase', color: colors.gold, opacity: 0.7, marginBottom: 3 },
  histTitle: { fontFamily: fonts.latoBold, fontSize: 13, color: colors.cream, marginBottom: 2 },
  histNote: { fontFamily: fonts.latoLight, fontSize: 12, color: colors.muted, lineHeight: 18 },
  histTag: { backgroundColor: 'rgba(201,168,76,0.15)', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 20, alignSelf: 'flex-start', marginTop: 6 },
  histTagText: { fontFamily: fonts.latoBold, fontSize: 10, color: colors.goldLight, letterSpacing: 0.5 },
  histFooter: { fontFamily: fonts.latoLight, fontSize: 10, color: colors.muted, fontStyle: 'italic', marginTop: 10, textAlign: 'center', opacity: 0.6 },

  emptyState: { alignItems: 'center', paddingVertical: 20, gap: 6 },
  emptyIcon: { fontSize: 28, color: colors.muted, opacity: 0.4 },
  emptyTitle: { fontFamily: fonts.latoBold, fontSize: 13, color: colors.muted },
  emptyBody: { fontFamily: fonts.latoLight, fontSize: 11, color: colors.muted, textAlign: 'center', lineHeight: 17, opacity: 0.7 },

  // Self-report
  lastConfDate: { fontFamily: fonts.latoLight, fontSize: 12, color: colors.gold, marginBottom: 10, opacity: 0.85 },
  dateInput: { backgroundColor: 'rgba(10,16,30,0.7)', borderWidth: 1, borderColor: colors.border, borderRadius: 8, color: colors.cream, fontFamily: fonts.latoLight, fontSize: 13, padding: 12, marginBottom: 10 },
  selfReportError: { fontFamily: fonts.latoLight, fontSize: 11, color: colors.red, marginBottom: 8 },
  logBtn: { backgroundColor: colors.gold, borderRadius: 8, paddingVertical: 12, alignItems: 'center', marginBottom: 10 },
  logBtnDisabled: { opacity: 0.5 },
  logBtnText: { fontFamily: fonts.latoBold, fontSize: 12, color: colors.navy, letterSpacing: 1 },
  selfReportHint: { fontFamily: fonts.latoLight, fontSize: 10, color: colors.muted, textAlign: 'center', opacity: 0.7 },
});
