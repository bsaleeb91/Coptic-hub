import React, { useState } from 'react';
import { ScrollView, View, Text, StyleSheet, TouchableOpacity, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, fonts } from '@/lib/theme';
import { Card } from '@/components/ui/Card';
import { PrivacyNote } from '@/components/ui/PrivacyNote';

const TABS = ['Toward God', 'Toward Others', 'Toward Self', 'Family'] as const;

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
  'Family': [
    { text: 'Have I honored my spouse in thought, word, and deed?' },
    { text: 'Have I prayed with my family and nurtured a spiritual home?' },
    { text: 'Have I raised my children in the fear and love of God?' },
    { text: 'Have I honored and cared for my parents?' },
    { text: 'Do I direct my children to church, confession, and Sunday school?' },
    { text: 'Do I follow the Divine Liturgy from start to end, or do I arrive late and leave early?' },
  ],
};

const HISTORY = [
  { date: 'May 21, 2026 · 47 days ago', note: 'Fr. assigned: 40-day Psalm reading plan' },
  { date: 'Apr 20, 2026 · Holy Week', note: 'Fr. assigned: Marriage prayer practice' },
  { date: 'Feb 5, 2026', note: 'Preparation for the Great Fast', dim: true },
];

export default function ConfessionScreen() {
  const [activeTab, setActiveTab] = useState<typeof TABS[number]>('Toward God');
  const [checked, setChecked] = useState<Set<string>>(new Set());

  const toggle = (key: string) => {
    setChecked(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>

        <Text style={styles.pageTitle}>Confession Preparation</Text>
        <Text style={styles.pageSubtitle}>Private — your entries never leave this device</Text>

        {/* Privacy Banner */}
        <View style={styles.privacyBanner}>
          <Text style={styles.privacyLock}>🔒</Text>
          <Text style={styles.privacyText}>
            <Text style={styles.strong}>Complete privacy guarantee.</Text>
            {' '}Your examination notes are visible only to you. Only the date and fact of your confession are recorded. The content is never stored — known only to you, your Father of Confession, and God.
          </Text>
        </View>

        {/* Examination of Conscience */}
        <Card title="Examination of Conscience" titleIcon="◇">
          {/* Tab Nav */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabScroll} contentContainerStyle={styles.tabContent}>
            {TABS.map(tab => (
              <TouchableOpacity
                key={tab}
                style={[styles.tab, activeTab === tab && styles.tabActive]}
                onPress={() => setActiveTab(tab)}
              >
                <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>{tab}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Questions */}
          {EXAMINATION[activeTab].map((item, i) => {
            const key = `${activeTab}-${i}`;
            const done = checked.has(key);
            return (
              <TouchableOpacity
                key={key}
                style={[styles.examItem, i < EXAMINATION[activeTab].length - 1 && styles.examBorder]}
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
          />
          <Text style={[styles.formLabel, { marginTop: 14 }]}>RECURRING STRUGGLES (PRIVATE)</Text>
          <TextInput
            style={styles.textarea}
            multiline
            placeholder="Note any patterns you want to address — recurring temptations, persistent habits, or areas of spiritual weakness..."
            placeholderTextColor="rgba(245,240,232,0.22)"
          />
          <Text style={[styles.formLabel, { marginTop: 14 }]}>ANSWERED PRAYERS & GROWTH</Text>
          <TextInput
            style={[styles.textarea, { minHeight: 64 }]}
            multiline
            placeholder="Note moments of grace, answered prayers, or growth to give thanks for..."
            placeholderTextColor="rgba(245,240,232,0.22)"
          />
        </Card>

        {/* Schedule */}
        <Card title="Schedule Confession" titleIcon="◈">
          <Text style={styles.formLabel}>NOTE TO FR. BISHOY (OPTIONAL)</Text>
          <TextInput
            style={[styles.textarea, { minHeight: 60 }]}
            multiline
            placeholder="Let your Father of Confession know of any specific needs or areas you'd like to focus on..."
            placeholderTextColor="rgba(245,240,232,0.22)"
          />
          <TouchableOpacity style={styles.btnGoldFull}>
            <Text style={styles.btnGoldText}>REQUEST APPOINTMENT</Text>
          </TouchableOpacity>
          <PrivacyNote text="Only your name and requested date are shared. Examination notes are never transmitted." />
        </Card>

        {/* History */}
        <Card title="Confession History" titleIcon="◎">
          {HISTORY.map((item, i) => (
            <View key={i} style={[styles.histItem, i < HISTORY.length - 1 && styles.histBorder]}>
              <Text style={[styles.histDate, item.dim && { opacity: 0.5 }]}>{item.date}</Text>
              <Text style={styles.histTitle}>Holy Confession</Text>
              <Text style={styles.histNote}>{item.note}</Text>
              <View style={styles.histTag}>
                <Text style={styles.histTagText}>✝ Received</Text>
              </View>
            </View>
          ))}
          <Text style={styles.cadence}>Cadence: approx. every 45–60 days</Text>
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

  privacyBanner: {
    flexDirection: 'row', gap: 12, alignItems: 'flex-start',
    backgroundColor: 'rgba(201,168,76,0.05)', borderWidth: 1, borderColor: 'rgba(201,168,76,0.2)',
    borderRadius: 12, padding: 16, marginBottom: 20,
  },
  privacyLock: { fontSize: 18, flexShrink: 0 },
  privacyText: { fontFamily: fonts.latoLight, fontSize: 12, color: colors.muted, lineHeight: 18, flex: 1 },
  strong: { fontFamily: fonts.latoBold, color: colors.cream },

  tabScroll: { marginHorizontal: -18, marginBottom: 16 },
  tabContent: { paddingHorizontal: 18, gap: 0 },
  tab: { paddingHorizontal: 14, paddingVertical: 9, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabActive: { borderBottomColor: colors.gold },
  tabText: { fontFamily: fonts.latoBold, fontSize: 11, letterSpacing: 0.5, textTransform: 'uppercase', color: colors.muted },
  tabTextActive: { color: colors.goldLight },

  examItem: { flexDirection: 'row', gap: 10, paddingVertical: 9, alignItems: 'flex-start' },
  examBorder: { borderBottomWidth: 1, borderBottomColor: 'rgba(201,168,76,0.06)' },
  examCheck: {
    width: 16, height: 16, borderRadius: 4,
    borderWidth: 1, borderColor: colors.border, backgroundColor: 'transparent',
    marginTop: 2, alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  examCheckDone: { backgroundColor: colors.gold, borderColor: colors.gold },
  checkMark: { fontSize: 11, color: colors.navy, fontWeight: '700' },
  examText: { fontFamily: fonts.latoLight, fontSize: 13, color: colors.cream, lineHeight: 18 },
  examTextDone: { textDecorationLine: 'line-through', opacity: 0.38 },
  examNote: { fontFamily: fonts.latoLight, fontSize: 11, color: colors.muted, marginTop: 3, fontStyle: 'italic' },

  divider: { height: 1, backgroundColor: colors.border, marginVertical: 16 },
  formLabel: {
    fontFamily: fonts.latoBold, fontSize: 10, letterSpacing: 1.5,
    textTransform: 'uppercase', color: colors.gold, opacity: 0.8, marginBottom: 8,
  },
  textarea: {
    backgroundColor: 'rgba(10,16,30,0.7)', borderWidth: 1, borderColor: colors.border,
    borderRadius: 8, color: colors.cream, fontFamily: fonts.latoLight,
    fontSize: 13, padding: 12, minHeight: 80, textAlignVertical: 'top', lineHeight: 20,
  },

  btnGoldFull: {
    backgroundColor: colors.gold, borderRadius: 8, padding: 12,
    alignItems: 'center', marginTop: 14,
  },
  btnGoldText: { fontFamily: fonts.latoBold, fontSize: 11, color: colors.navy, letterSpacing: 0.8 },

  histItem: { paddingVertical: 12 },
  histBorder: { borderBottomWidth: 1, borderBottomColor: colors.border },
  histDate: { fontFamily: fonts.latoBold, fontSize: 9, letterSpacing: 1.5, textTransform: 'uppercase', color: colors.gold, opacity: 0.7, marginBottom: 3 },
  histTitle: { fontFamily: fonts.latoBold, fontSize: 13, color: colors.cream, marginBottom: 2 },
  histNote: { fontFamily: fonts.latoLight, fontSize: 12, color: colors.muted, lineHeight: 18 },
  histTag: { backgroundColor: 'rgba(201,168,76,0.15)', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 20, alignSelf: 'flex-start', marginTop: 6 },
  histTagText: { fontFamily: fonts.latoBold, fontSize: 10, color: colors.goldLight, letterSpacing: 0.5 },
  cadence: { fontFamily: fonts.latoLight, fontSize: 11, color: colors.muted, fontStyle: 'italic', marginTop: 8 },
});
