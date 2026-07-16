import React, { useState, useEffect, useRef } from 'react';
import {
  ScrollView, View, Text, StyleSheet, TouchableOpacity,
  TextInput, Animated, PanResponder, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, fonts , lazyThemed } from '@/lib/theme';
import { confirmDestructive } from '@/lib/confirm';
import { fetchDayGospel, gospelExcerpt, DayGospel } from '@/lib/lectionary';
import { Card } from '@/components/ui/Card';
import { useSession } from '@/lib/auth';
import * as db from '@/lib/db';
import { useDemoMode } from '@/lib/demo';

// Spiritual practices/disciplines were removed from this tab — daily practices
// live on the Canon tab (assigned canon + personal rule). This tab is now
// purely the written journal: today's entry, past entries, and the prompt.

interface JournalEntry {
  id: string;
  created_at: string;
  title: string;
  reflection: string;
  scripture?: string;
  prayer_intention?: string;
}

const DEMO_ENTRIES: JournalEntry[] = [
  { id: 'e1', created_at: '2026-06-04', title: 'Reflection on the fast', reflection: 'Felt a deepening sense of gratitude during the Agpeya today. The third hour prayer felt different — more present.', scripture: 'Psalm 62:1 — O God, my God, I rise early to be with You', prayer_intention: 'That this stillness would carry into the workday.' },
  { id: 'e2', created_at: '2026-05-30', title: 'Gratitude', reflection: 'Reflecting on God\'s faithfulness with the baby\'s health. Psalm 116 kept coming to mind.', scripture: 'Psalm 116:7 — Return to your rest, O my soul' },
  { id: 'e3', created_at: '2026-05-22', title: 'After confession', reflection: 'Feeling lighter. Beginning the 40-day Psalm plan. Starting with Psalm 50.' },
];

function fmtDate(iso: string, long = false): string {
  // Date-only strings ("2026-06-04") parse as UTC midnight and can display as
  // the previous day locally — anchor them to local noon so the calendar day
  // survives any timezone. Full ISO timestamps parse as-is.
  const d = /^\d{4}-\d{2}-\d{2}$/.test(iso) ? new Date(iso + 'T12:00:00') : new Date(iso);
  return d.toLocaleDateString('en-US', long
    ? { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }
    : { month: 'long', day: 'numeric', year: 'numeric' });
}

// ── Swipeable entry row — swipe left to delete, tap to open ──
function SwipeableEntry({ entry, onPress, onDelete }: {
  entry: JournalEntry; onPress: () => void; onDelete: () => void;
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
        <TouchableOpacity style={styles.entryItem} onPress={onPress} activeOpacity={0.7}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.entryDate}>{fmtDate(entry.created_at)}</Text>
            <Text style={styles.entryTitle}>{entry.title}</Text>
            <Text style={styles.entryPreview} numberOfLines={2}>{entry.reflection}</Text>
          </View>
          <Text style={styles.entryChevron}>›</Text>
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
}

