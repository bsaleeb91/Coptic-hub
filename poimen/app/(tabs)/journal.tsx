import React, { useState, useEffect, useRef } from 'react';
import {
  ScrollView, View, Text, StyleSheet, TouchableOpacity,
  TextInput, Animated, PanResponder, Alert, ActivityIndicator, Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, fonts } from '@/lib/theme';
import { Card } from '@/components/ui/Card';
import { PrivacyNote } from '@/components/ui/PrivacyNote';
import { useSession } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { useDemoMode } from '@/lib/demo';

type Frequency = 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly';

const FREQ_COLOR: Record<Frequency, string> = {
  daily: colors.blue, weekly: colors.green, monthly: colors.goldLight,
  quarterly: colors.purple, yearly: colors.yellow,
};

const FREQ_OPTS: Frequency[] = ['daily', 'weekly', 'monthly', 'quarterly', 'yearly'];

const DEMO_DISCIPLINES = [
  { id: 'd1', icon: '🙏', name: 'Morning Agpeya', freq: 'daily' as Frequency, streak: '5-day streak', shared: true, done: true },
  { id: 'd2', icon: '📖', name: 'Bible Reading', freq: 'daily' as Frequency, streak: '5-day streak', shared: true, done: false },
  { id: 'd3', icon: '🕯', name: 'Vespers', freq: 'weekly' as Frequency, streak: '3 this month', shared: true, done: false },
  { id: 'd4', icon: '✝', name: 'Divine Liturgy', freq: 'weekly' as Frequency, streak: '8 / 10 Sundays', shared: true, done: true },
  { id: 'd5', icon: '❤', name: 'Almsgiving', freq: 'monthly' as Frequency, streak: '', shared: false, done: false },
  { id: 'd6', icon: '🌿', name: 'Retreat / Day of Prayer', freq: 'quarterly' as Frequency, streak: '', shared: true, done: false },
];

const DEMO_ENTRIES = [
  { id: 'e1', created_at: '2026-06-04', title: 'Reflection on the fast', reflection: 'Felt a deepening sense of gratitude during the Agpeya today. The third hour prayer felt different — more present.' },
  { id: 'e2', created_at: '2026-05-30', title: 'Gratitude', reflection: 'Reflecting on God\'s faithfulness with the baby\'s health. Psalm 116 kept coming to mind.' },
  { id: 'e3', created_at: '2026-05-22', title: 'After confession', reflection: 'Feeling lighter. Beginning the 40-day Psalm plan. Starting with Psalm 50.' },
];

const ICONS = ['🙏', '📖', '🕯', '✝', '❤', '🌿', '⛪', '🫶', '✨', '🕊'];

// ── Swipeable discipline row ─────────────────────────────────
function SwipeableDiscipline({ disc, done, onToggle, onDelete }: {
  disc: any; done: boolean; onToggle: () => void; onDelete: () => void;
}) {
  const translateX = useRef(new Animated.Value(0)).current;
  const ACTION_WIDTH = 70;

  const panResponder = useRef(PanResponder.create({
    onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 8 && Math.abs(g.dy) < 20,
    onPanResponderMove: (_, g) => {
      if (g.dx < 0) translateX.setValue(Math.max(g.dx, -ACTION_WIDTH));
    },
    onPanResponderRelease: (_, g) => {
      if (g.dx < -ACTION_WIDTH / 2) {
        Animated.spring(translateX, { toValue: -ACTION_WIDTH, useNativeDriver: true }).start();
      } else {
        Animated.spring(translateX, { toValue: 0, useNativeDriver: true }).start();
      }
    },
  })).current;

  function close() {
    Animated.spring(translateX, { toValue: 0, useNativeDriver: true }).start();
  }

  return (
    <View style={styles.swipeContainer}>
      <View style={styles.swipeActions}>
        <TouchableOpacity style={styles.swipeActionDelete} onPress={() => { close(); onDelete(); }}>
          <Text style={styles.swipeActionText}>✕{'\n'}Delete</Text>
        </TouchableOpacity>
      </View>
      <Animated.View style={{ transform: [{ translateX }] }} {...panResponder.panHandlers}>
        <View style={[styles.discItem, done && styles.discItemDone]}>
          <TouchableOpacity onPress={onToggle}>
            <View style={[styles.discCheck, done && styles.discCheckDone]}>
              {done && <Text style={styles.discCheckMark}>✓</Text>}
            </View>
          </TouchableOpacity>
          <View style={styles.discIcon}>
            <Text style={styles.discIconEmoji}>{disc.icon}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.discName, done && styles.discNameDone]}>{disc.name}</Text>
            <View style={styles.discMeta}>
              <Text style={[styles.discFreq, { color: FREQ_COLOR[disc.freq as Frequency] }]}>{disc.freq.toUpperCase()}</Text>
              {disc.streak ? <Text style={styles.discStreak}>{disc.streak}</Text> : null}
            </View>
          </View>
          {disc.shared && (
            <View style={styles.sharedBadge}>
              <Text style={styles.sharedBadgeText}>✝ FOC</Text>
            </View>
          )}
        </View>
      </Animated.View>
    </View>
  );
}

