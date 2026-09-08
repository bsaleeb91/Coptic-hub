// app/feedback.tsx
// Send feedback from inside the app.
//
// Until now the only way to report anything was an email address at the foot
// of the privacy policy, which the people most likely to hit a problem are the
// least likely to find. Reports go to admins only — never to a priest or
// servant (see the RLS in 20260907_app_feedback.sql), so a member can say that
// something is broken, or that they dislike part of an assigned canon, without
// it surfacing in the pastoral relationship. The screen says so plainly.

import React, { useState, useEffect } from 'react';
import {
  ScrollView, View, Text, StyleSheet, TextInput, TouchableOpacity,
  Platform, KeyboardAvoidingView, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Constants from 'expo-constants';
import { goBack } from '@/lib/nav';
import { colors, fonts, lazyThemed } from '@/lib/theme';
import { useSession } from '@/lib/auth';
import { Card } from '@/components/ui/Card';
import * as db from '@/lib/db';
import type { FeedbackCategory, Feedback } from '@/lib/db/feedback';
import * as H from '@/lib/haptics';

const CATEGORIES: { value: FeedbackCategory; label: string; hint: string }[] = [
  { value: 'bug',   label: 'Something is broken', hint: 'What were you doing when it went wrong?' },
  { value: 'idea',  label: 'An idea',             hint: 'What would you like the app to do?' },
  { value: 'other', label: 'Something else',      hint: 'Anything you want to tell us.' },
];

const MAX = 2000;

function Chip({ label, on, onPress }: { label: string; on: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity
      style={[styles.chip, on && styles.chipOn]}
      onPress={onPress}
      activeOpacity={0.8}
    >
      <Text style={[styles.chipText, on && styles.chipTextOn]}>{label}</Text>
    </TouchableOpacity>
  );
}

export default function FeedbackScreen() {
  const { user, profile } = useSession();
  const [category, setCategory] = useState<FeedbackCategory>('bug');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);
  const [mine, setMine] = useState<Feedback[] | null>(null);

  // Attached to the report and shown below, so what is being sent is never a
  // guess. Deliberately only what helps reproduce a problem — no device id, no
  // location, nothing that identifies the phone itself.
  const context = {
    app_version: (Constants.expoConfig?.version as string) ?? null,
    platform: Platform.OS,
    role: profile?.role ?? null,
  };

  useEffect(() => {
    if (user) db.getMyFeedback(user.id).then(setMine);
  }, [user, sent]);

  async function send() {
    if (!user) return;
    setSending(true);
    setError('');
    const { error: err } = await db.submitFeedback(user.id, category, message, context);
    setSending(false);
    if (err) { setError(err); return; }
    H.success();
    setMessage('');
    setSent(true);
  }

  const hint = CATEGORIES.find(c => c.value === category)!.hint;
  const remaining = MAX - message.length;

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView style={styles.scroll} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">

          <TouchableOpacity style={styles.backRow} onPress={() => goBack('/profile')}>
            <Text style={styles.backArrow}>‹</Text>
            <Text style={styles.backText}>Back</Text>
          </TouchableOpacity>

          <Text style={styles.eyebrow}>POIMEN</Text>
          <Text style={styles.title}>Send Feedback</Text>

          {sent ? (
            <Card title="Thank you" titleIcon="✦">
              <Text style={styles.body}>
                Your message has been sent. We read everything, though we can't always reply.
              </Text>
              <TouchableOpacity style={styles.againBtn} onPress={() => { H.tap(); setSent(false); }}>
                <Text style={styles.againText}>Send something else</Text>
              </TouchableOpacity>
            </Card>
          ) : (
            <Card title="" titleIcon="">
              <Text style={styles.label}>What kind of feedback is this?</Text>
              <View style={styles.chipRow}>
                {CATEGORIES.map(c => (
                  <Chip key={c.value} label={c.label} on={category === c.value}
                    onPress={() => { H.tap(); setCategory(c.value); }} />
                ))}
              </View>

              <Text style={[styles.label, { marginTop: 18 }]}>{hint}</Text>
              <TextInput
                style={styles.input}
                value={message}
                onChangeText={t => setMessage(t.slice(0, MAX))}
                placeholder="Type as much or as little as you like…"
                placeholderTextColor={colors.faint}
                multiline
                textAlignVertical="top"
              />
              <Text style={styles.counter}>{remaining} characters left</Text>

              {error ? <Text style={styles.error}>{error}</Text> : null}

              <TouchableOpacity
                style={[styles.sendBtn, (!message.trim() || sending) && styles.sendBtnOff]}
                disabled={!message.trim() || sending}
                onPress={send}
                activeOpacity={0.85}
              >
                <Text style={styles.sendText}>{sending ? 'Sending…' : 'Send'}</Text>
              </TouchableOpacity>
            </Card>
          )}

          {/* Said plainly rather than buried: who can read this, and what rides
              along with it. */}
          <Card title="What gets sent" titleIcon="🔒">
            <Text style={styles.body}>
              Your message goes to the people who build Poimen. It is
              <Text style={styles.strong}> not visible to your Father of Confession</Text>, your
              servant, or anyone at your church.
            </Text>
            <View style={styles.ctxBox}>
              <Text style={styles.ctxRow}>App version · {context.app_version ?? 'unknown'}</Text>
              <Text style={styles.ctxRow}>Platform · {context.platform}</Text>
              <Text style={styles.ctxRow}>Your role · {context.role ?? 'not set'}</Text>
            </View>
            <Text style={styles.bodySmall}>
              Nothing else is attached — not your location, not your journal, confession, or
              prayer entries.
            </Text>
          </Card>

          {mine && mine.length > 0 && (
            <Card title={`What you've sent (${mine.length})`} flat>
              {mine.map(f => (
                <View key={f.id} style={styles.pastRow}>
                  <View style={styles.pastHead}>
                    <Text style={styles.pastCat}>
                      {CATEGORIES.find(c => c.value === f.category)?.label ?? f.category}
                    </Text>
                    <Text style={[styles.pastStatus, f.status === 'resolved' && { color: colors.green }]}>
                      {f.status === 'new' ? 'Sent' : f.status === 'read' ? 'Read' : 'Resolved'}
                    </Text>
                  </View>
                  <Text style={styles.pastMsg} numberOfLines={3}>{f.message}</Text>
                  <Text style={styles.pastDate}>
                    {new Date(f.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </Text>
                </View>
              ))}
            </Card>
          )}
          {mine === null && <ActivityIndicator color={colors.gold} style={{ marginTop: 16 }} />}

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = lazyThemed(() => StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.navy },
  scroll: { flex: 1 },
  content: { padding: 20, paddingBottom: 48 },

  backRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 24 },
  backArrow: { fontFamily: fonts.cormorant, fontSize: 22, color: colors.gold },
  backText: { fontFamily: fonts.latoLight, fontSize: 13, color: colors.muted },

  eyebrow: { fontFamily: fonts.latoBold, fontSize: 9, letterSpacing: 2.5, color: colors.gold, marginBottom: 6 },
  title: { fontFamily: fonts.cormorantMedium, fontSize: 32, color: colors.cream, marginBottom: 20 },

  label: { fontFamily: fonts.latoBold, fontSize: 11, letterSpacing: 0.8, color: colors.cream, textTransform: 'uppercase' as any, marginBottom: 10 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap' as any, gap: 8 },
  chip: { paddingVertical: 8, paddingHorizontal: 13, borderRadius: 8, borderWidth: 1, borderColor: colors.border },
  chipOn: { borderColor: colors.gold, backgroundColor: colors.gold },
  chipText: { fontFamily: fonts.lato, fontSize: 12, color: colors.textSecond },
  chipTextOn: { color: colors.navy, fontFamily: fonts.latoBold },

  input: {
    fontFamily: fonts.lato, fontSize: 14, color: colors.cream, minHeight: 130,
    borderWidth: 1, borderColor: colors.border, borderRadius: 10, padding: 12, lineHeight: 20,
  },
  counter: { fontFamily: fonts.latoLight, fontSize: 11, color: colors.faint, textAlign: 'right', marginTop: 6 },
  error: { fontFamily: fonts.lato, fontSize: 12, color: colors.red, marginTop: 10 },

  sendBtn: { marginTop: 16, paddingVertical: 13, borderRadius: 10, backgroundColor: colors.gold, alignItems: 'center' },
  sendBtnOff: { opacity: 0.4 },
  sendText: { fontFamily: fonts.latoBold, fontSize: 13, letterSpacing: 0.5, color: colors.navy },

  againBtn: { marginTop: 14, alignSelf: 'flex-start' },
  againText: { fontFamily: fonts.latoBold, fontSize: 12, color: colors.gold },

  body: { fontFamily: fonts.latoLight, fontSize: 13, color: colors.muted, lineHeight: 21 },
  bodySmall: { fontFamily: fonts.latoLight, fontSize: 12, color: colors.faint, lineHeight: 18, marginTop: 10 },
  strong: { fontFamily: fonts.latoBold, color: colors.cream },

  ctxBox: { marginTop: 12, padding: 12, borderRadius: 9, borderWidth: 1, borderColor: colors.border, gap: 4 },
  ctxRow: { fontFamily: fonts.lato, fontSize: 12, color: colors.textSecond },

  pastRow: { paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.border },
  pastHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  pastCat: { fontFamily: fonts.latoBold, fontSize: 11, letterSpacing: 0.5, color: colors.gold },
  pastStatus: { fontFamily: fonts.latoBold, fontSize: 10, letterSpacing: 0.8, color: colors.muted, textTransform: 'uppercase' as any },
  pastMsg: { fontFamily: fonts.lato, fontSize: 13, color: colors.cream, lineHeight: 19 },
  pastDate: { fontFamily: fonts.latoLight, fontSize: 11, color: colors.faint, marginTop: 4 },
}));
