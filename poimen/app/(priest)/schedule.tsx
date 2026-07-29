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
import { useSession } from '@/lib/auth';
import { useDemoMode } from '@/lib/demo';
import { confirmDestructive } from '@/lib/confirm';
import * as H from '@/lib/haptics';
import * as db from '@/lib/db';
import type { AppointmentType, AvailabilityRuleRow, Appointment } from '@/lib/db';
import { WEEKDAYS, WEEKDAYS_SHORT, formatMinute, formatMinuteRange, formatTime, formatDayLabel } from '@/lib/scheduling/slots';

const DURATION_OPTS = [15, 30, 45, 60, 90];
const clampMin = (m: number) => Math.max(0, Math.min(1440, m));

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

  const load = useCallback(async () => {
    if (demoMode) {
      setOpen(true); setTypes(demoTypes()); setRules(demoRules()); setAppts(demoAppts());
      setNames(DEMO_NAMES); setRuleTypeId('dt-conf'); setLoading(false);
      return;
    }
    if (!user) return;
    setLoading(true);
    const [o, t, r, a, flock] = await Promise.all([
      db.getSchedulingOpen(user.id),
      db.getAppointmentTypes(user.id),
      db.getAvailabilityRules(user.id),
      db.getPriestAppointments(user.id),
      db.getFlock(user.id),
    ]);
    setOpen(o); setTypes(t); setRules(r); setAppts(a);
    setNames(Object.fromEntries(flock.map(m => [m.id, m.full_name ?? 'Member'])));
    if (!ruleTypeId && t.length) setRuleTypeId(t[0].id);
    setLoading(false);
  }, [demoMode, user, ruleTypeId]);

  useEffect(() => { load(); }, [demoMode, user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

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
              <View style={styles.stepperRow}>
                <TimeStepper label="Start" value={ruleStart} onChange={v => setRuleStart(clampMin(v))} />
                <TimeStepper label="End" value={ruleEnd} onChange={v => setRuleEnd(clampMin(v))} />
              </View>
              {ruleErr ? <Text style={styles.errText}>{ruleErr}</Text> : null}
              <TouchableOpacity style={styles.addBtn} onPress={addRule}>
                <Text style={styles.addBtnText}>ADD WINDOW</Text>
              </TouchableOpacity>
            </>
          )}
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

// ── Time stepper (−/+ 15 min) ────────────────────────────────
function TimeStepper({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <View style={styles.stepper}>
      <Text style={styles.stepperLabel}>{label}</Text>
      <View style={styles.stepperCtl}>
        <TouchableOpacity style={styles.stepBtn} onPress={() => { H.tap(); onChange(value - 15); }}><Text style={styles.stepBtnText}>−</Text></TouchableOpacity>
        <Text style={styles.stepperVal}>{formatMinute(value)}</Text>
        <TouchableOpacity style={styles.stepBtn} onPress={() => { H.tap(); onChange(value + 15); }}><Text style={styles.stepBtnText}>+</Text></TouchableOpacity>
      </View>
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

  stepperRow: { flexDirection: 'row', gap: 12, marginTop: 14 },
  stepper: { flex: 1 },
  stepperLabel: { fontFamily: fonts.latoBold, fontSize: 10, letterSpacing: 1, textTransform: 'uppercase', color: colors.muted, marginBottom: 6 },
  stepperCtl: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderColor: colors.border, borderRadius: 8, backgroundColor: colors.panel },
  stepBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  stepBtnText: { fontFamily: fonts.latoBold, fontSize: 20, color: colors.gold },
  stepperVal: { fontFamily: fonts.latoBold, fontSize: 13, color: colors.cream },

  errText: { fontFamily: fonts.latoLight, fontSize: 12, color: colors.red, marginTop: 10 },
  addBtn: { backgroundColor: colors.gold, borderRadius: 8, padding: 13, alignItems: 'center', marginTop: 16 },
  addBtnText: { fontFamily: fonts.latoBold, fontSize: 11, color: colors.navy, letterSpacing: 0.8 },
  btnDisabled: { opacity: 0.35 },
}));