// ── Swipeable entry row ──────────────────────────────────────
function SwipeableEntry({ entry, onDelete }: { entry: any; onDelete: () => void }) {
  const translateX = useRef(new Animated.Value(0)).current;
  const ACTION_WIDTH = 70;

  const panResponder = useRef(PanResponder.create({
    onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 8 && Math.abs(g.dy) < 20,
    onPanResponderMove: (_, g) => {
      if (g.dx < 0) translateX.setValue(Math.max(g.dx, -ACTION_WIDTH));
    },
    onPanResponderRelease: (_, g) => {
      if (g.dx < -ACTION_WIDTH / 2) {
        Animated.spring(translateX, { toValue: -ACTION_WIDTH, useNativeDriver: true }).start();
      } else {
        Animated.spring(translateX, { toValue: 0, useNativeDriver: true }).start();
      }
    },
  })).current;

  function close() {
    Animated.spring(translateX, { toValue: 0, useNativeDriver: true }).start();
  }

  return (
    <View style={styles.swipeContainer}>
      <View style={styles.swipeActions}>
        <TouchableOpacity style={styles.swipeActionDelete} onPress={() => { close(); onDelete(); }}>
          <Text style={styles.swipeActionText}>✕{'\n'}Delete</Text>
        </TouchableOpacity>
      </View>
      <Animated.View style={{ transform: [{ translateX }] }} {...panResponder.panHandlers}>
        <View style={styles.entryItem}>
          <Text style={styles.entryDate}>
            {new Date(entry.created_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
          </Text>
          <Text style={styles.entryTitle}>{entry.title}</Text>
          <Text style={styles.entryPreview} numberOfLines={2}>{entry.reflection}</Text>
        </View>
      </Animated.View>
    </View>
  );
}

// ── Screen ───────────────────────────────────────────────────
export default function JournalScreen() {
  const { user } = useSession();
  const { demoMode } = useDemoMode();

  const [disciplines, setDisciplines] = useState<any[]>([]);
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [entries, setEntries] = useState<any[]>([]);
  const [loading, setLoading] = useState(!demoMode);
  const [savingEntry, setSavingEntry] = useState(false);

  // New entry form
  const [entryTitle, setEntryTitle] = useState('');
  const [reflection, setReflection] = useState('');
  const [scripture, setScripture] = useState('');
  const [prayerIntention, setPrayerIntention] = useState('');

  // Add discipline modal
  const [showAddDisc, setShowAddDisc] = useState(false);
  const [newDiscName, setNewDiscName] = useState('');
  const [newDiscFreq, setNewDiscFreq] = useState<Frequency>('daily');
  const [newDiscIcon, setNewDiscIcon] = useState('🙏');
  const [newDiscShared, setNewDiscShared] = useState(false);

  useEffect(() => {
    if (demoMode) {
      setDisciplines(DEMO_DISCIPLINES);
      setChecked(new Set(DEMO_DISCIPLINES.filter(d => d.done).map(d => d.id)));
      setEntries(DEMO_ENTRIES);
    } else {
      load();
    }
  }, [user]);

  async function load() {
    if (!user) return;
    setLoading(true);
    const [{ data: progData }, { data: entryData }] = await Promise.all([
      supabase.from('agent_progress').select('payload').eq('user_id', user.id).eq('agent_slug', 'journal-disciplines').single(),
      supabase.from('agent_progress').select('payload').eq('user_id', user.id).eq('agent_slug', 'journal-entries').single(),
    ]);
    if (progData?.payload?.disciplines) {
      setDisciplines(progData.payload.disciplines);
      const today = new Date().toDateString();
      const todayChecked: string[] = progData.payload.checkedToday?.date === today
        ? progData.payload.checkedToday.ids : [];
      setChecked(new Set(todayChecked));
    }
    if (entryData?.payload?.entries) setEntries(entryData.payload.entries);
    setLoading(false);
  }

  async function saveDisciplines(discs: any[], checkedIds?: Set<string>) {
    if (!user || demoMode) return;
    const ids = checkedIds ?? checked;
    await supabase.from('agent_progress').upsert({
      user_id: user.id, agent_slug: 'journal-disciplines',
      payload: { disciplines: discs, checkedToday: { date: new Date().toDateString(), ids: [...ids] } },
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id,agent_slug' });
  }

  async function saveEntries(newEntries: any[]) {
    if (!user || demoMode) return;
    await supabase.from('agent_progress').upsert({
      user_id: user.id, agent_slug: 'journal-entries',
      payload: { entries: newEntries },
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id,agent_slug' });
  }

  function toggleDisc(id: string) {
    setChecked(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      saveDisciplines(disciplines, next);
      return next;
    });
  }

  function addDiscipline() {
    if (!newDiscName.trim()) return;
    const disc = { id: Date.now().toString(), icon: newDiscIcon, name: newDiscName.trim(), freq: newDiscFreq, streak: '', shared: newDiscShared, done: false };
    const updated = [...disciplines, disc];
    setDisciplines(updated);
    saveDisciplines(updated);
    setNewDiscName(''); setNewDiscFreq('daily'); setNewDiscIcon('🙏'); setNewDiscShared(false);
    setShowAddDisc(false);
  }

  function deleteDiscipline(id: string) {
    Alert.alert('Remove Practice', 'Remove this spiritual practice?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => {
        const updated = disciplines.filter(d => d.id !== id);
        setDisciplines(updated);
        saveDisciplines(updated);
      }},
    ]);
  }

  async function saveEntry() {
    if (!reflection.trim()) return;
    setSavingEntry(true);
    const entry = {
      id: Date.now().toString(),
      created_at: new Date().toISOString(),
      title: entryTitle.trim() || 'Untitled',
      reflection: reflection.trim(),
      scripture: scripture.trim(),
      prayer_intention: prayerIntention.trim(),
    };
    const updated = [entry, ...entries];
    setEntries(updated);
    await saveEntries(updated);
    setEntryTitle(''); setReflection(''); setScripture(''); setPrayerIntention('');
    setSavingEntry(false);
  }

  function deleteEntry(id: string) {
    Alert.alert('Delete Entry', 'Delete this journal entry?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => {
        const updated = entries.filter(e => e.id !== id);
        setEntries(updated);
        saveEntries(updated);
      }},
    ]);
  }

  const dailyDiscs = disciplines.filter(d => d.freq === 'daily');
  const dailyDone = dailyDiscs.filter(d => checked.has(d.id)).length;
  const todayStr = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>

        <Text style={styles.pageTitle}>Spiritual Journal</Text>
        <Text style={styles.pageSubtitle}>Reflections, disciplines, and growth</Text>

        {/* Disciplines */}
        <Card
          title="Spiritual Practices"
          titleIcon="◈"
          action={
            <TouchableOpacity style={styles.btnGold} onPress={() => setShowAddDisc(true)}>
              <Text style={styles.btnGoldText}>+ ADD</Text>
            </TouchableOpacity>
          }
        >
          {dailyDiscs.length > 0 && (
            <View style={styles.progressRow}>
              <Text style={styles.progressIcon}>📅</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.progressLabel}>TODAY'S PROGRESS</Text>
                <View style={styles.progressTrack}>
                  <View style={[styles.progressFill, { width: `${dailyDiscs.length ? (dailyDone / dailyDiscs.length) * 100 : 0}%` as any }]} />
                </View>
              </View>
              <Text style={styles.progressVal}>{dailyDone} / {dailyDiscs.length}</Text>
            </View>
          )}

          {loading ? (
            <ActivityIndicator color={colors.gold} style={{ paddingVertical: 20 }} />
          ) : disciplines.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyIcon}>◈</Text>
              <Text style={styles.emptyTitle}>No practices yet</Text>
              <Text style={styles.emptyBody}>Add your first spiritual practice to track daily.</Text>
            </View>
          ) : (
            disciplines.map((disc) => (
              <SwipeableDiscipline
                key={disc.id}
                disc={disc}
                done={checked.has(disc.id)}
                onToggle={() => toggleDisc(disc.id)}
                onDelete={() => deleteDiscipline(disc.id)}
              />
            ))
          )}
          <PrivacyNote text="Only practice names and completion % are shared with your Father of Confession — never your journal content." />
        </Card>

        {/* Today's Entry */}
        <Card title="Today's Entry" titleIcon="✦" action={<Text style={styles.dateLabel}>{todayStr}</Text>}>
          <Text style={styles.formLabel}>TITLE (optional)</Text>
          <TextInput style={styles.input} placeholder="e.g. Reflection on the fast" placeholderTextColor="rgba(245,240,232,0.22)" value={entryTitle} onChangeText={setEntryTitle} />
          <Text style={[styles.formLabel, { marginTop: 14 }]}>REFLECTION</Text>
          <TextInput style={[styles.textarea, { minHeight: 110 }]} multiline placeholder="What is God saying to you today? What are you grateful for? What are you struggling with?" placeholderTextColor="rgba(245,240,232,0.22)" value={reflection} onChangeText={setReflection} />
          <Text style={[styles.formLabel, { marginTop: 14 }]}>SCRIPTURE THAT SPOKE TO ME</Text>
          <TextInput style={styles.input} placeholder="e.g. Psalm 63:1 — O God, You are my God..." placeholderTextColor="rgba(245,240,232,0.22)" value={scripture} onChangeText={setScripture} />
          <Text style={[styles.formLabel, { marginTop: 14 }]}>PRAYER INTENTION</Text>
          <TextInput style={[styles.textarea, { minHeight: 56 }]} multiline placeholder="What are you bringing to God in prayer today?" placeholderTextColor="rgba(245,240,232,0.22)" value={prayerIntention} onChangeText={setPrayerIntention} />
          <TouchableOpacity
            style={[styles.btnGoldFull, (!reflection.trim() || savingEntry) && styles.btnDisabled]}
            onPress={saveEntry}
            disabled={!reflection.trim() || savingEntry}
          >
            {savingEntry ? <ActivityIndicator color={colors.navy} /> : <Text style={styles.btnGoldFullText}>SAVE ENTRY</Text>}
          </TouchableOpacity>
        </Card>

        {/* FOC Assignment */}
        {demoMode && (
          <Card title="Fr. Bishoy's Assignment" titleIcon="◌">
            <Text style={styles.assignSub}>Assigned after your last confession on May 21:</Text>
            <Text style={styles.assignTitle}>40-Day Psalm Reading Plan</Text>
            <Text style={styles.assignBody}>Read one Psalm per day with reflection. Today is Day 18 — Psalm 18.</Text>
            <View style={styles.progressRowSimple}>
              <Text style={styles.progressLabel}>Progress</Text>
              <Text style={styles.progressLabel}>Day 18 of 40</Text>
            </View>
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: '45%' }]} />
            </View>
          </Card>
        )}

        {/* Past Entries */}
        <Card title={`Past Entries (${entries.length})`} titleIcon="◎">
          {entries.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyIcon}>◎</Text>
              <Text style={styles.emptyTitle}>No entries yet</Text>
              <Text style={styles.emptyBody}>Your saved entries will appear here.</Text>
            </View>
          ) : (
            entries.map((entry, i) => (
              <View key={entry.id}>
                <SwipeableEntry entry={entry} onDelete={() => deleteEntry(entry.id)} />
                {i < entries.length - 1 && <View style={styles.divider} />}
              </View>
            ))
          )}
        </Card>

        {/* Today's Prompt — static liturgical, same in both modes */}
        <Card title="Today's Prompt" titleIcon="◇">
          <Text style={styles.promptFast}>Apostles' Fast · Day 12</Text>
          <Text style={styles.promptQuote}>"Watch and pray that you may not enter into temptation. The spirit indeed is willing, but the flesh is weak."</Text>
          <Text style={styles.promptRef}>Matthew 26:41</Text>
          <View style={styles.divider} />
          <Text style={styles.promptReflection}>
            Reflect on a moment this week when your spirit was willing but your flesh felt weak. What did you learn about yourself? What did you learn about God's grace?
          </Text>
        </Card>

      </ScrollView>

      {/* Add Practice Modal */}
      <Modal visible={showAddDisc} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Add Spiritual Practice</Text>

            <Text style={styles.formLabel}>NAME</Text>
            <TextInput style={styles.input} placeholder="e.g. Evening Agpeya" placeholderTextColor="rgba(245,240,232,0.22)" value={newDiscName} onChangeText={setNewDiscName} autoFocus />

            <Text style={[styles.formLabel, { marginTop: 14 }]}>ICON</Text>
            <View style={styles.iconRow}>
              {ICONS.map(icon => (
                <TouchableOpacity key={icon} style={[styles.iconOpt, newDiscIcon === icon && styles.iconOptActive]} onPress={() => setNewDiscIcon(icon)}>
                  <Text style={styles.iconEmoji}>{icon}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={[styles.formLabel, { marginTop: 14 }]}>FREQUENCY</Text>
            <View style={styles.freqRow}>
              {FREQ_OPTS.map(f => (
                <TouchableOpacity key={f} style={[styles.freqPill, newDiscFreq === f && styles.freqPillActive]} onPress={() => setNewDiscFreq(f)}>
                  <Text style={[styles.freqPillText, newDiscFreq === f && styles.freqPillTextActive]}>{f}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity style={styles.shareToggle} onPress={() => setNewDiscShared(p => !p)}>
              <View style={[styles.shareCheckbox, newDiscShared && styles.shareCheckboxActive]}>
                {newDiscShared && <Text style={styles.shareCheckMark}>✓</Text>}
              </View>
              <Text style={styles.shareToggleText}>Share completion % with my Father of Confession</Text>
            </TouchableOpacity>

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.btnGhost} onPress={() => setShowAddDisc(false)}>
                <Text style={styles.btnGhostText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.btnGoldFull, { flex: 1, marginTop: 0 }]} onPress={addDiscipline} disabled={!newDiscName.trim()}>
                <Text style={styles.btnGoldFullText}>ADD PRACTICE</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.navy },
  scroll: { flex: 1 },
  content: { padding: 20, paddingBottom: 40 },

  pageTitle: { fontFamily: fonts.cormorantMedium, fontSize: 28, color: colors.cream, marginBottom: 4 },
  pageSubtitle: { fontFamily: fonts.latoLight, fontSize: 12, color: colors.muted, marginBottom: 20 },

  btnGold: { backgroundColor: colors.gold, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
  btnGoldText: { fontFamily: fonts.latoBold, fontSize: 9, color: colors.navy, letterSpacing: 0.8 },
  btnGhost: { borderWidth: 1, borderColor: colors.border, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 10 },
  btnGhostText: { fontFamily: fonts.lato, fontSize: 11, color: colors.muted },

  swipeContainer: { position: 'relative', overflow: 'hidden' },
  swipeActions: { position: 'absolute', right: 0, top: 0, bottom: 0, flexDirection: 'row' },
  swipeActionDelete: { width: 70, backgroundColor: 'rgba(192,57,43,0.25)', alignItems: 'center', justifyContent: 'center' },
  swipeActionText: { fontFamily: fonts.latoBold, fontSize: 10, color: colors.cream, textAlign: 'center', letterSpacing: 0.5 },

  progressRow: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: 'rgba(10,16,30,0.4)', borderWidth: 1, borderColor: colors.border, borderRadius: 10, padding: 12, marginBottom: 14 },
  progressIcon: { fontSize: 16 },
  progressLabel: { fontFamily: fonts.latoBold, fontSize: 10, letterSpacing: 1.2, textTransform: 'uppercase', color: colors.muted, marginBottom: 5 },
  progressTrack: { height: 4, backgroundColor: 'rgba(245,240,232,0.07)', borderRadius: 4, overflow: 'hidden', flex: 1 },
  progressFill: { height: '100%', backgroundColor: colors.gold, borderRadius: 4 },
  progressVal: { fontFamily: fonts.latoBold, fontSize: 13, color: colors.cream },

  discItem: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: 'rgba(10,16,30,0.5)', borderWidth: 1, borderColor: colors.border, borderRadius: 10, padding: 12, marginBottom: 8 },
  discItemDone: { opacity: 0.5 },
  discCheck: { width: 22, height: 22, borderRadius: 11, borderWidth: 1.5, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  discCheckDone: { backgroundColor: colors.gold, borderColor: colors.gold },
  discCheckMark: { fontSize: 12, color: colors.navy, fontWeight: '700' },
  discIcon: { width: 30, height: 30, borderRadius: 8, backgroundColor: colors.goldDim, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  discIconEmoji: { fontSize: 15 },
  discName: { fontFamily: fonts.latoBold, fontSize: 13, color: colors.cream, marginBottom: 2 },
  discNameDone: { textDecorationLine: 'line-through' },
  discMeta: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  discFreq: { fontFamily: fonts.latoBold, fontSize: 10, letterSpacing: 0.8 },
  discStreak: { fontFamily: fonts.latoLight, fontSize: 10, color: colors.muted },
  sharedBadge: { backgroundColor: 'rgba(201,168,76,0.12)', borderWidth: 1, borderColor: 'rgba(201,168,76,0.25)', borderRadius: 20, paddingHorizontal: 7, paddingVertical: 2 },
  sharedBadgeText: { fontFamily: fonts.latoBold, fontSize: 9, letterSpacing: 1, color: colors.gold },

  formLabel: { fontFamily: fonts.latoBold, fontSize: 10, letterSpacing: 1.5, textTransform: 'uppercase', color: colors.gold, opacity: 0.8, marginBottom: 8 },
  textarea: { backgroundColor: 'rgba(10,16,30,0.7)', borderWidth: 1, borderColor: colors.border, borderRadius: 8, color: colors.cream, fontFamily: fonts.latoLight, fontSize: 13, padding: 12, textAlignVertical: 'top', lineHeight: 20 },
  input: { backgroundColor: 'rgba(10,16,30,0.7)', borderWidth: 1, borderColor: colors.border, borderRadius: 8, color: colors.cream, fontFamily: fonts.latoLight, fontSize: 13, padding: 12 },
  dateLabel: { fontFamily: fonts.latoLight, fontSize: 11, color: colors.muted },

  btnGoldFull: { backgroundColor: colors.gold, borderRadius: 8, padding: 12, alignItems: 'center', marginTop: 14 },
  btnDisabled: { opacity: 0.35 },
  btnGoldFullText: { fontFamily: fonts.latoBold, fontSize: 11, color: colors.navy, letterSpacing: 0.8 },

  assignSub: { fontFamily: fonts.latoLight, fontSize: 12, color: colors.muted, marginBottom: 8, lineHeight: 18 },
  assignTitle: { fontFamily: fonts.latoBold, fontSize: 13, color: colors.cream, marginBottom: 6 },
  assignBody: { fontFamily: fonts.latoLight, fontSize: 12, color: colors.muted, lineHeight: 18, marginBottom: 12 },
  progressRowSimple: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },

  entryItem: { paddingVertical: 12, backgroundColor: colors.navyMid },
  entryDate: { fontFamily: fonts.latoBold, fontSize: 10, letterSpacing: 1.5, textTransform: 'uppercase', color: colors.gold, opacity: 0.7, marginBottom: 3 },
  entryTitle: { fontFamily: fonts.latoBold, fontSize: 13, color: colors.cream, marginBottom: 2 },
  entryPreview: { fontFamily: fonts.latoLight, fontSize: 12, color: colors.muted, lineHeight: 18 },

  divider: { height: 1, backgroundColor: colors.border },

  emptyState: { alignItems: 'center', paddingVertical: 20, gap: 6 },
  emptyIcon: { fontSize: 28, color: colors.muted, opacity: 0.4 },
  emptyTitle: { fontFamily: fonts.latoBold, fontSize: 13, color: colors.muted },
  emptyBody: { fontFamily: fonts.latoLight, fontSize: 11, color: colors.muted, textAlign: 'center', lineHeight: 17, opacity: 0.7 },

  promptFast: { fontFamily: fonts.latoBold, fontSize: 10, letterSpacing: 1.5, textTransform: 'uppercase', color: colors.gold, opacity: 0.75, marginBottom: 8 },
  promptQuote: { fontFamily: fonts.cormorantItalic, fontSize: 17, color: colors.cream, lineHeight: 26, marginBottom: 8 },
  promptRef: { fontFamily: fonts.latoLight, fontSize: 11, color: colors.muted, marginBottom: 10 },
  promptReflection: { fontFamily: fonts.latoLight, fontSize: 12, color: colors.muted, lineHeight: 20 },
  cardAction: { fontFamily: fonts.lato, fontSize: 11, color: colors.gold },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modalCard: { backgroundColor: colors.navyMid, borderTopLeftRadius: 20, borderTopRightRadius: 20, borderWidth: 1, borderColor: colors.border, padding: 24, paddingBottom: 40 },
  modalTitle: { fontFamily: fonts.cormorantMedium, fontSize: 22, color: colors.cream, marginBottom: 16 },
  iconRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  iconOpt: { width: 40, height: 40, borderRadius: 10, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  iconOptActive: { backgroundColor: colors.goldDim, borderColor: colors.gold },
  iconEmoji: { fontSize: 18 },
  freqRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  freqPill: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1, borderColor: colors.border },
  freqPillActive: { backgroundColor: colors.goldDim, borderColor: colors.gold },
  freqPillText: { fontFamily: fonts.latoBold, fontSize: 10, letterSpacing: 0.8, textTransform: 'uppercase', color: colors.muted },
  freqPillTextActive: { color: colors.goldLight },
  shareToggle: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 16 },
  shareCheckbox: { width: 20, height: 20, borderRadius: 4, borderWidth: 1.5, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  shareCheckboxActive: { backgroundColor: colors.gold, borderColor: colors.gold },
  shareCheckMark: { fontSize: 11, color: colors.navy, fontWeight: '700' },
  shareToggleText: { fontFamily: fonts.latoLight, fontSize: 12, color: colors.muted, flex: 1, lineHeight: 17 },
  modalActions: { flexDirection: 'row', gap: 10, marginTop: 20 },
});