// ── Screen ───────────────────────────────────────────────────
export default function JournalScreen() {
  const { user } = useSession();
  const { demoMode } = useDemoMode();

  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [loading, setLoading] = useState(!demoMode);
  const [savingEntry, setSavingEntry] = useState(false);
  const [viewEntry, setViewEntry] = useState<JournalEntry | null>(null);

  // Today's Gospel from the Coptic lectionary (null = unavailable → static
  // fallback prompt). Fetched once per mount; cached per-date on device.
  const [gospel, setGospel] = useState<DayGospel | null>(null);
  const [showFullGospel, setShowFullGospel] = useState(false);
  useEffect(() => { fetchDayGospel().then(setGospel); }, []);

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

  async function saveEntries(newEntries: JournalEntry[]) {
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
    const entry: JournalEntry = {
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
    confirmDestructive('Delete Entry', 'Delete this journal entry?', 'Delete', () => {
      const updated = entries.filter(e => e.id !== id);
      setEntries(updated);
      saveEntries(updated);
      setViewEntry(null);
    });
  }

  const todayStr = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

  // ── Entry detail ───────────────────────────────────────────
  if (viewEntry) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.detailHeader}>
          <TouchableOpacity onPress={() => setViewEntry(null)} hitSlop={10}>
            <Text style={styles.detailBack}>‹ Journal</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => deleteEntry(viewEntry.id)} hitSlop={10}>
            <Text style={styles.detailDelete}>Delete</Text>
          </TouchableOpacity>
        </View>
        <ScrollView contentContainerStyle={styles.content}>
          <Text style={styles.detailDate}>{fmtDate(viewEntry.created_at, true)}</Text>
          <Text style={styles.detailTitle}>{viewEntry.title}</Text>

          <Text style={styles.detailLabel}>REFLECTION</Text>
          <Text style={styles.detailBody}>{viewEntry.reflection}</Text>

          {!!viewEntry.scripture && (
            <>
              <Text style={styles.detailLabel}>SCRIPTURE THAT SPOKE TO ME</Text>
              <View style={styles.detailScriptureCard}>
                <Text style={styles.detailScripture}>{viewEntry.scripture}</Text>
              </View>
            </>
          )}

          {!!viewEntry.prayer_intention && (
            <>
              <Text style={styles.detailLabel}>PRAYER INTENTION</Text>
              <Text style={styles.detailBody}>{viewEntry.prayer_intention}</Text>
            </>
          )}
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ── Journal home ───────────────────────────────────────────
  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>

        <Text style={styles.pageTitle}>Spiritual Journal</Text>
        <Text style={styles.pageSubtitle}>Reflections, prompts, and growth</Text>

        {/* Today's Entry */}
        <Card title="Today's Entry" titleIcon="✦" action={<Text style={styles.dateLabel}>{todayStr}</Text>}>
          <Text style={styles.formLabel}>TITLE (optional)</Text>
          <TextInput style={styles.input} placeholder="e.g. Reflection on the fast" placeholderTextColor={colors.faint} value={entryTitle} onChangeText={setEntryTitle} />
          <Text style={[styles.formLabel, { marginTop: 14 }]}>REFLECTION</Text>
          <TextInput style={[styles.textarea, { minHeight: 110 }]} multiline placeholder="What is God saying to you today? What are you grateful for? What are you struggling with?" placeholderTextColor={colors.faint} value={reflection} onChangeText={setReflection} />
          <Text style={[styles.formLabel, { marginTop: 14 }]}>SCRIPTURE THAT SPOKE TO ME</Text>
          <TextInput style={styles.input} placeholder="e.g. Psalm 63:1 — O God, You are my God..." placeholderTextColor={colors.faint} value={scripture} onChangeText={setScripture} />
          <Text style={[styles.formLabel, { marginTop: 14 }]}>PRAYER INTENTION</Text>
          <TextInput style={[styles.textarea, { minHeight: 56 }]} multiline placeholder="What are you bringing to God in prayer today?" placeholderTextColor={colors.faint} value={prayerIntention} onChangeText={setPrayerIntention} />
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
          {loading ? (
            <ActivityIndicator color={colors.gold} style={{ paddingVertical: 20 }} />
          ) : entries.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyIcon}>◎</Text>
              <Text style={styles.emptyTitle}>No entries yet</Text>
              <Text style={styles.emptyBody}>Your saved entries will appear here.</Text>
            </View>
          ) : (
            entries.map(entry => (
              <SwipeableEntry
                key={entry.id}
                entry={entry}
                onPress={() => setViewEntry(entry)}
                onDelete={() => deleteEntry(entry.id)}
              />
            ))
          )}
        </Card>

        {/* Today's Prompt — the Gospel of the day from the Coptic lectionary
            (Katameros), with a static fallback when the reading can't load. */}
        <Card title="Today's Prompt" titleIcon="◇">
          {gospel ? (() => {
            const excerpt = gospelExcerpt(gospel);
            return (
              <>
                <Text style={styles.promptFast}>From the Gospel of the day</Text>
                <Text style={styles.promptQuote}>"{excerpt.text}"</Text>
                <Text style={styles.promptRef}>{excerpt.ref}</Text>
                <TouchableOpacity onPress={() => setShowFullGospel(v => !v)} hitSlop={6}>
                  <Text style={styles.promptExpand}>
                    {showFullGospel ? 'Hide the full reading ▴' : `Read the full Gospel — ${gospel.reference} ▾`}
                  </Text>
                </TouchableOpacity>
                {showFullGospel && gospel.passages.map(p => (
                  <View key={`${p.book}-${p.ref}`} style={styles.fullPassage}>
                    <Text style={styles.fullPassageRef}>{p.book} {p.ref}</Text>
                    <Text style={styles.fullPassageText}>
                      {p.verses.map(v => (
                        <Text key={v.number}>
                          <Text style={styles.verseNum}>{v.number} </Text>{v.text}{' '}
                        </Text>
                      ))}
                    </Text>
                  </View>
                ))}
                <View style={styles.divider} />
                <Text style={styles.promptReflection}>
                  Sit with these words from today's liturgy. What is the Lord saying to you
                  through them? Let your entry begin there.
                </Text>
              </>
            );
          })() : (
            <>
              <Text style={styles.promptQuote}>"Watch and pray that you may not enter into temptation. The spirit indeed is willing, but the flesh is weak."</Text>
              <Text style={styles.promptRef}>Matthew 26:41</Text>
              <View style={styles.divider} />
              <Text style={styles.promptReflection}>
                Reflect on a moment this week when your spirit was willing but your flesh felt weak. What did you learn about yourself? What did you learn about God's grace?
              </Text>
            </>
          )}
        </Card>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = lazyThemed(() => StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.navy },
  scroll: { flex: 1 },
  content: { padding: 20, paddingBottom: 40 },

  pageTitle: { fontFamily: fonts.cormorantMedium, fontSize: 28, color: colors.cream, marginBottom: 4 },
  pageSubtitle: { fontFamily: fonts.latoLight, fontSize: 12, color: colors.muted, marginBottom: 20 },

  swipeContainer: { position: 'relative', overflow: 'hidden', borderRadius: 10, marginBottom: 8 },
  swipeActions: { position: 'absolute', right: 0, top: 0, bottom: 0, flexDirection: 'row' },
  swipeActionDelete: { width: 70, backgroundColor: 'rgba(192,57,43,0.25)', alignItems: 'center', justifyContent: 'center' },
  swipeActionText: { fontFamily: fonts.latoBold, fontSize: 10, color: colors.cream, textAlign: 'center', letterSpacing: 0.5 },

  formLabel: { fontFamily: fonts.latoBold, fontSize: 10, letterSpacing: 1.5, textTransform: 'uppercase', color: colors.gold, opacity: 0.8, marginBottom: 8 },
  textarea: { backgroundColor: colors.panel, borderWidth: 1, borderColor: colors.border, borderRadius: 8, color: colors.cream, fontFamily: fonts.latoLight, fontSize: 13, padding: 12, textAlignVertical: 'top', lineHeight: 20 },
  input: { backgroundColor: colors.panel, borderWidth: 1, borderColor: colors.border, borderRadius: 8, color: colors.cream, fontFamily: fonts.latoLight, fontSize: 13, padding: 12 },
  dateLabel: { fontFamily: fonts.latoLight, fontSize: 11, color: colors.muted },

  btnGoldFull: { backgroundColor: colors.gold, borderRadius: 8, padding: 12, alignItems: 'center', marginTop: 14 },
  btnDisabled: { opacity: 0.35 },
  btnGoldFullText: { fontFamily: fonts.latoBold, fontSize: 11, color: colors.navy, letterSpacing: 0.8 },

  // Opaque background — the delete underlay sits behind this row and must not
  // show through until revealed by the swipe.
  entryItem: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 10 },
  entryDate: { fontFamily: fonts.latoBold, fontSize: 10, letterSpacing: 1.5, textTransform: 'uppercase', color: colors.gold, opacity: 0.7, marginBottom: 3 },
  entryTitle: { fontFamily: fonts.latoBold, fontSize: 13, color: colors.cream, marginBottom: 2 },
  entryPreview: { fontFamily: fonts.latoLight, fontSize: 12, color: colors.muted, lineHeight: 18 },
  entryChevron: { fontSize: 18, color: colors.gold, paddingHorizontal: 4 },

  divider: { height: 1, backgroundColor: colors.border },

  emptyState: { alignItems: 'center', paddingVertical: 20, gap: 6 },
  emptyIcon: { fontSize: 28, color: colors.muted, opacity: 0.4 },
  emptyTitle: { fontFamily: fonts.latoBold, fontSize: 13, color: colors.muted },
  emptyBody: { fontFamily: fonts.latoLight, fontSize: 11, color: colors.muted, textAlign: 'center', lineHeight: 17, opacity: 0.7 },

  promptFast: { fontFamily: fonts.latoBold, fontSize: 10, letterSpacing: 1.5, textTransform: 'uppercase', color: colors.gold, opacity: 0.75, marginBottom: 8 },
  promptQuote: { fontFamily: fonts.cormorantItalic, fontSize: 17, color: colors.cream, lineHeight: 26, marginBottom: 8 },
  promptRef: { fontFamily: fonts.latoLight, fontSize: 11, color: colors.muted, marginBottom: 10 },
  promptReflection: { fontFamily: fonts.latoLight, fontSize: 12, color: colors.muted, lineHeight: 20 },
  promptExpand: { fontFamily: fonts.latoBold, fontSize: 12, color: colors.gold, marginBottom: 10 },
  fullPassage: { marginBottom: 10 },
  fullPassageRef: { fontFamily: fonts.latoBold, fontSize: 10, letterSpacing: 1, textTransform: 'uppercase', color: colors.muted, marginBottom: 4 },
  fullPassageText: { fontFamily: fonts.cormorant, fontSize: 16, color: colors.cream, lineHeight: 25 },
  verseNum: { fontFamily: fonts.latoBold, fontSize: 9, color: colors.gold },

  // Entry detail
  detailHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.border },
  detailBack: { fontFamily: fonts.latoBold, fontSize: 14, color: colors.gold },
  detailDelete: { fontFamily: fonts.lato, fontSize: 13, color: colors.red },
  detailDate: { fontFamily: fonts.latoBold, fontSize: 10, letterSpacing: 1.5, textTransform: 'uppercase', color: colors.gold, opacity: 0.7, marginBottom: 6 },
  detailTitle: { fontFamily: fonts.cormorantMedium, fontSize: 26, color: colors.cream, marginBottom: 20 },
  detailLabel: { fontFamily: fonts.latoBold, fontSize: 10, letterSpacing: 1.5, textTransform: 'uppercase', color: colors.gold, opacity: 0.8, marginBottom: 8, marginTop: 4 },
  detailBody: { fontFamily: fonts.latoLight, fontSize: 15, color: colors.cream, lineHeight: 24, marginBottom: 20 },
  detailScriptureCard: { backgroundColor: 'rgba(201,168,76,0.06)', borderWidth: 1, borderColor: 'rgba(201,168,76,0.2)', borderRadius: 10, padding: 14, marginBottom: 20 },
  detailScripture: { fontFamily: fonts.cormorantItalic, fontSize: 16, color: colors.goldLight, lineHeight: 24 },
}));
