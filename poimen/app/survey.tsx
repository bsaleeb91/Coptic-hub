// app/survey.tsx
// The five-question feedback survey.
//
// Answers are ANONYMOUS — no user id is attached (see lib/db/survey.ts and its
// migration). Question 5 asks whether a member holds things back because they
// are unsure who can see them, and nobody answers that honestly with their
// name on it. The screen says so at the top, because a member has no way to
// know it otherwise, and the whole value of the answers depends on believing
// it.
//
// Every question is skippable. A partial answer is worth more than an
// abandoned one, and forcing a choice on "how often do you use this" is how
// you teach people to pick whatever dismisses the screen fastest.

import React, { useState } from 'react';
import {
  ScrollView, View, Text, StyleSheet, TextInput, TouchableOpacity,
  Platform, KeyboardAvoidingView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import { colors, fonts, lazyThemed } from '@/lib/theme';
import { APP_NAME, APP_NAME_UPPER } from '@/lib/brand';
import { useSession } from '@/lib/auth';
import { Card } from '@/components/ui/Card';
import * as db from '@/lib/db';
import type {
  SurveyAnswers, SurveyFrequency, SurveyConsistency, SurveyMostMissed,
} from '@/lib/db/survey';
import { markPrompted } from '@/lib/survey/store';
import * as H from '@/lib/haptics';

const Q1: { value: SurveyFrequency; label: string }[] = [
  { value: 'daily',          label: 'Daily' },
  { value: 'weekly_several', label: 'Several times a week' },
  { value: 'weekly',         label: 'About once a week' },
  { value: 'rarely',         label: 'Rarely' },
];

const Q2: { value: SurveyConsistency; label: string }[] = [
  { value: 'yes_clearly', label: 'Yes, noticeably' },
  { value: 'a_little',    label: 'A little' },
  { value: 'no_change',   label: 'No change' },
  { value: 'no_canon',    label: "I don't use the canon" },
];

const Q3: { value: SurveyMostMissed; label: string }[] = [
  { value: 'canon',        label: 'My canon' },
  { value: 'confession',   label: 'Confession preparation' },
  { value: 'psalms',       label: 'Psalms' },
  { value: 'prayer',       label: 'Prayer requests' },
  { value: 'journal',      label: 'Journal' },
  { value: 'appointments', label: 'Appointments' },
];

const MAX = 1000;

function Option({ label, on, onPress }: { label: string; on: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity style={[styles.opt, on && styles.optOn]} onPress={onPress} activeOpacity={0.8}>
      <View style={[styles.radio, on && styles.radioOn]}>{on && <View style={styles.radioDot} />}</View>
      <Text style={[styles.optText, on && styles.optTextOn]}>{label}</Text>
    </TouchableOpacity>
  );
}

function Question({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <Card title="" titleIcon="">
      <Text style={styles.qNum}>QUESTION {n} OF 5</Text>
      <Text style={styles.qTitle}>{title}</Text>
      {children}
    </Card>
  );
}

export default function SurveyScreen() {
  const router = useRouter();
  const { profile } = useSession();
  const [a, setA] = useState<SurveyAnswers>({
    frequency: null, consistency: null, most_missed: null,
    one_change: null, withholding: null, withholding_detail: null,
  });
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  const set = <K extends keyof SurveyAnswers>(k: K, v: SurveyAnswers[K]) => {
    H.tap();
    setA(prev => ({ ...prev, [k]: prev[k] === v ? null : v }));   // tap again to unset
  };

  const answered = Object.values(a).some(v => v !== null && v !== '');

  async function submit() {
    setSending(true);
    setError('');
    const { error: err } = await db.submitSurvey(a, {
      app_version: (Constants.expoConfig?.version as string) ?? null,
      platform: Platform.OS,
      role: profile?.role ?? null,
    });
    setSending(false);
    if (err) { setError(err); return; }
    H.success();
    setDone(true);
  }

  // Closing counts as having been asked, so the next prompt is 5 days out
  // whether the member answered or not.
  async function close() {
    await markPrompted();
    router.back();
  }

  if (done) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.doneWrap}>
          <Text style={styles.doneMark}>✦</Text>
          <Text style={styles.doneTitle}>Thank you</Text>
          <Text style={styles.doneBody}>
            Your answers help decide what {APP_NAME} does next.
          </Text>
          <TouchableOpacity style={styles.doneBtn} onPress={close} activeOpacity={0.85}>
            <Text style={styles.doneBtnText}>Done</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView style={styles.scroll} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">

          <View style={styles.headRow}>
            <Text style={styles.eyebrow}>{APP_NAME_UPPER}</Text>
            <TouchableOpacity onPress={close} hitSlop={10}>
              <Text style={styles.skipAll}>Not now</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.title}>Five questions</Text>

          {/* The anonymity claim has to be visible before question 5 is read,
              or question 5 gets polite answers instead of true ones. */}
          <View style={styles.anonBox}>
            <Text style={styles.anonText}>
              <Text style={styles.anonStrong}>Your answers are anonymous. </Text>
              They are not linked to your name or account, and no one at your church — including
              your Father of Confession — can see them. Skip anything you'd rather not answer.
            </Text>
          </View>

          <Question n={1} title={`How often do you use ${APP_NAME}?`}>
            {Q1.map(o => <Option key={o.value} label={o.label} on={a.frequency === o.value}
              onPress={() => set('frequency', o.value)} />)}
          </Question>

          <Question n={2} title={`Has ${APP_NAME} helped you keep your canon more consistently?`}>
            {Q2.map(o => <Option key={o.value} label={o.label} on={a.consistency === o.value}
              onPress={() => set('consistency', o.value)} />)}
          </Question>

          <Question n={3} title="Which part would you miss most if it disappeared?">
            {Q3.map(o => <Option key={o.value} label={o.label} on={a.most_missed === o.value}
              onPress={() => set('most_missed', o.value)} />)}
          </Question>

          <Question n={4} title="What's the one thing you'd add or change?">
            <TextInput
              style={styles.input}
              value={a.one_change ?? ''}
              onChangeText={t => setA(p => ({ ...p, one_change: t.slice(0, MAX) }))}
              placeholder="Just the one thing that matters most to you…"
              placeholderTextColor={colors.faint}
              multiline
              textAlignVertical="top"
            />
          </Question>

          <Question n={5} title="Is there anything you avoid putting in the app because you're not sure who can see it?">
            <Option label="No" on={a.withholding === false} onPress={() => set('withholding', false)} />
            <Option label="Yes" on={a.withholding === true} onPress={() => set('withholding', true)} />
            {a.withholding === true && (
              <TextInput
                style={[styles.input, { marginTop: 10 }]}
                value={a.withholding_detail ?? ''}
                onChangeText={t => setA(p => ({ ...p, withholding_detail: t.slice(0, MAX) }))}
                placeholder="What holds you back?"
                placeholderTextColor={colors.faint}
                multiline
                textAlignVertical="top"
              />
            )}
          </Question>

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <TouchableOpacity
            style={[styles.sendBtn, (!answered || sending) && styles.sendBtnOff]}
            disabled={!answered || sending}
            onPress={submit}
            activeOpacity={0.85}
          >
            <Text style={styles.sendText}>{sending ? 'Sending…' : 'Send answers'}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.laterBtn} onPress={close}>
            <Text style={styles.laterText}>Ask me another time</Text>
          </TouchableOpacity>

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = lazyThemed(() => StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.navy },
  scroll: { flex: 1 },
  content: { padding: 20, paddingBottom: 48 },

  headRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  eyebrow: { fontFamily: fonts.latoBold, fontSize: 9, letterSpacing: 2.5, color: colors.gold },
  skipAll: { fontFamily: fonts.lato, fontSize: 12, color: colors.muted },
  title: { fontFamily: fonts.cormorantMedium, fontSize: 32, color: colors.cream, marginBottom: 14 },

  anonBox: { padding: 13, borderRadius: 10, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.goldDim, marginBottom: 18 },
  anonText: { fontFamily: fonts.latoLight, fontSize: 12.5, color: colors.muted, lineHeight: 19 },
  anonStrong: { fontFamily: fonts.latoBold, color: colors.cream },

  qNum: { fontFamily: fonts.latoBold, fontSize: 9, letterSpacing: 1.6, color: colors.gold, marginBottom: 6 },
  qTitle: { fontFamily: fonts.lato, fontSize: 15, color: colors.cream, lineHeight: 22, marginBottom: 14 },

  opt: { flexDirection: 'row', alignItems: 'center', gap: 11, paddingVertical: 11, paddingHorizontal: 12, borderRadius: 9, marginBottom: 6, borderWidth: 1, borderColor: 'transparent' },
  optOn: { borderColor: colors.gold, backgroundColor: 'rgba(201,168,76,0.07)' },
  radio: { width: 18, height: 18, borderRadius: 9, borderWidth: 1.5, borderColor: 'rgba(201,168,76,0.35)', alignItems: 'center', justifyContent: 'center' },
  radioOn: { borderColor: colors.gold },
  radioDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.gold },
  optText: { fontFamily: fonts.lato, fontSize: 14, color: colors.textSecond, flex: 1 },
  optTextOn: { color: colors.cream },

  input: { fontFamily: fonts.lato, fontSize: 14, color: colors.cream, minHeight: 96, borderWidth: 1, borderColor: colors.border, borderRadius: 10, padding: 12, lineHeight: 20 },
  error: { fontFamily: fonts.lato, fontSize: 12, color: colors.red, marginTop: 12 },

  sendBtn: { marginTop: 20, paddingVertical: 14, borderRadius: 10, backgroundColor: colors.gold, alignItems: 'center' },
  sendBtnOff: { opacity: 0.4 },
  sendText: { fontFamily: fonts.latoBold, fontSize: 13, letterSpacing: 0.5, color: colors.navy },
  laterBtn: { marginTop: 14, alignItems: 'center' },
  laterText: { fontFamily: fonts.lato, fontSize: 12, color: colors.muted },

  doneWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  doneMark: { fontSize: 34, color: colors.gold, marginBottom: 14 },
  doneTitle: { fontFamily: fonts.cormorantMedium, fontSize: 28, color: colors.cream, marginBottom: 8 },
  doneBody: { fontFamily: fonts.latoLight, fontSize: 13, color: colors.muted, textAlign: 'center', lineHeight: 20 },
  doneBtn: { marginTop: 26, paddingVertical: 12, paddingHorizontal: 34, borderRadius: 10, borderWidth: 1, borderColor: colors.gold },
  doneBtnText: { fontFamily: fonts.latoBold, fontSize: 13, color: colors.gold, letterSpacing: 0.5 },
}));
