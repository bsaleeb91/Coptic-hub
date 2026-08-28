// app/(tabs)/appointments.tsx
// Congregant scheduling: browse the open slots the Father of Confession's
// recurring availability produces, request one (the priest must confirm), and
// track the status of your requests. Cloud-only (lib/db/scheduling.ts); demo
// mode uses an in-memory copy for the preview.

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { ScrollView, View, Text, StyleSheet, TouchableOpacity, TextInput, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { DrawerActions } from '@react-navigation/native';
import { colors, fonts, lazyThemed } from '@/lib/theme';
import { Card } from '@/components/ui/Card';
import { useSession } from '@/lib/auth';
import { useDemoMode } from '@/lib/demo';
import { confirmDestructive } from '@/lib/confirm';
import * as H from '@/lib/haptics';
import * as db from '@/lib/db';
import type { AppointmentType, AvailabilityRuleRow, Appointment } from '@/lib/db';
import {
  generateOpenSlots, groupSlotsByDay, groupDaysByMonth, formatTime, formatDayLabel,
  SCHEDULE_HORIZON_DAYS,
  type OpenSlot, type AvailabilityRule, type DateException,
} from '@/lib/scheduling/slots';

const STATUS_STYLE: Record<Appointment['status'], { label: string; color: string }> = {
  requested: { label: 'Pending confirmation', color: colors.gold },
  confirmed: { label: 'Confirmed', color: colors.green },
  declined:  { label: 'Declined', color: colors.red },
  cancelled: { label: 'Cancelled', color: colors.muted },
};

export default function AppointmentsScreen() {
  const navigation = useNavigation();
  // Links elsewhere ("Request a confession appointment", "Schedule a Pastoral
  // Visit") arrive with ?focus=<keyword> to land on the right kind of slot.
  const { focus } = useLocalSearchParams<{ focus?: string }>();
  const { user } = useSession();
  const { demoMode } = useDemoMode();

  const [loading, setLoading] = useState(!demoMode);
  // Distinct from `loading`, which starts false in demo mode: this only flips
  // once the priest's types are actually in hand, which is what ?focus needs.
  const [ready, setReady] = useState(false);
  const [focId, setFocId] = useState<string | null>(demoMode ? 'demo-foc' : null);
  const [focName, setFocName] = useState<string>('your Father of Confession');
  const [consented, setConsented] = useState(true);
  const [open, setOpen] = useState(false);
  const [types, setTypes] = useState<AppointmentType[]>([]);
  const [rules, setRules] = useState<AvailabilityRuleRow[]>([]);
  const [busy, setBusy] = useState<{ starts_at: string; duration_minutes: number }[]>([]);
  const [exceptions, setExceptions] = useState<DateException[]>([]);
  const [mine, setMine] = useState<Appointment[]>([]);
  const [typeFilter, setTypeFilter] = useState<string | null>(null);
  const [expandedMonths, setExpandedMonths] = useState<Record<string, boolean>>({});

  const [pending, setPending] = useState<OpenSlot | null>(null); // slot awaiting the confirm step
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [reqErr, setReqErr] = useState('');

  const load = useCallback(async () => {
    if (demoMode) {
      const now = new Date();
      const soon = new Date(now); soon.setDate(now.getDate() + 2); soon.setHours(15, 0, 0, 0);
      setFocId('demo-foc'); setFocName('Fr. Bishoy'); setConsented(true); setOpen(true);
      setTypes([
        { id: 'dt-conf', priest_id: 'demo', label: 'Holy Confession', duration_minutes: 30, active: true, sort: 0, created_at: '' },
        { id: 'dt-visit', priest_id: 'demo', label: 'Home Visitation', duration_minutes: 60, active: true, sort: 1, created_at: '' },
      ]);
      setRules([
        { id: 'dr-1', priest_id: 'demo', type_id: 'dt-conf', weekday: 0, start_minute: 840, end_minute: 960, active: true, created_at: '' },
        { id: 'dr-2', priest_id: 'demo', type_id: 'dt-conf', weekday: 3, start_minute: 1080, end_minute: 1170, active: true, created_at: '' },
        // Visitation needs its own window, or the demo's "Schedule a Pastoral
        // Visit" chip would always land on an empty list.
        { id: 'dr-3', priest_id: 'demo', type_id: 'dt-visit', weekday: 6, start_minute: 600, end_minute: 780, active: true, created_at: '' },
      ]);
      setBusy([{ starts_at: soon.toISOString(), duration_minutes: 30 }]);
      // The FOC is away the next two Sundays: the first entirely, the second
      // only for the 2:00 PM hour.
      const p = (n: number) => String(n).padStart(2, '0');
      const key = (d: Date) => `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
      const nextSunday = new Date(now); nextSunday.setDate(now.getDate() + ((7 - now.getDay()) || 7));
      const sundayAfter = new Date(nextSunday); sundayAfter.setDate(nextSunday.getDate() + 7);
      setExceptions([
        { on_date: key(nextSunday), start_minute: null, end_minute: null },
        { on_date: key(sundayAfter), start_minute: 840, end_minute: 900 },
      ]);
      setMine([
        { id: 'ma-1', priest_id: 'demo', congregant_id: 'me', type_id: 'dt-conf', type_label: 'Holy Confession', starts_at: soon.toISOString(), duration_minutes: 30, status: 'confirmed', note: null, created_at: '', updated_at: '' },
      ]);
      setLoading(false);
      return;
    }
    if (!user) return;
    setLoading(true);
    const profile = await db.getProfile(user.id);
    const foc = profile?.foc_id ?? null;
    setFocId(foc);
    setConsented(!!profile?.foc_consent_at);
    if (!foc) { setLoading(false); return; }
    const [o, t, r, b, m, fp, ex] = await Promise.all([
      db.getSchedulingOpen(foc),
      db.getAppointmentTypes(foc),
      db.getAvailabilityRules(foc),
      db.getFocBusyRanges(),
      db.getMyAppointments(user.id),
      db.getFocProfile(foc),
      db.getAvailabilityExceptions(foc),
    ]);
    setOpen(o); setTypes(t); setRules(r); setBusy(b); setMine(m); setExceptions(ex);
    setFocName(fp?.full_name ?? 'your Father of Confession');
    setLoading(false);
  }, [demoMode, user]);

  useEffect(() => { load().then(() => setReady(true)); }, [demoMode, user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Match the keyword against whatever the priest actually named his types
  // ("Holy Confession", "Home Visitation", …) and preselect it; an unmatched
  // keyword just leaves the list unfiltered. The param is cleared once applied
  // so the drawer's own Appointments item — which reuses this route — doesn't
  // stay stuck on that filter, and so a later tap on "All" isn't undone.
  // navigation.setParams, not router.setParams: the imperative router clears the
  // param on whatever is focused, which is the wrong route if the member
  // navigated away while this screen was still loading.
  useEffect(() => {
    if (!ready || !focus) return;
    const needle = String(focus).toLowerCase();
    const match = types.find(t => t.active && t.label.toLowerCase().includes(needle));
    if (match) setTypeFilter(match.id);
    navigation.setParams({ focus: '' } as never);
  }, [ready, focus, types]); // eslint-disable-line react-hooks/exhaustive-deps

  // This is a drawer screen: it mounts once and stays mounted, so without a
  // clock of its own "now" would freeze at first load and slots that have since
  // passed would go on looking bookable (the server rejects them). Ticking on
  // focus and once a minute keeps the list honest.
  const [nowMs, setNowMs] = useState(() => Date.now());
  useFocusEffect(useCallback(() => {
    setNowMs(Date.now());
    const id = setInterval(() => setNowMs(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []));

  // A year of a busy priest's recurrence is thousands of slots, so generation
  // is memoized and only redone when the availability changes or the local day
  // rolls over (the day is what anchors the horizon).
  const dayKey = new Date(nowMs).toDateString();
  const allSlots = useMemo(() => {
    const activeRules: AvailabilityRule[] = rules.map(r => ({
      id: r.id, type_id: r.type_id, weekday: r.weekday, start_minute: r.start_minute, end_minute: r.end_minute, active: r.active,
    }));
    return generateOpenSlots(activeRules, types, busy, { days: SCHEDULE_HORIZON_DAYS, exceptions });
  }, [rules, types, busy, exceptions, dayKey]);

  // Dropping elapsed slots happens here rather than in generation: filtering a
  // few thousand is cheap enough to redo every minute, regenerating is not.
  const months = useMemo(() => {
    const slots = allSlots.filter(s =>
      s.start.getTime() > nowMs && (!typeFilter || s.typeId === typeFilter));
    return groupDaysByMonth(groupSlotsByDay(slots));
  }, [allSlots, typeFilter, nowMs]);

  // The nearest month is open; the rest of the year waits behind its header.
  const monthOpen = (key: string, i: number) => expandedMonths[key] ?? i === 0;
  const toggleMonth = (key: string, i: number) =>
    setExpandedMonths(p => ({ ...p, [key]: !(p[key] ?? i === 0) }));

  const myUpcoming = mine
    .filter(a => (a.status === 'requested' || a.status === 'confirmed') && new Date(a.starts_at).getTime() >= nowMs - 3600_000)
    .sort((a, b) => a.starts_at.localeCompare(b.starts_at));

  async function submitRequest() {
    if (!pending) return;
    setReqErr(''); setSubmitting(true);
    if (demoMode) {
      setMine(p => [...p, {
        id: `ma-${Date.now()}`, priest_id: 'demo', congregant_id: 'me', type_id: pending.typeId,
        type_label: pending.typeLabel, starts_at: pending.start.toISOString(), duration_minutes: pending.duration,
        status: 'requested', note: note.trim() || null, created_at: '', updated_at: '',
      }]);
      setBusy(p => [...p, { starts_at: pending.start.toISOString(), duration_minutes: pending.duration }]);
      setSubmitting(false); setPending(null); setNote('');
      return;
    }
    const { error } = await db.requestAppointment(pending.typeId, pending.start.toISOString(), note.trim() || undefined);
    setSubmitting(false);
    if (error) { setReqErr(error); return; }
    setPending(null); setNote('');
    await load();
  }

  function cancelMine(a: Appointment) {
    confirmDestructive('Cancel', `Cancel your ${a.type_label} on ${formatDayLabel(new Date(a.starts_at))}?`, 'Cancel it', async () => {
      setMine(p => p.map(x => x.id === a.id ? { ...x, status: 'cancelled' } : x));
      // Give the time back to the open list — otherwise the slot they just
      // freed stays hidden until the app restarts, and they can't rebook it.
      if (demoMode) {
        setBusy(p => p.filter(b => b.starts_at !== a.starts_at));
        return;
      }
      await db.cancelAppointment(a.id);
      await load();
    });
  }

  if (loading) {
    return <SafeAreaView style={styles.safe}><ActivityIndicator color={colors.gold} style={{ marginTop: 80 }} /></SafeAreaView>;
  }

  // ── Confirm step ──
  if (pending) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.detailHeader}>
          <TouchableOpacity onPress={() => { setPending(null); setNote(''); setReqErr(''); }} hitSlop={10}>
            <Text style={styles.back}>‹ Back</Text>
          </TouchableOpacity>
        </View>
        <ScrollView contentContainerStyle={styles.content}>
          <Text style={styles.pageTitle}>Request appointment</Text>
          <Card flat>
            <Text style={styles.confirmType}>{pending.typeLabel}</Text>
            <Text style={styles.confirmWhen}>{formatDayLabel(pending.start)} · {formatTime(pending.start)}</Text>
            <Text style={styles.confirmDur}>{pending.duration} minutes · with {focName}</Text>
          </Card>
          <Text style={[styles.formLabel, { marginTop: 16 }]}>NOTE (OPTIONAL)</Text>
          <TextInput style={styles.textarea} multiline placeholder="Anything you'd like your father to know ahead of time." placeholderTextColor={colors.faint} value={note} onChangeText={setNote} />
          {reqErr ? <Text style={styles.errText}>{reqErr}</Text> : null}
          <TouchableOpacity style={[styles.addBtn, submitting && styles.btnDisabled]} onPress={submitRequest} disabled={submitting}>
            {submitting ? <ActivityIndicator color={colors.navy} /> : <Text style={styles.addBtnText}>SEND REQUEST</Text>}
          </TouchableOpacity>
          <Text style={styles.hint}>{focName} will confirm or decline your request.</Text>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        <View style={styles.topbar}>
          <TouchableOpacity style={[styles.chipBtn, { marginRight: 12 }]} hitSlop={8}
            onPress={() => { H.tap(); navigation.dispatch(DrawerActions.openDrawer()); }}>
            <Text style={styles.chipBtnText}>☰</Text>
          </TouchableOpacity>
          <Text style={styles.pageTitle}>Appointments</Text>
        </View>

        {/* My appointments */}
        {myUpcoming.length > 0 && (
          <Card title="My Appointments" flat>
            {myUpcoming.map(a => {
              const st = STATUS_STYLE[a.status];
              return (
                <View key={a.id} style={styles.mineRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.rowTitle}>{a.type_label}</Text>
                    <Text style={styles.rowSub}>{formatDayLabel(new Date(a.starts_at))} · {formatTime(new Date(a.starts_at))}</Text>
                    <Text style={[styles.statusPill, { color: st.color }]}>{st.label}</Text>
                  </View>
                  <TouchableOpacity hitSlop={8} onPress={() => cancelMine(a)}><Text style={styles.cancelLink}>Cancel</Text></TouchableOpacity>
                </View>
              );
            })}
          </Card>
        )}

        {/* Not linked / closed states */}
        {!focId ? (
          <Card flat><Text style={styles.empty}>Link a Father of Confession from your home screen to request appointments.</Text></Card>
        ) : !consented ? (
          <Card flat><Text style={styles.empty}>Confirm sharing with {focName} to request appointments.</Text></Card>
        ) : !open ? (
          <Card flat><Text style={styles.empty}>{focName} isn't accepting appointment requests right now. Check back later.</Text></Card>
        ) : (
          <>
            {/* type filter */}
            {types.filter(t => t.active).length > 1 && (
              <View style={styles.filterRow}>
                <TouchableOpacity style={[styles.pill, !typeFilter && styles.pillActive]} onPress={() => setTypeFilter(null)}>
                  <Text style={[styles.pillText, !typeFilter && styles.pillTextActive]}>All</Text>
                </TouchableOpacity>
                {types.filter(t => t.active).map(t => (
                  <TouchableOpacity key={t.id} style={[styles.pill, typeFilter === t.id && styles.pillActive]} onPress={() => setTypeFilter(t.id)}>
                    <Text style={[styles.pillText, typeFilter === t.id && styles.pillTextActive]}>{t.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {months.length === 0 ? (
              <Card flat><Text style={styles.empty}>No open times in the year ahead. Check back later.</Text></Card>
            ) : months.map((month, mi) => (
              <View key={month.key}>
                <TouchableOpacity style={styles.monthHeader} onPress={() => { H.tap(); toggleMonth(month.key, mi); }} activeOpacity={0.8}>
                  <Text style={styles.monthLabel}>{month.label}</Text>
                  <Text style={styles.monthCount}>
                    {month.days.length} day{month.days.length !== 1 ? 's' : ''}
                  </Text>
                  <Text style={styles.monthChevron}>{monthOpen(month.key, mi) ? '⌄' : '›'}</Text>
                </TouchableOpacity>
                {monthOpen(month.key, mi) && month.days.map(day => (
                  <Card key={day.key} title={day.label} flat>
                    <View style={styles.slotWrap}>
                      {day.slots.map((s, i) => (
                        <TouchableOpacity key={i} style={styles.slot} onPress={() => { H.tap(); setPending(s); }}>
                          <Text style={styles.slotTime}>{formatTime(s.start)}</Text>
                          <Text style={styles.slotType}>{s.typeLabel} · {s.duration}m</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </Card>
                ))}
              </View>
            ))}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = lazyThemed(() => StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.navy },
  scroll: { flex: 1 },
  content: { padding: 20, paddingBottom: 48 },

  topbar: { flexDirection: 'row', alignItems: 'center', marginBottom: 18 },
  chipBtn: { width: 38, height: 38, borderRadius: 10, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface },
  chipBtnText: { fontSize: 18, color: colors.gold },
  pageTitle: { fontFamily: fonts.cormorantMedium, fontSize: 28, color: colors.cream },

  detailHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: 8, paddingBottom: 4 },
  back: { fontFamily: fonts.lato, fontSize: 14, color: colors.gold },

  empty: { fontFamily: fonts.latoLight, fontSize: 12, color: colors.muted, lineHeight: 18, paddingVertical: 4 },
  hint: { fontFamily: fonts.latoLight, fontSize: 11, color: colors.muted, marginTop: 12, textAlign: 'center', lineHeight: 16 },

  mineRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: colors.border },
  rowTitle: { fontFamily: fonts.latoBold, fontSize: 13, color: colors.cream },
  rowSub: { fontFamily: fonts.latoLight, fontSize: 11, color: colors.muted, marginTop: 1 },
  statusPill: { fontFamily: fonts.latoBold, fontSize: 10, letterSpacing: 0.4, marginTop: 4, textTransform: 'uppercase' },
  cancelLink: { fontFamily: fonts.lato, fontSize: 12, color: colors.red },

  filterRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 },
  pill: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: colors.border },
  pillActive: { backgroundColor: colors.goldDim, borderColor: colors.gold },
  pillText: { fontFamily: fonts.latoBold, fontSize: 11, color: colors.muted },
  pillTextActive: { color: colors.goldLight },

  monthHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12, paddingHorizontal: 4, borderBottomWidth: 1, borderBottomColor: colors.border, marginTop: 6 },
  monthLabel: { fontFamily: fonts.cormorantMedium, fontSize: 19, color: colors.cream, flex: 1 },
  monthCount: { fontFamily: fonts.latoLight, fontSize: 11, color: colors.muted },
  monthChevron: { fontSize: 16, color: colors.gold, width: 14, textAlign: 'center' },

  slotWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  slot: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10, borderWidth: 1, borderColor: colors.gold + '55', backgroundColor: colors.goldDim, alignItems: 'center', minWidth: 96 },
  slotTime: { fontFamily: fonts.latoBold, fontSize: 13, color: colors.goldLight },
  slotType: { fontFamily: fonts.latoLight, fontSize: 10, color: colors.muted, marginTop: 2 },

  confirmType: { fontFamily: fonts.cormorantMedium, fontSize: 20, color: colors.cream },
  confirmWhen: { fontFamily: fonts.latoBold, fontSize: 14, color: colors.gold, marginTop: 4 },
  confirmDur: { fontFamily: fonts.latoLight, fontSize: 12, color: colors.muted, marginTop: 4 },

  formLabel: { fontFamily: fonts.latoBold, fontSize: 10, letterSpacing: 1.5, textTransform: 'uppercase', color: colors.gold, opacity: 0.8, marginBottom: 8 },
  textarea: { backgroundColor: colors.panel, borderWidth: 1, borderColor: colors.border, borderRadius: 8, color: colors.cream, fontFamily: fonts.latoLight, fontSize: 13, padding: 12, minHeight: 80, textAlignVertical: 'top', lineHeight: 20 },
  errText: { fontFamily: fonts.latoLight, fontSize: 12, color: colors.red, marginTop: 10 },
  addBtn: { backgroundColor: colors.gold, borderRadius: 8, padding: 13, alignItems: 'center', marginTop: 16 },
  addBtnText: { fontFamily: fonts.latoBold, fontSize: 11, color: colors.navy, letterSpacing: 0.8 },
  btnDisabled: { opacity: 0.35 },
}));
