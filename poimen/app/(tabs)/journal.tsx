import React, { useState } from 'react';
import { ScrollView, View, Text, StyleSheet, TouchableOpacity, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, fonts } from '@/lib/theme';
import { Card } from '@/components/ui/Card';
import { PrivacyNote } from '@/components/ui/PrivacyNote';

type Frequency = 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly';

const FREQ_COLOR: Record<Frequency, string> = {
  daily: colors.blue,
  weekly: colors.green,
  monthly: colors.goldLight,
  quarterly: colors.purple,
  yearly: colors.yellow,
};

const DISCIPLINES = [
  { icon: '🙏', name: 'Morning Agpeya', freq: 'daily' as Frequency, streak: '5-day streak', shared: true, done: true },
  { icon: '📖', name: 'Bible Reading', freq: 'daily' as Frequency, streak: '5-day streak', shared: true, done: false },
  { icon: '🕯', name: 'Vespers', freq: 'weekly' as Frequency, streak: '3 this month', shared: true, done: false },
  { icon: '✝', name: 'Divine Liturgy', freq: 'weekly' as Frequency, streak: '8 / 10 Sundays', shared: true, done: true },
  { icon: '❤', name: 'Almsgiving', freq: 'monthly' as Frequency, streak: '', shared: false, done: false },
  { icon: '🌿', name: 'Retreat / Day of Prayer', freq: 'quarterly' as Frequency, streak: '', shared: true, done: false },
];

const PAST_ENTRIES = [
  { date: 'June 4, 2026', title: 'Reflection on the fast', preview: 'Felt a deepening sense of gratitude during the Agpeya today. The third hour prayer felt different — more present.' },
  { date: 'May 30, 2026', title: 'Gratitude', preview: 'Reflecting on God\'s faithfulness with the baby\'s health. Psalm 116 kept coming to mind.' },
  { date: 'May 22, 2026', title: 'After confession', preview: 'Feeling lighter. Beginning the 40-day Psalm plan. Starting with Psalm 50.', dim: true },
];

