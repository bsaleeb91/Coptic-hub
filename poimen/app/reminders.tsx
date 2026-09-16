// app/reminders.tsx
// Reminders for the Canon and the Psalms.
//
// Both are off until switched on here, and both are local to this phone — there
// is no push server, no device token, and nothing about a member's rule or
// review queue leaves the device to make a reminder happen. The screen says so
// plainly rather than leaving it to be assumed, because a notification arriving
// from an app that holds confession notes invites exactly that question.

import React, { useState, useEffect, useCallback } from 'react';
import {
  ScrollView, View, Text, StyleSheet, TouchableOpacity, Switch, ActivityIndicator, Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { goBack } from '@/lib/nav';
import { colors, fonts, lazyThemed } from '@/lib/theme';
import { APP_NAME, APP_NAME_UPPER } from '@/lib/brand';
import { useSession } from '@/lib/auth';
import { useDemoMode } from '@/lib/demo';
import { Card } from '@/components/ui/Card';
import * as H from '@/lib/haptics';
import {
  ReminderKind, ReminderSettings, loadReminderSettings, saveReminderSettings,
} from '@/lib/reminders/store';
import { formatTime, stepTime } from '@/lib/reminders/phrasing';
import {
  remindersSupported, getPermissionState, requestPermission,
  syncReminders, pendingCount, PermissionState,
} from '@/lib/reminders/schedule';
import { registerForPush, unregisterPush } from '@/lib/push/register';
import * as db from '@/lib/db';
import type { PushCategory, PushPrefs } from '@/lib/db/push';
import { DEFAULT_PUSH_PREFS } from '@/lib/db/push';

const STEP_MINUTES = 30;

// The server-sent half. Split from the reminders above because the difference
// is not cosmetic: those are written by this phone from data it already holds,
// these arrive from Nepsis's servers about things the phone cannot know.
// Appointments and assignments default on — being told the thing you asked for
// was confirmed is the service you requested. The other two default off.
const PUSH_COPY: { key: PushCategory; title: string; hint: string }[] = [
  { key: 'appointments', title: 'Appointments',
    hint: 'When your father confirms, declines or cancels a time you asked for. Without this you find out by opening the app and noticing.' },
  { key: 'assignments',  title: 'Something assigned to you',
    hint: 'When your Father of Confession assigns part of your canon, or your servant assigns psalms.' },
  { key: 'canon_nudge',  title: 'A nudge about your canon',
    hint: 'Only when this phone has already told the server the day is unfinished. If you have been away, nothing is sent — the server would be guessing.' },
  { key: 'reengagement', title: 'If you have been away a while',
    hint: 'One message after a long absence. Never more than one.' },
];

const COPY: Record<ReminderKind, { title: string; icon: string; on: string; off: string }> = {
  canon: {
    title: 'Your canon',
    icon: '✝︎',
    on:  'Names what your rule actually asks of you that day — the hours, the services, anything your father has assigned. Nothing arrives on a day your rule is empty, or after you have finished it.',
    off: 'A reminder each day your rule has something standing in it.',
  },
  psalms: {
    title: 'Psalm memorization',
    icon: '✦',
    on:  'Arrives only when portions are actually due for review, and leads with your streak when there is one to keep. A day with nothing due stays quiet.',
    off: 'A reminder on the days your review queue has something in it.',
  },
};

export default function RemindersScreen() {
  const { user, profile } = useSession();
  const { demoMode } = useDemoMode();

  const [settings, setSettings] = useState<ReminderSettings | null>(null);
  const [permission, setPermission] = useState<PermissionState>('undetermined');
  const [pending, setPending] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);

  // Push prefs live on the server (they have to — the server schedules in the
  // member's local time). Null until loaded; the defaults stand in so the
  // switches never flash the wrong way on first open.
  const [push, setPush] = useState<PushPrefs | null>(null);
  const [pushBusy, setPushBusy] = useState<PushCategory | null>(null);
  const [pushRegistered, setPushRegistered] = useState(false);

  const ctx = { userId: user?.id ?? null, demoMode, focId: profile?.foc_id ?? null };

  useEffect(() => {
    loadReminderSettings().then(setSettings);
  }, []);

  useEffect(() => {
    if (!user) return;
    db.getPushPrefs(user.id).then(p => setPush(p ?? DEFAULT_PUSH_PREFS));
    db.listMyPushTokens(user.id).then(rows =>
      setPushRegistered(rows.some(r => r.disabled_at === null)));
  }, [user?.id]);

  // Re-read on focus: permission is commonly granted or revoked in system
  // Settings, which means the answer can change while this screen is mounted
  // but backgrounded.
  useFocusEffect(useCallback(() => {
    let live = true;
    getPermissionState().then(p => { if (live) setPermission(p); });
    pendingCount().then(n => { if (live) setPending(n); });
    return () => { live = false; };
  }, []));

  async function apply(next: ReminderSettings) {
    setSettings(next);
    setBusy(true);
    await saveReminderSettings(next);
    const n = await syncReminders(ctx);
    setPending(n);
    setBusy(false);
  }

  async function toggle(kind: ReminderKind, value: boolean) {
    if (!settings) return;
    H.tap();

    if (value) {
      const granted = await requestPermission();
      setPermission(granted);
      // Left off rather than switched on into silence — a toggle that says ON
      // while the OS drops every notification is worse than one that never
      // moved, because it hides where the problem is.
      if (granted !== 'granted') return;
    }

    await apply({ ...settings, [kind]: { ...settings[kind], enabled: value } });
  }

  // Turning any push category on is what asks for the OS permission and
  // registers this device — there is no separate "enable push" switch, because
  // a switch that only unlocks other switches is a step with nothing behind it.
  async function togglePush(key: PushCategory, value: boolean) {
    if (!push || !user) return;
    H.tap();
    setPushBusy(key);

    if (value && !pushRegistered) {
      const { reason } = await registerForPush(user.id, { interactive: true });
      if (reason !== 'ok') {
        // Left off rather than switched on into silence, same as the local
        // reminders above: a switch reading ON while nothing can arrive hides
        // where the problem is.
        setPermission(await getPermissionState());
        setPushBusy(null);
        return;
      }
      setPushRegistered(true);
    }

    const next = { ...push, [key]: value };
    setPush(next);
    await db.savePushPrefs(user.id, { [key]: value });

    // Nothing left switched on means nothing to send to. Dropping the token
    // keeps the server from queueing messages that can only be discarded.
    if (!PUSH_COPY.some(c => next[c.key])) {
      await unregisterPush();
      setPushRegistered(false);
    }
    setPushBusy(null);
  }

  async function nudge(kind: ReminderKind, delta: number) {
    if (!settings) return;
    H.tap();
    const { hour, minute } = stepTime(settings[kind].hour, settings[kind].minute, delta);
    await apply({ ...settings, [kind]: { ...settings[kind], hour, minute } });
  }

  if (!remindersSupported) {
    return (
      <SafeAreaView style={styles.safe}>
        <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
          <BackRow />
          <Text style={styles.eyebrow}>{APP_NAME_UPPER}</Text>
          <Text style={styles.title}>Reminders</Text>
          <Card title="Not available here" titleIcon="✦">
            <Text style={styles.body}>
              Reminders are sent by your phone, so they work in the {APP_NAME} app on iPhone and
              Android — not in the browser. Everything else on this screen works the same in both.
            </Text>
          </Card>
        </ScrollView>
      </SafeAreaView>
    );
  }

  if (!settings) {
    return (
      <SafeAreaView style={styles.safe}>
        <ActivityIndicator color={colors.gold} style={{ marginTop: 60 }} />
      </SafeAreaView>
    );
  }

  const anyOn = settings.canon.enabled || settings.psalms.enabled;
  const blocked = permission === 'denied';

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        <BackRow />
        <Text style={styles.eyebrow}>{APP_NAME_UPPER}</Text>
        <Text style={styles.title}>Reminders</Text>
        <Text style={styles.subtitle}>Set by you, kept on this phone</Text>

        {blocked && (
          <View style={styles.blockedBox}>
            <Text style={styles.blockedText}>
              <Text style={styles.strong}>Notifications are turned off for {APP_NAME}. </Text>
              Turn them back on in your phone's Settings, then come back here.
            </Text>
            <TouchableOpacity onPress={() => { H.tap(); Linking.openSettings(); }}>
              <Text style={styles.blockedLink}>Open Settings →</Text>
            </TouchableOpacity>
          </View>
        )}

        {(['canon', 'psalms'] as ReminderKind[]).map(kind => {
          const s = settings[kind];
          const copy = COPY[kind];
          return (
            <Card key={kind} title={copy.title} titleIcon={copy.icon}>
              <View style={styles.toggleRow}>
                <Text style={styles.toggleLabel}>Remind me</Text>
                <Switch
                  value={s.enabled}
                  onValueChange={v => toggle(kind, v)}
                  disabled={busy}
                  trackColor={{ false: colors.creamDim, true: 'rgba(201,168,76,0.4)' }}
                  thumbColor={s.enabled ? colors.gold : colors.faint}
                />
              </View>

              {s.enabled && (
                <View style={styles.timeRow}>
                  <TouchableOpacity
                    style={styles.stepBtn}
                    onPress={() => nudge(kind, -STEP_MINUTES)}
                    disabled={busy}
                    accessibilityLabel={`Move the ${copy.title} reminder earlier`}
                  >
                    <Text style={styles.stepText}>‹</Text>
                  </TouchableOpacity>
                  <View style={styles.timeBox}>
                    <Text style={styles.timeValue}>{formatTime(s.hour, s.minute)}</Text>
                    <Text style={styles.timeCaption}>every day</Text>
                  </View>
                  <TouchableOpacity
                    style={styles.stepBtn}
                    onPress={() => nudge(kind, STEP_MINUTES)}
                    disabled={busy}
                    accessibilityLabel={`Move the ${copy.title} reminder later`}
                  >
                    <Text style={styles.stepText}>›</Text>
                  </TouchableOpacity>
                </View>
              )}

              <Text style={styles.hint}>{s.enabled ? copy.on : copy.off}</Text>
            </Card>
          );
        })}

        {/* Sent by Nepsis rather than written by this phone. Kept visually
            separate from the two cards above because the distinction is the
            whole point of the section. */}
        <Text style={styles.groupLabel}>SENT TO YOU</Text>
        <Card title="From Nepsis" titleIcon="✉">
          <Text style={styles.hint}>
            These come from {APP_NAME} rather than from this phone, because they are about things
            your phone has no way of knowing — a time your father confirmed while the app was
            closed. Turning the first one on asks for permission and registers this device.
          </Text>
          {push === null ? (
            <ActivityIndicator color={colors.gold} style={{ marginTop: 16 }} />
          ) : (
            PUSH_COPY.map(c => (
              <View key={c.key} style={styles.pushRow}>
                <View style={{ flex: 1, paddingRight: 14 }}>
                  <Text style={styles.toggleLabel}>{c.title}</Text>
                  <Text style={styles.pushHint}>{c.hint}</Text>
                </View>
                <Switch
                  value={push[c.key]}
                  onValueChange={v => togglePush(c.key, v)}
                  disabled={pushBusy !== null || blocked}
                  trackColor={{ false: colors.creamDim, true: 'rgba(201,168,76,0.4)' }}
                  thumbColor={push[c.key] ? colors.gold : colors.faint}
                />
              </View>
            ))
          )}
        </Card>

        {/* The honest description of the mechanism, in the place someone would
            think to ask. */}
        <Card title="What a reminder knows" titleIcon="🔒">
          <Text style={styles.body}>
            The two reminders above are written by this phone, not sent to it. Your rule, your
            review queue and your streak are read from this device to write them, and none of
            that leaves it.
          </Text>
          <Text style={styles.bodySmall}>
            What {APP_NAME} is sent, so that the messages under “From Nepsis” can reach you: a code
            identifying this device, your time zone and the hour you chose, and — only if you turn
            on the canon nudge — how many things your rule asked of you each day and how many you
            marked done. Counts only, never which ones.
          </Text>
          <Text style={styles.bodySmall}>
            Your Father of Confession, your servant and your church see none of it, and cannot see
            whether reminders are on or whether you acted on one.
          </Text>
          {anyOn && pending !== null && (
            <View style={styles.statusBox}>
              <Text style={styles.statusText}>
                {pending === 0
                  ? 'Nothing scheduled right now — there is nothing due in the next two weeks.'
                  : `${pending} ${pending === 1 ? 'reminder' : 'reminders'} scheduled over the next two weeks.`}
              </Text>
              <Text style={styles.statusSub}>
                Days with nothing due are skipped. The schedule is refreshed each time you open {APP_NAME}.
              </Text>
            </View>
          )}
          {busy && <ActivityIndicator color={colors.gold} style={{ marginTop: 12 }} />}
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

function BackRow() {
  return (
    <TouchableOpacity style={styles.backRow} onPress={() => goBack('/profile')}>
      <Text style={styles.backArrow}>‹</Text>
      <Text style={styles.backText}>Back</Text>
    </TouchableOpacity>
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
  title: { fontFamily: fonts.cormorantMedium, fontSize: 30, color: colors.cream, marginBottom: 4 },
  subtitle: { fontFamily: fonts.latoLight, fontSize: 12, color: colors.muted, marginBottom: 24 },

  blockedBox: {
    flexDirection: 'column', gap: 8,
    backgroundColor: colors.yellowBg,
    borderWidth: 1, borderColor: 'rgba(245,200,66,0.3)',
    borderRadius: 12, padding: 14, marginBottom: 20,
  },
  blockedText: { fontFamily: fonts.latoLight, fontSize: 13, color: colors.cream, lineHeight: 20 },
  blockedLink: { fontFamily: fonts.latoBold, fontSize: 12, color: colors.gold },

  toggleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  toggleLabel: { fontFamily: fonts.lato, fontSize: 14, color: colors.cream },

  timeRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 16 },
  stepBtn: {
    width: 44, height: 44, borderRadius: 10,
    borderWidth: 1, borderColor: colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  stepText: { fontFamily: fonts.cormorant, fontSize: 26, color: colors.gold, lineHeight: 30 },
  timeBox: { flex: 1, alignItems: 'center' },
  timeValue: { fontFamily: fonts.cormorantMedium, fontSize: 26, color: colors.cream },
  timeCaption: {
    fontFamily: fonts.latoBold, fontSize: 9, letterSpacing: 1.5,
    color: colors.faint, textTransform: 'uppercase', marginTop: 2,
  },

  hint: { fontFamily: fonts.latoLight, fontSize: 12, color: colors.muted, lineHeight: 19, marginTop: 14 },

  groupLabel: {
    fontFamily: fonts.latoBold, fontSize: 10, letterSpacing: 1.6,
    textTransform: 'uppercase', color: colors.textSecond, marginBottom: 10, marginTop: 4,
  },
  pushRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 12, borderTopWidth: 1, borderTopColor: colors.border,
  },
  pushHint: { fontFamily: fonts.latoLight, fontSize: 11, color: colors.muted, lineHeight: 17, marginTop: 3 },

  body: { fontFamily: fonts.latoLight, fontSize: 13, color: colors.textSecond, lineHeight: 21 },
  bodySmall: { fontFamily: fonts.latoLight, fontSize: 12, color: colors.muted, lineHeight: 19, marginTop: 10 },
  strong: { fontFamily: fonts.latoBold, color: colors.cream },

  statusBox: {
    backgroundColor: colors.panel, borderRadius: 10,
    paddingVertical: 12, paddingHorizontal: 14, marginTop: 16,
  },
  statusText: { fontFamily: fonts.lato, fontSize: 12, color: colors.cream, lineHeight: 18 },
  statusSub: { fontFamily: fonts.latoLight, fontSize: 11, color: colors.faint, lineHeight: 17, marginTop: 6 },
}));
