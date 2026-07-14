import React, { useState, useEffect, useRef } from 'react';
import {
  ScrollView, View, Text, StyleSheet, TouchableOpacity,
  TextInput, Animated, PanResponder, Alert, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, fonts } from '@/lib/theme';
import { Card } from '@/components/ui/Card';
import { useSession } from '@/lib/auth';
import * as db from '@/lib/db';
import { useDemoMode } from '@/lib/demo';

const DEMO_ENTRIES = [
  { id: 'e1', created_at: '2026-06-04', title: 'Reflection on the fast', reflection: 'Felt a deepening sense of gratitude during the Agpeya today. The third hour prayer felt different — more present.' },
  { id: 'e2', created_at: '2026-05-30', title: 'Gratitude', reflection: 'Reflecting on God\'s faithfulness with the baby\'s health. Psalm 116 kept coming to mind.' },
  { id: 'e3', created_at: '2026-05-22', title: 'After confession', reflection: 'Feeling lighter. Beginning the 40-day Psalm plan. Starting with Psalm 50.' },
];

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

  const [entries, setEntries] = useState<any[]>([]);
  const [loading, setLoading] = useState(!demoMode);
  const [savingEntry, setSavingEntry] = useState(false);

  // New entry form
  const [entryTitle, setEntryTitle] = useState('');
  const [reflection, setReflection] = useState('');
  const [scripture, setScripture] = useState('');
  const [prayerIntention, setPrayerIntention] = useState('');

  useEffect(() => {
    if (demoMode) {
      setEntries(DEMO_ENTRIES);
    } else {
      load();
    }
  }, [user]);

  async function load() {
    if (!user) return;
    setLoading(true);
    const entryData = await db.getAgentProgress(user.id, 'journal-entries');
    if (entryData?.entries) setEntries(entryData.entries);
    setLoading(false);
  }

  async function saveEntries(newEntries: any[]) {
    if (!user || demoMode) return;
    await db.upsertAgentProgress({
      user_id: user.id, agent_slug: 'journal-entries',
      payload: { entries: newEntries },
      updated_at: new Date().toISOString(),
    });
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

  const todayStr = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>

        <Text style={styles.pageTitle}>Spiritual Journal</Text>
        <Text style={styles.pageSubtitle}>Reflections and growth</Text>

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

        {/* Past Entries */}
        <Card title={`Past Entries (${entries.length})`} flat>
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.navy },
  scroll: { flex: 1 },
  content: { padding: 20, paddingBottom: 40 },

  pageTitle: { fontFamily: fonts.cormorantMedium, fontSize: 28, color: colors.cream, marginBottom: 4 },
  pageSubtitle: { fontFamily: fonts.latoLight, fontSize: 12, color: colors.muted, marginBottom: 20 },

  swipeContainer: { position: 'relative', overflow: 'hidden' },
  swipeActions: { position: 'absolute', right: 0, top: 0, bottom: 0, flexDirection: 'row' },
  swipeActionDelete: { width: 70, backgroundColor: 'rgba(192,57,43,0.25)', alignItems: 'center', justifyContent: 'center' },
  swipeActionText: { fontFamily: fonts.latoBold, fontSize: 10, color: colors.cream, textAlign: 'center', letterSpacing: 0.5 },

  formLabel: { fontFamily: fonts.latoBold, fontSize: 10, letterSpacing: 1.5, textTransform: 'uppercase', color: colors.gold, opacity: 0.8, marginBottom: 8 },
  textarea: { backgroundColor: 'rgba(10,16,30,0.7)', borderWidth: 1, borderColor: colors.border, borderRadius: 8, color: colors.cream, fontFamily: fonts.latoLight, fontSize: 13, padding: 12, textAlignVertical: 'top', lineHeight: 20 },
  input: { backgroundColor: 'rgba(10,16,30,0.7)', borderWidth: 1, borderColor: colors.border, borderRadius: 8, color: colors.cream, fontFamily: fonts.latoLight, fontSize: 13, padding: 12 },
  dateLabel: { fontFamily: fonts.latoLight, fontSize: 11, color: colors.muted },

  btnGoldFull: { backgroundColor: colors.gold, borderRadius: 8, padding: 12, alignItems: 'center', marginTop: 14 },
  btnDisabled: { opacity: 0.35 },
  btnGoldFullText: { fontFamily: fonts.latoBold, fontSize: 11, color: colors.navy, letterSpacing: 0.8 },

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
});