export default function JournalScreen() {
  const [checked, setChecked] = useState<Set<number>>(
    new Set(DISCIPLINES.map((d, i) => d.done ? i : -1).filter(i => i >= 0))
  );

  const toggle = (i: number) => {
    setChecked(prev => {
      const next = new Set(prev);
      next.has(i) ? next.delete(i) : next.add(i);
      return next;
    });
  };

  const dailyTotal = DISCIPLINES.filter(d => d.freq === 'daily').length;
  const dailyDone = DISCIPLINES.filter((d, i) => d.freq === 'daily' && checked.has(i)).length;

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>

        <Text style={styles.pageTitle}>Spiritual Journal</Text>
        <Text style={styles.pageSubtitle}>Reflections, disciplines, and growth</Text>

        {/* Disciplines */}
        <Card
          title="Spiritual Disciplines"
          titleIcon="◈"
          action={<TouchableOpacity style={styles.btnGold}><Text style={styles.btnGoldText}>+ PRACTICE</Text></TouchableOpacity>}
        >
          {/* Progress */}
          <View style={styles.progressRow}>
            <Text style={styles.progressIcon}>📅</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.progressLabel}>TODAY'S PROGRESS</Text>
              <View style={styles.progressTrack}>
                <View style={[styles.progressFill, { width: `${(dailyDone / dailyTotal) * 100}%` as any }]} />
              </View>
            </View>
            <Text style={styles.progressVal}>{dailyDone} / {dailyTotal}</Text>
          </View>

          {/* List */}
          {DISCIPLINES.map((disc, i) => {
            const done = checked.has(i);
            return (
              <View key={i} style={[styles.discItem, done && styles.discItemDone]}>
                <TouchableOpacity onPress={() => toggle(i)}>
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
                    <Text style={[styles.discFreq, { color: FREQ_COLOR[disc.freq] }]}>{disc.freq.toUpperCase()}</Text>
                    {disc.streak ? <Text style={styles.discStreak}>{disc.streak}</Text> : null}
                  </View>
                </View>
                {disc.shared && (
                  <View style={styles.sharedBadge}>
                    <Text style={styles.sharedBadgeText}>✝ FOC</Text>
                  </View>
                )}
              </View>
            );
          })}

          <PrivacyNote text="Only practice names and completion rates are shared with Fr. Bishoy — never your journal content." />
        </Card>

        {/* Today's Entry */}
        <Card title="Today's Entry" titleIcon="✦" action={<Text style={styles.dateLabel}>Sunday, June 7</Text>}>
          <Text style={styles.formLabel}>REFLECTION</Text>
          <TextInput
            style={[styles.textarea, { minHeight: 110 }]}
            multiline
            placeholder="What is God saying to you today? What are you grateful for? What are you struggling with?"
            placeholderTextColor="rgba(245,240,232,0.22)"
          />
          <Text style={[styles.formLabel, { marginTop: 14 }]}>SCRIPTURE THAT SPOKE TO ME</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. Psalm 63:1 — O God, You are my God..."
            placeholderTextColor="rgba(245,240,232,0.22)"
          />
          <Text style={[styles.formLabel, { marginTop: 14 }]}>PRAYER INTENTION FOR TODAY</Text>
          <TextInput
            style={[styles.textarea, { minHeight: 56 }]}
            multiline
            placeholder="What are you bringing to God in prayer today?"
            placeholderTextColor="rgba(245,240,232,0.22)"
          />
          <TouchableOpacity style={styles.btnGoldFull}>
            <Text style={styles.btnGoldFullText}>SAVE ENTRY</Text>
          </TouchableOpacity>
        </Card>

        {/* Fr. Bishoy's Assignment */}
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

        {/* Past Entries */}
        <Card title="Past Entries" titleIcon="◎" action={<Text style={styles.cardAction}>View all</Text>}>
          {PAST_ENTRIES.map((entry, i) => (
            <View key={i} style={[styles.entryItem, i < PAST_ENTRIES.length - 1 && styles.entryBorder]}>
              <Text style={[styles.entryDate, entry.dim && { opacity: 0.5 }]}>{entry.date}</Text>
              <Text style={styles.entryTitle}>{entry.title}</Text>
              <Text style={styles.entryPreview}>{entry.preview}</Text>
            </View>
          ))}
        </Card>

        {/* Today's Prompt */}
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

  btnGold: { backgroundColor: colors.gold, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
  btnGoldText: { fontFamily: fonts.latoBold, fontSize: 9, color: colors.navy, letterSpacing: 0.8 },

  progressRow: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: 'rgba(10,16,30,0.4)', borderWidth: 1, borderColor: colors.border, borderRadius: 10, padding: 12, marginBottom: 14 },
  progressIcon: { fontSize: 16 },
  progressLabel: { fontFamily: fonts.latoBold, fontSize: 10, letterSpacing: 1.2, textTransform: 'uppercase', color: colors.muted, marginBottom: 5 },
  progressTrack: { height: 4, backgroundColor: 'rgba(245,240,232,0.07)', borderRadius: 4, overflow: 'hidden', flex: 1 },
  progressFill: { height: '100%', backgroundColor: colors.gold, borderRadius: 4 },
  progressVal: { fontFamily: fonts.latoBold, fontSize: 13, color: colors.cream },

  discItem: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: 'rgba(10,16,30,0.5)', borderWidth: 1, borderColor: colors.border, borderRadius: 10, padding: 12, marginBottom: 8 },
  discItemDone: { opacity: 0.5 },
  discCheck: { width: 22, height: 22, borderRadius: 11, borderWidth: 1.5, borderColor: colors.border, backgroundColor: 'transparent', alignItems: 'center', justifyContent: 'center' },
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
  textarea: {
    backgroundColor: 'rgba(10,16,30,0.7)', borderWidth: 1, borderColor: colors.border,
    borderRadius: 8, color: colors.cream, fontFamily: fonts.latoLight,
    fontSize: 13, padding: 12, textAlignVertical: 'top', lineHeight: 20,
  },
  input: {
    backgroundColor: 'rgba(10,16,30,0.7)', borderWidth: 1, borderColor: colors.border,
    borderRadius: 8, color: colors.cream, fontFamily: fonts.latoLight,
    fontSize: 13, padding: 12,
  },
  dateLabel: { fontFamily: fonts.latoLight, fontSize: 11, color: colors.muted },

  btnGoldFull: { backgroundColor: colors.gold, borderRadius: 8, padding: 12, alignItems: 'center', marginTop: 14 },
  btnGoldFullText: { fontFamily: fonts.latoBold, fontSize: 11, color: colors.navy, letterSpacing: 0.8 },

  assignSub: { fontFamily: fonts.latoLight, fontSize: 12, color: colors.muted, marginBottom: 8, lineHeight: 18 },
  assignTitle: { fontFamily: fonts.latoBold, fontSize: 13, color: colors.cream, marginBottom: 6 },
  assignBody: { fontFamily: fonts.latoLight, fontSize: 12, color: colors.muted, lineHeight: 18, marginBottom: 12 },
  progressRowSimple: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },

  entryItem: { paddingVertical: 12 },
  entryBorder: { borderBottomWidth: 1, borderBottomColor: colors.border },
  entryDate: { fontFamily: fonts.latoBold, fontSize: 10, letterSpacing: 1.5, textTransform: 'uppercase', color: colors.gold, opacity: 0.7, marginBottom: 3 },
  entryTitle: { fontFamily: fonts.latoBold, fontSize: 13, color: colors.cream, marginBottom: 2 },
  entryPreview: { fontFamily: fonts.latoLight, fontSize: 12, color: colors.muted, lineHeight: 18 },

  promptFast: { fontFamily: fonts.latoBold, fontSize: 10, letterSpacing: 1.5, textTransform: 'uppercase', color: colors.gold, opacity: 0.75, marginBottom: 8 },
  promptQuote: { fontFamily: fonts.cormorantItalic, fontSize: 17, color: colors.cream, lineHeight: 26, marginBottom: 8 },
  promptRef: { fontFamily: fonts.latoLight, fontSize: 11, color: colors.muted, marginBottom: 10 },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: 12 },
  promptReflection: { fontFamily: fonts.latoLight, fontSize: 12, color: colors.muted, lineHeight: 20 },

  cardAction: { fontFamily: fonts.lato, fontSize: 11, color: colors.gold },
});
