import React, { useState, useEffect } from 'react';
import { ScrollView, View, Text, StyleSheet, TouchableOpacity, TextInput, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { colors, fonts } from '@/lib/theme';
import { Card } from '@/components/ui/Card';
import { useSession } from '@/lib/auth';
import * as db from '@/lib/db';
import { useDemoMode } from '@/lib/demo';

// ── Demo data ─────────────────────────────────────────────────
const DEMO_DB: Record<string, { canons: any[]; note: string; prayer: string[] }> = {
  'demo-s1': {
    canons: [
      { id: 'ds1', component: 'Morning Agpeya', frequency: 'Daily', startDate: 'Jun 1, 2026', completions: 5, totalDays: 7 },
      { id: 'ds2', component: 'Gospel Reading (1 chapter)', frequency: 'Daily', startDate: 'Jun 1, 2026', completions: 4, totalDays: 7 },
    ],
    note: "Good attendance at Sunday School. Misses service occasionally due to soccer practice. Spoke about feeling disconnected from faith — suggested starting with the morning Agpeya as a simple anchor. Follow up next Sunday on how it's going.",
    prayer: [
      'Passing his math exams this week',
      'His grandmother who has been ill',
    ],
  },
  'demo-s2': {
    canons: [
      { id: 'ds3', component: 'Evening Compline', frequency: 'Daily', startDate: 'May 20, 2026', completions: 6, totalDays: 7 },
    ],
    note: 'Thoughtful and engaged — asks deep questions about fasting and prayer. Parents are very supportive of her spiritual growth. Mentioned feeling nervous about transitioning to the youth group next year. Worth checking in with her parents.',
    prayer: [
      'Peace for her parents who are going through a difficult season',
      'That she would understand the faith more deeply',
    ],
  },
};

function getDemoData(id: string) {
  return DEMO_DB[id] ?? DEMO_DB['demo-s1'];
}

type TabType = 'canons' | 'notes' | 'prayer';

export default function StudentScreen() {
  const router = useRouter();
  const { id: studentId, name: studentName } = useLocalSearchParams<{ id: string; name: string }>();
  const { user } = useSession();
  const { demoMode } = useDemoMode();
  const [tab, setTab] = useState<TabType>('canons');
  const [loading, setLoading] = useState(!demoMode);

  const demo = getDemoData(studentId ?? '');
  const [canons, setCanons] = useState<any[]>(demo.canons);
  const [savedNote, setSavedNote] = useState(demo.note);
  const [noteInput, setNoteInput] = useState('');
  const [prayer, setPrayer] = useState<string[]>(demo.prayer);
  const [prayerInput, setPrayerInput] = useState('');

  const displayName = studentName ?? 'Student';
  const initials = displayName.split(' ').map((n: string) => n[0]).slice(0, 2).join('').toUpperCase();

  useEffect(() => {
    if (demoMode) {
      const d = getDemoData(studentId ?? '');
      setCanons(d.canons);
      setSavedNote(d.note);
      setPrayer(d.prayer);
      setNoteInput('');
      setPrayerInput('');
    } else if (studentId) {
      loadStudentData();
    }
  }, [studentId, demoMode]);

  async function loadStudentData() {
    if (!user || !studentId) return;
    setLoading(true);

    const [canonData, notePayload, prayerData] = await Promise.all([
      db.getStudentActiveCanons(studentId, user.id),
      db.getAgentProgress(user.id, `servant-notes-${studentId}`),
      db.getServantSharedPrayer(studentId),
    ]);

    if (canonData) {
      const enriched = await Promise.all(canonData.map(async c => {
        const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0];
        const count = await db.countCanonCompletionsSince(c.id, sevenDaysAgo);
        return { id: c.id, component: c.component, frequency: c.frequency, startDate: c.start_date, completions: count, totalDays: 7 };
      }));
      setCanons(enriched);
    }
    if (notePayload?.text) setSavedNote(notePayload.text);
    if (prayerData) setPrayer(prayerData.map((r: any) => r.body));

    setLoading(false);
  }

  async function handleDeactivateCanon(canonId: string) {
    if (demoMode) { setCanons(prev => prev.filter(c => c.id !== canonId)); return; }
    await db.deactivateCanon(canonId);
    setCanons(prev => prev.filter(c => c.id !== canonId));
  }

  async function handleSaveNote() {
    if (!noteInput.trim()) return;
    const newNote = savedNote ? `${savedNote}\n\n${noteInput.trim()}` : noteInput.trim();
    setSavedNote(newNote);
    setNoteInput('');
    if (!demoMode && user) {
      await db.upsertAgentProgress({ user_id: user.id, agent_slug: `servant-notes-${studentId}`, payload: { text: newNote }, updated_at: new Date().toISOString() });
    }
  }

  async function handleAddPrayer() {
    if (!prayerInput.trim()) return;
    setPrayer(prev => [prayerInput.trim(), ...prev]);
    setPrayerInput('');
  }

  const TABS: { value: TabType; label: string }[] = [
    { value: 'canons', label: 'Canons' },
    { value: 'notes', label: 'My Notes' },
    { value: 'prayer', label: 'Prayer' },
  ];

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

        {/* Tabs */}
        <View style={styles.tabs}>
          {TABS.map(t => (
            <TouchableOpacity key={t.value} style={[styles.tab, tab === t.value && styles.tabActive]} onPress={() => setTab(t.value)}>
              <Text style={[styles.tabText, tab === t.value && styles.tabTextActive]}>{t.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {loading ? (
          <ActivityIndicator color={colors.gold} style={{ paddingTop: 20 }} />
        ) : (
          <>
            {/* ── Canons ── */}
            {tab === 'canons' && (
              <>
                <View style={styles.actionRow}>
                  <TouchableOpacity style={styles.btnGold} onPress={() => router.push({ pathname: '/(servant)/assign-canon', params: { studentId: studentId ?? '', studentName: displayName } })}>
                    <Text style={styles.btnGoldText}>+ ASSIGN CANON</Text>
                  </TouchableOpacity>
                </View>
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
              </>
            )}

            {/* ── My Notes ── */}
            {tab === 'notes' && (
              <Card title="My Visitation Notes" titleIcon="✎">
                <Text style={styles.privacyNote}>✦ Private to you — not visible to the student or their FOC.</Text>
                {savedNote ? (
                  <Text style={styles.savedNoteText}>{savedNote}</Text>
                ) : null}
                <TextInput
                  style={styles.noteInput}
                  placeholder="Add a note from today's meeting or call…"
                  placeholderTextColor="rgba(245,240,232,0.22)"
                  multiline
                  numberOfLines={4}
                  value={noteInput}
                  onChangeText={setNoteInput}
                />
                <TouchableOpacity
                  style={[styles.btnGold, { alignSelf: 'flex-start', marginTop: 12, opacity: noteInput.trim() ? 1 : 0.4 }]}
                  onPress={handleSaveNote}
                  disabled={!noteInput.trim()}
                >
                  <Text style={styles.btnGoldText}>SAVE NOTE</Text>
                </TouchableOpacity>
              </Card>
            )}

            {/* ── Prayer Requests ── */}
            {tab === 'prayer' && (
              <Card title="Prayer Requests" titleIcon="◇">
                <Text style={styles.privacyNote}>✦ Requests {displayName.split(' ')[0]} has shared with you.</Text>
                <TextInput
                  style={styles.noteInput}
                  placeholder={`Add a prayer request from ${displayName.split(' ')[0]}…`}
                  placeholderTextColor="rgba(245,240,232,0.22)"
                  multiline
                  numberOfLines={3}
                  value={prayerInput}
                  onChangeText={setPrayerInput}
                />
                <TouchableOpacity
                  style={[styles.btnGold, { alignSelf: 'flex-start', marginTop: 10, marginBottom: 16, opacity: prayerInput.trim() ? 1 : 0.4 }]}
                  onPress={handleAddPrayer}
                  disabled={!prayerInput.trim()}
                >
                  <Text style={styles.btnGoldText}>ADD REQUEST</Text>
                </TouchableOpacity>
                {prayer.length === 0 ? (
                  <View style={styles.emptyState}>
                    <Text style={styles.emptyTitle}>No requests yet</Text>
                    <Text style={styles.emptyBody}>Add prayer requests {displayName.split(' ')[0]} shares with you.</Text>
                  </View>
                ) : (
                  prayer.map((req, i) => (
                    <View key={i} style={[styles.prayerRow, i < prayer.length - 1 && styles.prayerBorder]}>
                      <Text style={styles.prayerBullet}>◇</Text>
                      <Text style={styles.prayerText}>{req}</Text>
                    </View>
                  ))
                )}
              </Card>
            )}
          </>
        )}

        <View style={styles.scopeNote}>
          <Text style={styles.scopeNoteText}>
            ✦ You can see canon progress your students self-report. Confession history and pastoral counseling are accessible only to their Father of Confession.
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

  tabs: { flexDirection: 'row', backgroundColor: 'rgba(10,16,30,0.6)', borderRadius: 10, padding: 4, marginBottom: 16, gap: 2 },
  tab: { flex: 1, paddingVertical: 8, borderRadius: 8, alignItems: 'center' },
  tabActive: { backgroundColor: colors.navyMid, borderWidth: 1, borderColor: colors.border },
  tabText: { fontFamily: fonts.latoBold, fontSize: 11, letterSpacing: 0.5, textTransform: 'uppercase', color: colors.muted },
  tabTextActive: { color: colors.goldLight },

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

  privacyNote: { fontFamily: fonts.latoLight, fontSize: 11, color: colors.muted, marginBottom: 12, opacity: 0.7 },
  savedNoteText: { fontFamily: fonts.latoLight, fontSize: 13, color: colors.muted, lineHeight: 20, marginBottom: 12, padding: 12, backgroundColor: 'rgba(10,16,30,0.4)', borderRadius: 8 },
  noteInput: { backgroundColor: 'rgba(10,16,30,0.7)', borderWidth: 1, borderColor: colors.border, borderRadius: 8, color: colors.cream, fontFamily: fonts.latoLight, fontSize: 13, padding: 12, textAlignVertical: 'top', minHeight: 90 },

  prayerRow: { flexDirection: 'row', gap: 10, paddingVertical: 12, alignItems: 'flex-start' },
  prayerBorder: { borderBottomWidth: 1, borderBottomColor: colors.border },
  prayerBullet: { fontFamily: fonts.lato, fontSize: 11, color: colors.gold, marginTop: 2 },
  prayerText: { flex: 1, fontFamily: fonts.latoLight, fontSize: 13, color: colors.cream, lineHeight: 19 },

  scopeNote: { backgroundColor: 'rgba(201,168,76,0.05)', borderWidth: 1, borderColor: 'rgba(201,168,76,0.15)', borderRadius: 10, padding: 14, marginTop: 8 },
  scopeNoteText: { fontFamily: fonts.latoLight, fontSize: 11, color: colors.muted, lineHeight: 17, letterSpacing: 0.2 },
});
