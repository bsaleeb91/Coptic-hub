// app/(priest)/schedule.tsx
// The priest's scheduling console: a master open/close switch, custom
// appointment types + durations, recurring weekly availability windows, and
// the inbox of pending requests to confirm or decline. All cloud-backed
// (lib/db/scheduling.ts); demo mode drives an in-memory copy for the preview.

import React, { useState, useEffect, useCallback } from 'react';
import { ScrollView, View, Text, StyleSheet, TouchableOpacity, TextInput, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from 'expo-router';
import { DrawerActions } from '@react-navigation/native';
import { colors, fonts, lazyThemed } from '@/lib/theme';
import { Card } from '@/components/ui/Card';
import ScrollPicker from '@/components/ui/ScrollPicker';
import { useSession } from '@/lib/auth';
import { useDemoMode } from '@/lib/demo';
import { confirmDestructive } from '@/lib/confirm';
import * as H from '@/lib/haptics';
import * as db from '@/lib/db';
import type { AppointmentType, AvailabilityRuleRow, Appointment, AvailabilityException } from '@/lib/db';
import {
  WEEKDAYS, WEEKDAYS_SHORT, formatMinute, formatMinuteRange, formatTime, formatDayLabel,
  monthCells, dateKey, closuresOn, isClosedAllDay, extraWindowsOn, SCHEDULE_HORIZON_DAYS,
} from '@/lib/scheduling/slots';

const DURATION_OPTS = [15, 30, 45, 60, 90];

// Quarter-hour times as picker labels. A window's start can be any time up to
// 11:45 PM and its end anything from 12:15 AM to midnight, so neither list ever
// offers a value that couldn't begin or end a window.
const SLIDER_STEP = 15;
const TIME_VALUES = Array.from({ length: 1440 / SLIDER_STEP + 1 }, (_, i) => i * SLIDER_STEP);
const TIME_LABELS = TIME_VALUES.map(formatMinute);
const START_OPTIONS = TIME_LABELS.slice(0, -1);   // 12:00 AM … 11:45 PM
const END_OPTIONS = TIME_LABELS.slice(1);         // 12:15 AM … midnight
// Labels are unique (1440 renders "midnight", not a second "12:00 AM"), so this
// round-trips exactly.
const minutesFor = (label: string) => TIME_VALUES[TIME_LABELS.indexOf(label)] ?? 0;

// How far ahead the availability calendar goes — the same year a member can
// book into, so there is no stretch of time he can request and the priest
// can't close.
const CALENDAR_MONTHS = Math.ceil(SCHEDULE_HORIZON_DAYS / 30);
const startOfMonth = (d: Date) => new Date(d.getFullYear(), d.getMonth(), 1);
const addMonths = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth() + n, 1);
const monthLabel = (d: Date) => d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

// ── Demo seed ────────────────────────────────────────────────
const demoTypes = (): AppointmentType[] => ([
  { id: 'dt-conf', priest_id: 'demo', label: 'Holy Confession', duration_minutes: 30, active: true, sort: 0, created_at: '' },
  { id: 'dt-visit', priest_id: 'demo', label: 'Home Visitation', duration_minutes: 60, active: true, sort: 1, created_at: '' },
  { id: 'dt-meet', priest_id: 'demo', label: 'Meeting', duration_minutes: 45, active: false, sort: 2, created_at: '' },
]);
const demoRules = (): AvailabilityRuleRow[] => ([
  { id: 'dr-1', priest_id: 'demo', type_id: 'dt-conf', weekday: 0, start_minute: 840, end_minute: 960, active: true, created_at: '' },
  { id: 'dr-2', priest_id: 'demo', type_id: 'dt-visit', weekday: 3, start_minute: 1080, end_minute: 1200, active: true, created_at: '' },
]);
const demoAppts = (): Appointment[] => {
  const soon = new Date(); soon.setDate(soon.getDate() + 3); soon.setHours(14, 0, 0, 0);
  const later = new Date(); later.setDate(later.getDate() + 5); later.setHours(18, 0, 0, 0);
  return [
    { id: 'da-1', priest_id: 'demo', congregant_id: 'demo-pb', type_id: 'dt-conf', type_label: 'Holy Confession', starts_at: soon.toISOString(), duration_minutes: 30, status: 'requested', note: 'Would like to confess before the feast.', created_at: '', updated_at: '' },
    { id: 'da-2', priest_id: 'demo', congregant_id: 'demo-sg', type_id: 'dt-visit', type_label: 'Home Visitation', starts_at: later.toISOString(), duration_minutes: 60, status: 'confirmed', note: null, created_at: '', updated_at: '' },
  ];
};
const demoExceptions = (): AvailabilityException[] => {
  const p = (n: number) => String(n).padStart(2, '0');
  const key = (offset: number) => {
    const d = new Date(); d.setDate(d.getDate() + offset);
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
  };
  return [
    { id: 'de-1', priest_id: 'demo', on_date: key(9), start_minute: null, end_minute: null, kind: 'block', type_id: null, note: 'Travelling', created_at: '' },
    { id: 'de-2', priest_id: 'demo', on_date: key(4), start_minute: 840, end_minute: 900, kind: 'block', type_id: null, note: null, created_at: '' },
  ];
};
const DEMO_NAMES: Record<string, string> = {
  'demo-pb': 'Peter Botros', 'demo-sg': 'Sara Girgis', 'demo-mh': 'Michael Hanna', 'demo-mm': 'Mary Mikhail',
};

export default function ScheduleScreen() {
  const navigation = useNavigation();
  const { user } = useSession();
  const { demoMode } = useDemoMode();

  const [loading, setLoading] = useState(!demoMode);
  const [open, setOpen] = useState(false);
  const [types, setTypes] = useState<AppointmentType[]>([]);
  const [rules, setRules] = useState<AvailabilityRuleRow[]>([]);
  const [appts, setAppts] = useState<Appointment[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});

  // Add-type form
  const [newTypeLabel, setNewTypeLabel] = useState('');
  const [newTypeDur, setNewTypeDur] = useState(30);
  // Add-rule form
  const [ruleTypeId, setRuleTypeId] = useState<string | null>(null);
  const [ruleWeekday, setRuleWeekday] = useState(0);
  const [ruleStart, setRuleStart] = useState(840);   // 2:00 PM
  const [ruleEnd, setRuleEnd] = useState(960);        // 4:00 PM
  const [ruleErr, setRuleErr] = useState('');

  // Date-specific exceptions: the year-ahead calendar, the day being edited,
  // and the window for a partial closure.
  const [exceptions, setExceptions] = useState<AvailabilityException[]>([]);
  const [calMonth, setCalMonth] = useState<Date>(() => startOfMonth(new Date()));
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
  const [exStart, setExStart] = useState(540);        // 9:00 AM
  const [exEnd, setExEnd] = useState(720);            // 12:00 PM
  const [exErr, setExErr] = useState('');
  // Extra hours opened on a single date, over the weekly pattern.
  const [addTypeId, setAddTypeId] = useState<string | null>(null);
  const [addStart, setAddStart] = useState(1080);     // 6:00 PM
  const [addEnd, setAddEnd] = useState(1200);         // 8:00 PM
  const [addErr, setAddErr] = useState('');

  const load = useCallback(async () => {
    if (demoMode) {
      setOpen(true); setTypes(demoTypes()); setRules(demoRules()); setAppts(demoAppts());
      setNames(DEMO_NAMES); setRuleTypeId('dt-conf'); setExceptions(demoExceptions()); setLoading(false);
      return;
    }
    if (!user) return;
    setLoading(true);
    const [o, t, r, a, flock, ex] = await Promise.all([
      db.getSchedulingOpen(user.id),
      db.getAppointmentTypes(user.id),
      db.getAvailabilityRules(user.id),
      db.getPriestAppointments(user.id),
      db.getFlock(user.id),
      db.getAvailabilityExceptions(user.id),
    ]);
    setOpen(o); setTypes(t); setRules(r); setAppts(a); setExceptions(ex);
    setNames(Object.fromEntries(flock.map(m => [m.id, m.full_name ?? 'Member'])));
    if (!ruleTypeId && t.length) setRuleTypeId(t[0].id);
    setLoading(false);
  }, [demoMode, user, ruleTypeId]);

  useEffect(() => { load(); }, [demoMode, user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // A "from" that reaches or passes its "to" pushes the end ahead of it, so a
  // range can never invert while you drag. The gap is preserved where the day
  // still has room for it, and never shrinks below one step.
  const moveFrom = (v: number, end: number, setStart: (n: number) => void, setEnd: (n: number) => void) => {
    setStart(v);
    if (end > v) return;
    setEnd(Math.min(1440, v + SLIDER_STEP));
  };
  const moveTo = (v: number, start: number, setEnd: (n: number) => void) =>
    setEnd(Math.max(v, Math.min(1440, start + SLIDER_STEP)));

  const memberName = (id: string) => names[id] ?? 'Member';
  const typeLabel = (id: string | null) => types.find(t => t.id === id)?.label ?? '';

  // ── Master switch ──
  async function toggleOpen() {
    H.tap();
    const next = !open;
    setOpen(next);
    if (!demoMode && user) { const { error } = await db.setSchedulingOpen(user.id, next); if (error) setOpen(!next); }
  }

  // ── Types ──
  async function addType() {
    const label = newTypeLabel.trim();
    if (!label) return;
    H.tap();
    if (demoMode) {
      setTypes(p => [...p, { id: `dt-${Date.now()}`, priest_id: 'demo', label, duration_minutes: newTypeDur, active: true, sort: p.length, created_at: '' }]);
    } else if (user) {
      await db.createAppointmentType(user.id, { label, duration_minutes: newTypeDur, sort: types.length });
      await load();
    }
    setNewTypeLabel(''); setNewTypeDur(30);
  }
  async function toggleType(t: AppointmentType) {
    H.tap();
    setTypes(p => p.map(x => x.id === t.id ? { ...x, active: !x.active } : x));
    if (!demoMode) await db.updateAppointmentType(t.id, { active: !t.active });
  }
  function removeType(t: AppointmentType) {
    confirmDestructive('Delete type', `Remove "${t.label}"? Existing appointments keep their label.`, 'Delete', async () => {
      setTypes(p => p.filter(x => x.id !== t.id));
      setRules(p => p.filter(x => x.type_id !== t.id));
      if (ruleTypeId === t.id) setRuleTypeId(null);
      if (!demoMode) await db.deleteAppointmentType(t.id);
    });
  }

  // ── Rules ──
  async function addRule() {
    setRuleErr('');
    if (!ruleTypeId) { setRuleErr('Pick an appointment type first.'); return; }
    if (ruleEnd <= ruleStart) { setRuleErr('End time must be after the start time.'); return; }
    H.tap();
    if (demoMode) {
      setRules(p => [...p, { id: `dr-${Date.now()}`, priest_id: 'demo', type_id: ruleTypeId, weekday: ruleWeekday, start_minute: ruleStart, end_minute: ruleEnd, active: true, created_at: '' }]);
    } else if (user) {
      await db.createAvailabilityRule(user.id, { type_id: ruleTypeId, weekday: ruleWeekday, start_minute: ruleStart, end_minute: ruleEnd });
      await load();
    }
  }
  async function toggleRule(r: AvailabilityRuleRow) {
    H.tap();
    setRules(p => p.map(x => x.id === r.id ? { ...x, active: !x.active } : x));
    if (!demoMode) await db.updateAvailabilityRule(r.id, { active: !r.active });
  }
  function removeRule(r: AvailabilityRuleRow) {
    confirmDestructive('Delete window', `Remove ${WEEKDAYS[r.weekday]} ${formatMinuteRange(r.start_minute, r.end_minute)}?`, 'Delete', async () => {
      setRules(p => p.filter(x => x.id !== r.id));
      if (!demoMode) await db.deleteAvailabilityRule(r.id);
    });
  }

  // ── Date exceptions ──
  // Each of these applies optimistically, then reconciles. A failed write puts
  // the previous state back and says so, rather than leaving the priest looking
  // at a closure that was never saved — the case that matters, because a day he
  // believes is closed is a day members can still book.
  //
  // Re-reading only the exceptions (not the full load()) keeps `loading` false,
  // so the screen isn't torn down and scrolled back to the top after every tap.
  async function refreshExceptions() {
    if (demoMode || !user) return;
    setExceptions(await db.getAvailabilityExceptions(user.id));
  }

  const failed = (msg: string | null, revert: AvailabilityException[]) => {
    setExceptions(revert);
    setExErr(msg ?? 'Could not save that — check your connection and try again.');
  };

  // Closing the whole day supersedes any partial closures on it. The all-day row
  // goes in FIRST and the partials are cleared after: deleting first meant a
  // failed insert (no signal, or this migration not yet applied) destroyed the
  // existing closures AND created nothing, leaving the day wide open in silence.
  async function closeWholeDay(date: Date) {
    H.tap();
    setExErr('');
    const on_date = dateKey(date);
    const before = exceptions;
    const row: AvailabilityException = {
      id: `de-${Date.now()}`, priest_id: user?.id ?? 'demo', on_date,
      start_minute: null, end_minute: null, kind: 'block', type_id: null, note: null, created_at: '',
    };
    // Drop this date's CLOSURES only — extra hours opened on it are a separate
    // thing and the server keeps them, so the optimistic state must too.
    setExceptions(p => [...p.filter(e => e.on_date !== on_date || e.kind === 'open'), row]);
    if (demoMode || !user) return;
    const { error } = await db.createAvailabilityException(user.id, { on_date });
    if (error) return failed(error, before);
    await db.clearPartialExceptions(user.id, on_date);   // tidy-up; harmless if it fails
    await refreshExceptions();
  }

  async function closePartOfDay(date: Date) {
    setExErr('');
    if (exEnd <= exStart) { setExErr('End time must be after the start time.'); return; }
    if (isClosedAllDay(exceptions, date)) { setExErr('That day is already closed entirely.'); return; }
    H.tap();
    const on_date = dateKey(date);
    const before = exceptions;
    const row: AvailabilityException = {
      id: `de-${Date.now()}`, priest_id: user?.id ?? 'demo', on_date,
      start_minute: exStart, end_minute: exEnd, kind: 'block', type_id: null, note: null, created_at: '',
    };
    setExceptions(p => [...p, row]);
    if (demoMode || !user) return;
    const { error } = await db.createAvailabilityException(user.id, { on_date, start_minute: exStart, end_minute: exEnd });
    if (error) return failed(error, before);
    await refreshExceptions();
  }

  async function reopenDay(date: Date) {
    H.tap();
    setExErr('');
    const on_date = dateKey(date);
    const before = exceptions;
    // Reopening lifts the closures; extra hours on the date stay put.
    setExceptions(p => p.filter(e => e.on_date !== on_date || e.kind === 'open'));
    if (demoMode || !user) return;
    const { error } = await db.clearAvailabilityExceptions(user.id, on_date);
    if (error) return failed(error, before);
    await refreshExceptions();
  }

  // Extra hours on one date — the mirror of a closure: hours the weekly pattern
  // doesn't offer, added for this date alone.
  async function openExtraHours(date: Date) {
    setAddErr('');
    const typeId = addTypeId ?? activeTypes[0]?.id ?? null;
    if (!typeId) { setAddErr('Add an active appointment type first.'); return; }
    if (addEnd <= addStart) { setAddErr('End time must be after the start time.'); return; }
    if (isClosedAllDay(exceptions, date)) { setAddErr('That day is closed — reopen it first.'); return; }
    H.tap();
    const on_date = dateKey(date);
    const before = exceptions;
    const row: AvailabilityException = {
      id: `de-${Date.now()}`, priest_id: user?.id ?? 'demo', on_date,
      start_minute: addStart, end_minute: addEnd, kind: 'open', type_id: typeId, note: null, created_at: '',
    };
    setExceptions(p => [...p, row]);
    if (demoMode || !user) return;
    const { error } = await db.createExtraHours(user.id, { on_date, type_id: typeId, start_minute: addStart, end_minute: addEnd });
    if (error) { setExceptions(before); setAddErr(error); return; }
    await refreshExceptions();
  }

  async function removeException(ex: AvailabilityException) {
    H.tap();
    setExErr('');
    const before = exceptions;
    setExceptions(p => p.filter(e => e.id !== ex.id));
    if (demoMode || !user) return;
    const { error } = await db.deleteAvailabilityException(ex.id);
    if (error) return failed(error, before);
    await refreshExceptions();
  }

  // Does the recurring schedule offer anything on this weekday at all? Days it
  // never covers are dimmed — there is nothing there to close.
  const weekdayHasAvailability = (date: Date) =>
    rules.some(r => r.active && r.weekday === date.getDay()
      && types.some(t => t.id === r.type_id && t.active));

  // ── Requests ──
  async function respond(a: Appointment, confirm: boolean) {
    H.tap();
    setAppts(p => p.map(x => x.id === a.id ? { ...x, status: confirm ? 'confirmed' : 'declined' } : x));
    if (!demoMode) await db.respondAppointment(a.id, confirm);
  }
  function cancelAppt(a: Appointment) {
    confirmDestructive('Cancel appointment', `Cancel the ${a.type_label} with ${memberName(a.congregant_id)}?`, 'Cancel it', async () => {
      setAppts(p => p.map(x => x.id === a.id ? { ...x, status: 'cancelled' } : x));
      if (!demoMode) await db.cancelAppointment(a.id);
    });
  }

  const todayKey = dateKey(new Date());
  const firstMonth = startOfMonth(new Date());
  const lastMonth = addMonths(firstMonth, CALENDAR_MONTHS - 1);
  const canGoBack = calMonth > firstMonth;
  const canGoForward = calMonth < lastMonth;
  const activeTypes = types.filter(t => t.active);
  const onSelectedDay = selectedDay
    ? exceptions.filter(e => e.on_date === dateKey(selectedDay)).sort((a, b) => (a.start_minute ?? -1) - (b.start_minute ?? -1))
    : [];
  const selectedDayClosures = onSelectedDay.filter(e => e.kind !== 'open');
  const selectedDayExtras = onSelectedDay.filter(e => e.kind === 'open');

  const nowMs = Date.now();
  const pending = appts.filter(a => a.status === 'requested').sort((a, b) => a.starts_at.localeCompare(b.starts_at));
  const upcoming = appts.filter(a => a.status === 'confirmed' && new Date(a.starts_at).getTime() >= nowMs)
    .sort((a, b) => a.starts_at.localeCompare(b.starts_at));

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <ActivityIndicator color={colors.gold} style={{ marginTop: 80 }} />
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
          <Text style={styles.pageTitle}>Schedule</Text>
        </View>

        {/* Master switch */}
        <TouchableOpacity activeOpacity={0.8} onPress={toggleOpen} style={[styles.masterCard, open ? styles.masterOn : styles.masterOff]}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.masterTitle, { color: open ? colors.green : colors.muted }]}>
              {open ? '● Accepting appointments' : '○ Scheduling closed'}
            </Text>
            <Text style={styles.masterSub}>
              {open ? 'Members can request open time slots. Tap to close.' : 'Members cannot request appointments. Tap to open.'}
            </Text>
          </View>
        </TouchableOpacity>

        {/* Pending requests */}
        <Card title={`Requests (${pending.length})`} flat>
          {pending.length === 0 ? (
            <Text style={styles.empty}>No pending requests.</Text>
          ) : pending.map(a => (
            <View key={a.id} style={styles.reqRow}>
              <View style={styles.reqTop}>
                <Text style={styles.reqName}>{memberName(a.congregant_id)}</Text>
                <Text style={styles.reqType}>{a.type_label} · {a.duration_minutes}m</Text>
              </View>
              <Text style={styles.reqWhen}>{formatDayLabel(new Date(a.starts_at))} · {formatTime(new Date(a.starts_at))}</Text>
              {a.note ? <Text style={styles.reqNote}>“{a.note}”</Text> : null}
              <View style={styles.reqBtns}>
                <TouchableOpacity style={[styles.smallBtn, styles.confirmBtn]} onPress={() => respond(a, true)}>
                  <Text style={styles.confirmText}>✓ Confirm</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.smallBtn, styles.declineBtn]} onPress={() => respond(a, false)}>
                  <Text style={styles.declineText}>✕ Decline</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </Card>

        {/* Upcoming confirmed */}
        {upcoming.length > 0 && (
          <Card title={`Upcoming (${upcoming.length})`} flat>
            {upcoming.map(a => (
              <View key={a.id} style={styles.upRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.reqName}>{memberName(a.congregant_id)}</Text>
                  <Text style={styles.reqWhen}>{a.type_label} · {formatDayLabel(new Date(a.starts_at))} · {formatTime(new Date(a.starts_at))}</Text>
                </View>
                <TouchableOpacity hitSlop={8} onPress={() => cancelAppt(a)}><Text style={styles.cancelLink}>Cancel</Text></TouchableOpacity>
              </View>
            ))}
          </Card>
        )}

        {/* Appointment types */}
        <Card title="Appointment Types" titleIcon="✦">
          {types.length === 0 ? (
            <Text style={styles.empty}>Add the kinds of appointments you offer and how long each takes.</Text>
          ) : types.map(t => (
            <View key={t.id} style={styles.listRow}>
              <TouchableOpacity onPress={() => toggleType(t)} style={styles.activePill}>
                <Text style={[styles.activePillText, { color: t.active ? colors.green : colors.faint }]}>{t.active ? 'ON' : 'OFF'}</Text>
              </TouchableOpacity>
              <View style={{ flex: 1 }}>
                <Text style={[styles.rowTitle, !t.active && { color: colors.muted }]}>{t.label}</Text>
                <Text style={styles.rowSub}>{t.duration_minutes} minutes</Text>
              </View>
              <TouchableOpacity hitSlop={8} onPress={() => removeType(t)}><Text style={styles.removeX}>✕</Text></TouchableOpacity>
            </View>
          ))}
          <View style={styles.divider} />
          <Text style={styles.formLabel}>NEW TYPE</Text>
          <TextInput style={styles.input} placeholder="e.g. Spiritual Counseling" placeholderTextColor={colors.faint} value={newTypeLabel} onChangeText={setNewTypeLabel} />
          <Text style={[styles.formLabel, { marginTop: 12 }]}>LENGTH</Text>
          <View style={styles.pillRow}>
            {DURATION_OPTS.map(d => (
              <TouchableOpacity key={d} style={[styles.pill, newTypeDur === d && styles.pillActive]} onPress={() => setNewTypeDur(d)}>
                <Text style={[styles.pillText, newTypeDur === d && styles.pillTextActive]}>{d}m</Text>
              </TouchableOpacity>
            ))}
          </View>
          <TouchableOpacity style={[styles.addBtn, !newTypeLabel.trim() && styles.btnDisabled]} onPress={addType} disabled={!newTypeLabel.trim()}>
            <Text style={styles.addBtnText}>ADD TYPE</Text>
          </TouchableOpacity>
        </Card>

        {/* Weekly availability */}
        <Card title="Weekly Availability" titleIcon="◷">
          {rules.length === 0 ? (
            <Text style={styles.empty}>Add recurring weekly windows. They repeat every week until you remove them.</Text>
          ) : rules.map(r => (
            <View key={r.id} style={styles.listRow}>
              <TouchableOpacity onPress={() => toggleRule(r)} style={styles.activePill}>
                <Text style={[styles.activePillText, { color: r.active ? colors.green : colors.faint }]}>{r.active ? 'ON' : 'OFF'}</Text>
              </TouchableOpacity>
              <View style={{ flex: 1 }}>
                <Text style={[styles.rowTitle, !r.active && { color: colors.muted }]}>{WEEKDAYS[r.weekday]}</Text>
                <Text style={styles.rowSub}>{formatMinuteRange(r.start_minute, r.end_minute)} · {typeLabel(r.type_id)}</Text>
              </View>
              <TouchableOpacity hitSlop={8} onPress={() => removeRule(r)}><Text style={styles.removeX}>✕</Text></TouchableOpacity>
            </View>
          ))}
          <View style={styles.divider} />
          <Text style={styles.formLabel}>NEW WINDOW</Text>
          {types.filter(t => t.active).length === 0 ? (
            <Text style={styles.hint}>Add an active appointment type above first.</Text>
          ) : (
            <>
              <View style={styles.pillRow}>
                {types.filter(t => t.active).map(t => (
                  <TouchableOpacity key={t.id} style={[styles.pill, ruleTypeId === t.id && styles.pillActive]} onPress={() => setRuleTypeId(t.id)}>
                    <Text style={[styles.pillText, ruleTypeId === t.id && styles.pillTextActive]}>{t.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <View style={styles.weekdayRow}>
                {WEEKDAYS_SHORT.map((w, i) => (
                  <TouchableOpacity key={i} style={[styles.dayPill, ruleWeekday === i && styles.pillActive]} onPress={() => setRuleWeekday(i)}>
                    <Text style={[styles.pillText, ruleWeekday === i && styles.pillTextActive]}>{w}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <View style={styles.pickerGroup}>
                <TimePicker label="Start" options={START_OPTIONS} value={ruleStart} onChange={v => moveFrom(v, ruleEnd, setRuleStart, setRuleEnd)} />
                <TimePicker label="End" options={END_OPTIONS} value={ruleEnd} onChange={v => moveTo(v, ruleStart, setRuleEnd)} />
              </View>
              {ruleErr ? <Text style={styles.errText}>{ruleErr}</Text> : null}
              <TouchableOpacity style={styles.addBtn} onPress={addRule}>
                <Text style={styles.addBtnText}>ADD WINDOW</Text>
              </TouchableOpacity>
            </>
          )}
        </Card>

        {/* Date exceptions — one-off closures over the recurring schedule */}
        <Card title="Days Away & Extra Hours" titleIcon="⊘">
          <Text style={styles.empty}>
            Change a single date without touching your weekly pattern. Close a day, or
            part of one, when you're travelling or otherwise unavailable — or open extra
            hours on a date your weekly pattern doesn't cover.
          </Text>

          <View style={styles.monthNav}>
            <TouchableOpacity
              style={[styles.navBtn, !canGoBack && styles.btnDisabled]}
              disabled={!canGoBack}
              onPress={() => { H.tap(); setSelectedDay(null); setCalMonth(m => addMonths(m, -1)); }}
              hitSlop={8}
            >
              <Text style={styles.navBtnText}>‹</Text>
            </TouchableOpacity>
            <Text style={styles.monthTitle}>{monthLabel(calMonth)}</Text>
            <TouchableOpacity
              style={[styles.navBtn, !canGoForward && styles.btnDisabled]}
              disabled={!canGoForward}
              onPress={() => { H.tap(); setSelectedDay(null); setCalMonth(m => addMonths(m, 1)); }}
              hitSlop={8}
            >
              <Text style={styles.navBtnText}>›</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.calHeadRow}>
            {WEEKDAYS_SHORT.map(w => (
              <Text key={w} style={styles.calHead}>{w[0]}</Text>
            ))}
          </View>
          <View style={styles.calGrid}>
            {monthCells(calMonth.getFullYear(), calMonth.getMonth()).map((d, i) => {
              if (!d) return <View key={`pad-${i}`} style={styles.calCell} />;
              const past = dateKey(d) < todayKey;
              const allDay = isClosedAllDay(exceptions, d);
              const partial = !allDay && closuresOn(exceptions, d).length > 0;
              const extra = !allDay && extraWindowsOn(exceptions, d).length > 0;
              const available = weekdayHasAvailability(d);
              const sel = selectedDay != null && dateKey(selectedDay) === dateKey(d);
              return (
                <TouchableOpacity
                  key={dateKey(d)}
                  style={[
                    styles.calCell,
                    available && !past && styles.calCellAvail,
                    extra && !past && styles.calCellExtra,
                    allDay && styles.calCellClosed,
                    partial && styles.calCellPartial,
                    sel && styles.calCellSelected,
                  ]}
                  disabled={past}
                  activeOpacity={0.8}
                  onPress={() => { H.tap(); setExErr(''); setSelectedDay(sel ? null : d); }}
                >
                  <Text style={[
                    styles.calCellText,
                    past && styles.calCellTextPast,
                    allDay && styles.calCellTextClosed,
                  ]}>{d.getDate()}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
          <View style={styles.legendRow}>
            <View style={[styles.legendSwatch, styles.calCellAvail]} /><Text style={styles.legendText}>open</Text>
            <View style={[styles.legendSwatch, styles.calCellExtra]} /><Text style={styles.legendText}>extra hours</Text>
            <View style={[styles.legendSwatch, styles.calCellPartial]} /><Text style={styles.legendText}>partly closed</Text>
            <View style={[styles.legendSwatch, styles.calCellClosed]} /><Text style={styles.legendText}>closed</Text>
          </View>

          {selectedDay && (
            <View style={styles.dayPanel}>
              <Text style={styles.dayPanelTitle}>
                {selectedDay.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
              </Text>
              {!weekdayHasAvailability(selectedDay) && selectedDayExtras.length === 0 && (
                <Text style={styles.hint}>
                  Nothing recurring on this weekday — there's nothing to close, but you can open extra hours below.
                </Text>
              )}

              {selectedDayClosures.length > 0 && (
                <>
                  {selectedDayClosures.map(ex => (
                    <View key={ex.id} style={styles.listRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.rowTitle}>
                          {ex.start_minute == null ? 'Closed all day' : `Closed ${formatMinuteRange(ex.start_minute!, ex.end_minute!)}`}
                        </Text>
                        {ex.note ? <Text style={styles.rowSub}>{ex.note}</Text> : null}
                      </View>
                      <TouchableOpacity hitSlop={8} onPress={() => removeException(ex)}>
                        <Text style={styles.removeX}>✕</Text>
                      </TouchableOpacity>
                    </View>
                  ))}
                  <TouchableOpacity style={styles.reopenBtn} onPress={() => reopenDay(selectedDay)}>
                    <Text style={styles.reopenBtnText}>REOPEN THIS DAY</Text>
                  </TouchableOpacity>
                </>
              )}

              {!isClosedAllDay(exceptions, selectedDay) && (
                <>
                  <TouchableOpacity style={styles.closeDayBtn} onPress={() => closeWholeDay(selectedDay)}>
                    <Text style={styles.closeDayBtnText}>CLOSE THE WHOLE DAY</Text>
                  </TouchableOpacity>
                  <Text style={[styles.formLabel, { marginTop: 14 }]}>OR CLOSE PART OF IT</Text>
                  <View style={styles.pickerGroup}>
                    <TimePicker label="From" options={START_OPTIONS} value={exStart} onChange={v => moveFrom(v, exEnd, setExStart, setExEnd)} />
                    <TimePicker label="To" options={END_OPTIONS} value={exEnd} onChange={v => moveTo(v, exStart, setExEnd)} />
                  </View>
                  {exErr ? <Text style={styles.errText}>{exErr}</Text> : null}
                  <TouchableOpacity style={styles.addBtn} onPress={() => closePartOfDay(selectedDay)}>
                    <Text style={styles.addBtnText}>CLOSE THIS TIME</Text>
                  </TouchableOpacity>
                </>
              )}

              {/* Extra hours — the other direction: time this date offers that
                  the weekly pattern doesn't. */}
              <View style={styles.divider} />
              {selectedDayExtras.map(ex => (
                <View key={ex.id} style={styles.listRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.rowTitleExtra}>
                      + Extra {formatMinuteRange(ex.start_minute!, ex.end_minute!)}
                    </Text>
                    <Text style={styles.rowSub}>{typeLabel(ex.type_id)}</Text>
                  </View>
                  <TouchableOpacity hitSlop={8} onPress={() => removeException(ex)}>
                    <Text style={styles.removeX}>✕</Text>
                  </TouchableOpacity>
                </View>
              ))}

              {isClosedAllDay(exceptions, selectedDay) ? (
                <Text style={styles.hint}>This day is closed — reopen it to add extra hours.</Text>
              ) : activeTypes.length === 0 ? (
                <Text style={styles.hint}>Add an active appointment type above to open extra hours.</Text>
              ) : (
                <>
                  <Text style={styles.formLabel}>OPEN EXTRA HOURS</Text>
                  <View style={styles.pillRow}>
                    {activeTypes.map(t => {
                      const on = (addTypeId ?? activeTypes[0].id) === t.id;
                      return (
                        <TouchableOpacity key={t.id} style={[styles.pill, on && styles.pillActive]} onPress={() => { H.tap(); setAddTypeId(t.id); }}>
                          <Text style={[styles.pillText, on && styles.pillTextActive]}>{t.label}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                  <View style={styles.pickerGroup}>
                    <TimePicker label="From" options={START_OPTIONS} value={addStart} onChange={v => moveFrom(v, addEnd, setAddStart, setAddEnd)} />
                    <TimePicker label="To" options={END_OPTIONS} value={addEnd} onChange={v => moveTo(v, addStart, setAddEnd)} />
                  </View>
                  {addErr ? <Text style={styles.errText}>{addErr}</Text> : null}
                  <TouchableOpacity style={styles.openHoursBtn} onPress={() => openExtraHours(selectedDay)}>
                    <Text style={styles.openHoursBtnText}>OPEN THIS TIME</Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
          )}
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

// ── Time picker ──────────────────────────────────────────────
// Stepping a whole afternoon 15 minutes at a time took dozens of taps, so times
// are scrolled instead — the same snap-scrolling picker used for "fast until"
// in the canon builder and new-cards-per-day in Psalms.
function TimePicker({ label, value, onChange, options }: {
  label: string; value: number; onChange: (v: number) => void; options: string[];
}) {
  return (
    <View style={styles.picker}>
      <Text style={styles.pickerLabel}>{label}</Text>
      <ScrollPicker
        options={options}
        value={formatMinute(value)}
        onChange={s => onChange(minutesFor(s))}
      />
    </View>
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

  masterCard: { flexDirection: 'row', alignItems: 'center', padding: 16, borderRadius: 12, borderWidth: 1, marginBottom: 16 },
  masterOn: { backgroundColor: colors.greenBg, borderColor: colors.green },
  masterOff: { backgroundColor: colors.surface, borderColor: colors.border },
  masterTitle: { fontFamily: fonts.latoBold, fontSize: 15, marginBottom: 3 },
  masterSub: { fontFamily: fonts.latoLight, fontSize: 11, color: colors.muted, lineHeight: 16 },

  empty: { fontFamily: fonts.latoLight, fontSize: 12, color: colors.muted, lineHeight: 18, paddingVertical: 4 },
  hint: { fontFamily: fonts.latoLight, fontSize: 12, color: colors.muted, lineHeight: 18 },

  // request rows
  reqRow: { paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.border },
  reqTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: 10 },
  reqName: { fontFamily: fonts.latoBold, fontSize: 14, color: colors.cream },
  reqType: { fontFamily: fonts.latoLight, fontSize: 11, color: colors.gold },
  reqWhen: { fontFamily: fonts.lato, fontSize: 12, color: colors.muted, marginTop: 2 },
  reqNote: { fontFamily: fonts.latoLight, fontSize: 12, color: colors.muted, fontStyle: 'italic', marginTop: 4 },
  reqBtns: { flexDirection: 'row', gap: 8, marginTop: 10 },
  smallBtn: { flex: 1, paddingVertical: 9, borderRadius: 8, alignItems: 'center', borderWidth: 1 },
  confirmBtn: { backgroundColor: colors.greenBg, borderColor: colors.green },
  confirmText: { fontFamily: fonts.latoBold, fontSize: 12, color: colors.green },
  declineBtn: { backgroundColor: 'rgba(192,57,43,0.15)', borderColor: colors.red },
  declineText: { fontFamily: fonts.latoBold, fontSize: 12, color: colors.red },

  upRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.border },
  cancelLink: { fontFamily: fonts.lato, fontSize: 12, color: colors.red },

  // generic list rows
  listRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.border },
  activePill: { width: 40, height: 26, borderRadius: 13, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.panel },
  activePillText: { fontFamily: fonts.latoBold, fontSize: 10, letterSpacing: 0.5 },
  rowTitle: { fontFamily: fonts.latoBold, fontSize: 13, color: colors.cream },
  rowSub: { fontFamily: fonts.latoLight, fontSize: 11, color: colors.muted, marginTop: 1 },
  removeX: { fontFamily: fonts.latoBold, fontSize: 14, color: colors.red, paddingHorizontal: 4 },

  divider: { height: 1, backgroundColor: colors.border, marginVertical: 14 },
  formLabel: { fontFamily: fonts.latoBold, fontSize: 10, letterSpacing: 1.5, textTransform: 'uppercase', color: colors.gold, opacity: 0.8, marginBottom: 8 },
  input: { backgroundColor: colors.panel, borderWidth: 1, borderColor: colors.border, borderRadius: 8, color: colors.cream, fontFamily: fonts.latoLight, fontSize: 13, padding: 12 },

  pillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pill: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: colors.border },
  pillActive: { backgroundColor: colors.goldDim, borderColor: colors.gold },
  pillText: { fontFamily: fonts.latoBold, fontSize: 11, color: colors.muted },
  pillTextActive: { color: colors.goldLight },

  weekdayRow: { flexDirection: 'row', gap: 6, marginTop: 10 },
  dayPill: { flex: 1, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: colors.border, alignItems: 'center' },

  pickerGroup: { marginTop: 14 },
  picker: { marginBottom: 6 },
  pickerLabel: { fontFamily: fonts.latoBold, fontSize: 10, letterSpacing: 1, textTransform: 'uppercase', color: colors.muted, marginBottom: 2 },

  errText: { fontFamily: fonts.latoLight, fontSize: 12, color: colors.red, marginTop: 10 },
  addBtn: { backgroundColor: colors.gold, borderRadius: 8, padding: 13, alignItems: 'center', marginTop: 16 },
  addBtnText: { fontFamily: fonts.latoBold, fontSize: 11, color: colors.navy, letterSpacing: 0.8 },
  btnDisabled: { opacity: 0.35 },

  // ── Days Away calendar ──
  monthNav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 16, marginBottom: 10 },
  navBtn: { width: 34, height: 34, borderRadius: 8, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface },
  navBtnText: { fontSize: 18, color: colors.gold, lineHeight: 20 },
  monthTitle: { fontFamily: fonts.cormorantMedium, fontSize: 19, color: colors.cream },

  calHeadRow: { flexDirection: 'row' },
  calHead: { flex: 1, textAlign: 'center', fontFamily: fonts.latoBold, fontSize: 10, color: colors.muted, paddingBottom: 6 },
  calGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  calCell: { width: `${100 / 7}%`, aspectRatio: 1, alignItems: 'center', justifyContent: 'center', borderRadius: 8, borderWidth: 1, borderColor: 'transparent' },
  calCellAvail: { backgroundColor: colors.goldDim, borderColor: colors.gold + '55' },
  calCellExtra: { backgroundColor: colors.greenBg, borderColor: colors.green },
  calCellPartial: { backgroundColor: 'rgba(196,130,26,0.22)', borderColor: '#C4821A' },
  calCellClosed: { backgroundColor: colors.surface, borderColor: colors.red + '77' },
  calCellSelected: { borderColor: colors.cream, borderWidth: 2 },
  calCellText: { fontFamily: fonts.lato, fontSize: 13, color: colors.cream },
  calCellTextPast: { color: colors.faint },
  calCellTextClosed: { color: colors.red, textDecorationLine: 'line-through' },

  legendRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6, marginTop: 12 },
  legendSwatch: { width: 12, height: 12, borderRadius: 3, borderWidth: 1 },
  legendText: { fontFamily: fonts.latoLight, fontSize: 10, color: colors.muted, marginRight: 8 },

  dayPanel: { marginTop: 16, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 14 },
  dayPanelTitle: { fontFamily: fonts.cormorantMedium, fontSize: 18, color: colors.cream, marginBottom: 10 },
  closeDayBtn: { borderWidth: 1, borderColor: colors.red + '88', borderRadius: 8, padding: 13, alignItems: 'center', marginTop: 12 },
  closeDayBtnText: { fontFamily: fonts.latoBold, fontSize: 11, color: colors.red, letterSpacing: 0.8 },
  reopenBtn: { borderWidth: 1, borderColor: colors.green, borderRadius: 8, padding: 13, alignItems: 'center', marginTop: 12 },
  reopenBtnText: { fontFamily: fonts.latoBold, fontSize: 11, color: colors.green, letterSpacing: 0.8 },
  openHoursBtn: { backgroundColor: colors.greenBg, borderWidth: 1, borderColor: colors.green, borderRadius: 8, padding: 13, alignItems: 'center', marginTop: 16 },
  openHoursBtnText: { fontFamily: fonts.latoBold, fontSize: 11, color: colors.green, letterSpacing: 0.8 },
  rowTitleExtra: { fontFamily: fonts.latoBold, fontSize: 13, color: colors.green },
}));
