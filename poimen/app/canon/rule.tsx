// app/canon/rule.tsx
// The congregant's *personal* prayer rule (Canon), set with their father of
// confession. Ported from Nepsis and re-skinned to Poimen. "Today" shows the
// items due today (built from the rule for this weekday); "Edit" configures the
// rule per day of the week. Distinct from the priest-assigned canon on the tab.

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, TextInput,
  StyleSheet, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { goBack } from '@/lib/nav';
import { colors, fonts , lazyThemed } from '@/lib/theme';
import { useSession } from '@/lib/auth';
import { useDemoMode } from '@/lib/demo';
import {
  RuleConfig, DayPlan, ServiceCommitment, loadRule, saveRule,
  AGPEYA_HOURS, SERVICES, CONFESSION_OPTIONS, SERVICE_FREQUENCY_OPTIONS,
  FAST_UNTIL_OPTIONS, WEEKDAYS, MAX_SERVICE_COUNT, setServicesMode,
} from '@/lib/canon/rule-store';
import { hydrateRuleFromCloud, pushRuleToCloud } from '@/lib/canon/rule-sync';
import {
  AssignedCategory, AssignedCanon, loadAssignedForMember, applyOverlay,
} from '@/lib/canon/assigned';
import { lastConfessionDate } from '@/lib/confession/dates';
import ScrollPicker from '@/components/ui/ScrollPicker';

const SP = { xs: 6, sm: 10, md: 14, lg: 20, xl: 28 };
const R = { md: 10, lg: 12, full: 999 };

// ─── Small controls ───────────────────────────────────────────────────────────

function Stepper({ value, onChange, min = 0, max = 999, step = 1, unit }: {
  value: number; onChange: (n: number) => void; min?: number; max?: number; step?: number; unit?: string;
}) {
  return (
    <View style={s.stepperRow}>
      <TouchableOpacity style={s.stepBtn} onPress={() => onChange(Math.max(min, value - step))}>
        <Text style={s.stepBtnText}>−</Text>
      </TouchableOpacity>
      <Text style={s.stepValue}>{value}{unit ? ` ${unit}` : ''}</Text>
      <TouchableOpacity style={s.stepBtn} onPress={() => onChange(Math.min(max, value + step))}>
        <Text style={s.stepBtnText}>+</Text>
      </TouchableOpacity>
    </View>
  );
}

function Chip({ label, on, onPress }: { label: string; on: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity
      style={[s.chip, { borderColor: on ? colors.gold : colors.border, backgroundColor: on ? colors.gold : 'transparent' }]}
      onPress={onPress}
    >
      <Text style={{ color: on ? colors.navy : colors.textSecond, fontSize: 12, fontFamily: fonts.latoBold }}>{label}</Text>
    </TouchableOpacity>
  );
}

function FieldRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={s.fieldRow}>
      <Text style={s.fieldLabel}>{label}</Text>
      {children}
    </View>
  );
}

// A short note shown under any part the Father of Confession has assigned. That
// part is read-only until the member's next confession, or until the FOC
// changes/removes it.
function LockNote() {
  return (
    <View style={s.lockNote}>
      <Text style={s.lockNoteText}>
        🔒 Set by your Father of Confession — you can't change this until your next confession,
        or until he changes or removes it.
      </Text>
    </View>
  );
}

// Read-only value pill for a locked "every day" field.
function LockedValue({ text }: { text: string }) {
  return <View style={s.lockedPill}><Text style={s.lockedPillText}>{text}</Text></View>;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function RuleScreen() {
  const router = useRouter();
  const { user, profile } = useSession();
  const { demoMode } = useDemoMode();
  const canSync = !!user && !demoMode;

  const [rule, setRule] = useState<RuleConfig | null>(null);
  const [expandedDay, setExpandedDay] = useState<number | null>(null);
  // What the Father of Confession has assigned, kept as inputs so the overlay
  // can be RE-derived on every edit. Holding the overlay in state instead let
  // it go stale the moment the member changed anything (most visibly: flipping
  // the services mode left the weekday editor rendering against the old mode).
  const [assigned, setAssigned] = useState<AssignedCanon[]>([]);
  const [lastConf, setLastConf] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      if (canSync && user) await hydrateRuleFromCloud(user.id);
      const r = await loadRule();
      const [a, last] = await Promise.all([
        loadAssignedForMember(user?.id ?? '', demoMode, profile?.foc_id),
        lastConfessionDate(),
      ]);
      setAssigned(a);
      setLastConf(last);
      setRule(r);
    })();
  }, [canSync, user, demoMode]);

  const overlay = useMemo(
    () => (rule ? applyOverlay(rule, assigned, lastConf) : null),
    [rule, assigned, lastConf],
  );
  const effRule = overlay?.rule ?? null;
  const lockedCats = overlay?.lockedCategories ?? new Set<AssignedCategory>();
  const lockedDays = overlay?.lockedDays ?? { agpeya_hours: new Set<number>(), services: new Set<number>(), heart_of_service: new Set<number>() };
  // The priest fixes HOW services are committed whenever he has assigned any —
  // including a weekday assignment, which locks only its own days but still
  // takes the days-vs-counts choice out of the member's hands.
  const servicesModeLocked = overlay?.servicesModeLocked ?? false;

  const isLocked = (c: AssignedCategory) => lockedCats.has(c);
  const isDayLocked = (c: 'agpeya_hours' | 'services' | 'heart_of_service', i: number) => lockedDays[c].has(i);
  const anyLock = lockedCats.size > 0 || (['agpeya_hours', 'services', 'heart_of_service'] as const).some(c => lockedDays[c].size > 0);

  const update = useCallback((next: RuleConfig) => {
    setRule(next);
    saveRule(next).then(() => { if (canSync && user) pushRuleToCloud(user.id, next); });
  }, [canSync, user]);

  if (!rule || !effRule) {
    return (
      <SafeAreaView style={s.safe}>
        <View style={s.center}><ActivityIndicator color={colors.gold} /></View>
      </SafeAreaView>
    );
  }

  const today = new Date().getDay();

  // ─── Editor ───────────────────────────────────────────────────────────────────
  const setDay = (i: number, patch: Partial<DayPlan>) => {
    const days = rule.days.map((d, idx) => (idx === i ? { ...d, ...patch } : d));
    update({ ...rule, days });
  };
  const toggleIn = (arr: string[], k: string) => (arr.includes(k) ? arr.filter(x => x !== k) : [...arr, k]);
  const patchServing = (dayIdx: number, j: number, patch: Partial<ServiceCommitment>) => {
    const serving = rule.days[dayIdx].serving.map((e, idx) => (idx === j ? { ...e, ...patch } : e));
    setDay(dayIdx, { serving });
  };

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => goBack('/(tabs)/canon')} hitSlop={8}>
          <Text style={s.headerBack}>‹ Canon</Text>
        </TouchableOpacity>
        <Text style={s.headerTitle}>Edit Rule</Text>
        <View style={{ width: 54 }} />
      </View>
      <ScrollView contentContainerStyle={{ padding: SP.lg, paddingBottom: 40 }} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets>
        <Text style={s.note}>
          Set your rule together with your father of confession. Add only what you can keep faithfully.
        </Text>

        {anyLock && (
          <View style={s.banner}>
            <Text style={s.bannerText}>
              🔒 Some parts of your canon were set by your Father of Confession. Those are read-only until
              your next confession, or until he changes them. You can still edit the rest.
            </Text>
          </View>
        )}

        {/* Daily */}
        <Text style={s.sectionLabel}>Every day</Text>
        {isLocked('prostrations') ? (
          <>
            <FieldRow label="Prostrations (metanias)"><LockedValue text={`${effRule.prostrations}`} /></FieldRow>
            <LockNote />
          </>
        ) : (
          <>
            <FieldRow label="Prostrations (metanias)">
              <Stepper value={rule.prostrations} onChange={n => update({ ...rule, prostrations: n })} max={500} />
            </FieldRow>
            <Text style={s.fieldNote}>Not done on Saturdays, Sundays, or during the Holy Fifty.</Text>
          </>
        )}
        {isLocked('quiet') ? (
          <>
            <FieldRow label="Quiet time"><LockedValue text={`${effRule.quietMinutes} min`} /></FieldRow>
            <LockNote />
          </>
        ) : (
          <FieldRow label="Quiet time">
            <Stepper value={rule.quietMinutes} onChange={n => update({ ...rule, quietMinutes: n })} step={5} max={180} unit="min" />
          </FieldRow>
        )}

        {/* Fasting */}
        <View style={s.card}>
          <View style={s.cardHead}>
            <Text style={s.cardTitle}>Fast until (on fasting days)</Text>
            <Text style={[s.cardTitle, { color: colors.goldLight }]}>{isLocked('fasting') ? effRule.fastUntil : rule.fastUntil}</Text>
          </View>
          {isLocked('fasting') ? (
            <LockNote />
          ) : (
            <>
              <ScrollPicker options={FAST_UNTIL_OPTIONS} value={rule.fastUntil} onChange={v => update({ ...rule, fastUntil: v })} />
              <Text style={[s.fieldNote, { marginTop: 4 }]}>
                Wednesdays, Fridays, and the Church's fasting seasons are fasting days automatically, except during the Holy Fifty.
              </Text>
            </>
          )}
        </View>

        {/* Bible reading */}
        <View style={s.card}>
          <Text style={s.cardTitle}>Bible reading</Text>
          {isLocked('bible') ? (
            <><LockedValue text={`${effRule.bible.amount} ${effRule.bible.mode}`} /><LockNote /></>
          ) : (
            <View style={s.chipRow}>
              <Chip label="Chapters" on={rule.bible.mode === 'chapters'} onPress={() => update({ ...rule, bible: { ...rule.bible, mode: 'chapters' } })} />
              <Chip label="Minutes"  on={rule.bible.mode === 'minutes'}  onPress={() => update({ ...rule, bible: { ...rule.bible, mode: 'minutes' } })} />
              <View style={{ flex: 1 }} />
              <Stepper value={rule.bible.amount} onChange={n => update({ ...rule, bible: { ...rule.bible, amount: n } })} step={rule.bible.mode === 'minutes' ? 5 : 1} max={180} />
            </View>
          )}
        </View>

        {/* Spiritual book */}
        <View style={s.card}>
          <View style={s.cardHead}>
            <Text style={s.cardTitle}>Spiritual book</Text>
            {!isLocked('book') && (rule.book ? (
              <TouchableOpacity onPress={() => update({ ...rule, book: null })}><Text style={{ color: colors.red, fontSize: 12, fontFamily: fonts.lato }}>Remove</Text></TouchableOpacity>
            ) : (
              <TouchableOpacity onPress={() => update({ ...rule, book: { title: '', mode: 'chapters', amount: 1 } })}><Text style={{ color: colors.gold, fontSize: 12, fontFamily: fonts.latoBold }}>+ Add</Text></TouchableOpacity>
            ))}
          </View>
          {isLocked('book') && (
            <><LockedValue text={effRule.book ? `${effRule.book.title || 'A spiritual book'} · ${effRule.book.amount} ${effRule.book.mode}` : 'None'} /><LockNote /></>
          )}
          {!isLocked('book') && rule.book && (
            <>
              <TextInput
                style={s.input}
                placeholder="Book title (e.g. The Spiritual Ladder)"
                placeholderTextColor={colors.muted}
                value={rule.book.title}
                onChangeText={t => update({ ...rule, book: { ...rule.book!, title: t } })}
              />
              <View style={[s.chipRow, { marginTop: SP.sm }]}>
                <Chip label="Chapters" on={rule.book.mode === 'chapters'} onPress={() => update({ ...rule, book: { ...rule.book!, mode: 'chapters' } })} />
                <Chip label="Minutes"  on={rule.book.mode === 'minutes'}  onPress={() => update({ ...rule, book: { ...rule.book!, mode: 'minutes' } })} />
                <View style={{ flex: 1 }} />
                <Stepper value={rule.book.amount} onChange={n => update({ ...rule, book: { ...rule.book!, amount: n } })} step={rule.book.mode === 'minutes' ? 5 : 1} max={180} />
              </View>
            </>
          )}
        </View>

        {/* Confession */}
        <View style={s.card}>
          <Text style={s.cardTitle}>Confession frequency</Text>
          {isLocked('confession') ? (
            <><LockedValue text={effRule.confession} /><LockNote /></>
          ) : (
            <View style={[s.chipRow, { flexWrap: 'wrap' }]}>
              {CONFESSION_OPTIONS.map(opt => (
                <Chip key={opt} label={opt} on={rule.confession === opt} onPress={() => update({ ...rule, confession: opt })} />
              ))}
            </View>
          )}
        </View>

        {/* Church services — specific days OR a number of times per week */}
        <View style={s.card}>
          <Text style={s.sectionLabel}>Church services</Text>
          {isLocked('services') ? (
            <>
              {effRule.servicesMode === 'counts' ? (
                <View style={[s.chipRow, { flexWrap: 'wrap' }]}>
                  {SERVICES.filter(sv => (effRule.serviceCounts?.[sv.key] ?? 0) > 0).length === 0
                    ? <Text style={s.mutedSmall}>None</Text>
                    : SERVICES.filter(sv => (effRule.serviceCounts?.[sv.key] ?? 0) > 0).map(sv => (
                        <View key={sv.key} style={s.roChip}>
                          <Text style={s.roChipText}>{sv.name} · {effRule.serviceCounts[sv.key]}×/week</Text>
                        </View>
                      ))}
                </View>
              ) : (
                <Text style={s.mutedSmall}>Set on specific days below.</Text>
              )}
              <LockNote />
            </>
          ) : servicesModeLocked ? (
            // The priest assigned services by specific weekdays: he owns HOW
            // they're committed, so the mode can't be switched here. Only the
            // weekdays he didn't set stay editable, in the day cards below.
            <>
              <Text style={s.mutedSmall}>Set on specific days below.</Text>
              <LockNote />
            </>
          ) : (
            <>
              <Text style={s.helpText}>
                Commit either to specific days of the week, or to a number of times per week that you log as you attend — one or the other, not both.
              </Text>
              <View style={[s.chipRow, { marginTop: SP.sm }]}>
                <Chip label="Specific days" on={rule.servicesMode === 'days'}
                  onPress={() => update(setServicesMode(rule, 'days'))} />
                <Chip label="Times per week" on={rule.servicesMode === 'counts'}
                  onPress={() => update(setServicesMode(rule, 'counts'))} />
              </View>
              {rule.servicesMode === 'counts' && (
                <View style={{ marginTop: SP.sm }}>
                  {SERVICES.map(sv => (
                    <FieldRow key={sv.key} label={sv.name}>
                      <Stepper
                        value={rule.serviceCounts?.[sv.key] ?? 0}
                        onChange={n => {
                          const counts = { ...(rule.serviceCounts ?? {}) };
                          if (n > 0) counts[sv.key] = n; else delete counts[sv.key];
                          update({ ...rule, serviceCounts: counts });
                        }}
                        max={MAX_SERVICE_COUNT}
                        unit="× / week"
                      />
                    </FieldRow>
                  ))}
                  <Text style={s.helpText}>
                    These appear in your canon every day until you've logged them for the week.
                  </Text>
                </View>
              )}
            </>
          )}
        </View>

        {/* By day of week */}
        <Text style={[s.sectionLabel, { marginTop: SP.lg }]}>For each day of the week</Text>
        {WEEKDAYS.map((name, i) => {
          const d = rule.days[i];
          const ed = effRule.days[i];   // effective (includes any FOC-locked parts) — for the summary
          const open = expandedDay === i;
          const autoFast = i === 3 || i === 5;
          const serveCount = ed.serving.filter(x => x.text.trim()).length;
          const summary = [
            ed.hours.length ? `${ed.hours.length} hours` : null,
            effRule.servicesMode === 'days' && ed.services.length ? `${ed.services.length} services` : null,
            serveCount ? `${serveCount} serving` : null,
            autoFast ? 'fast day' : null,
          ].filter(Boolean).join(' · ') || 'Nothing set';
          return (
            <View key={i} style={[s.dayCard, { borderColor: open ? colors.gold : colors.border }]}>
              <TouchableOpacity style={s.dayHead} onPress={() => setExpandedDay(open ? null : i)}>
                <View>
                  <Text style={s.dayName}>{name}{i === today ? '  · today' : ''}</Text>
                  <Text style={s.daySummary}>{summary}</Text>
                </View>
                <Text style={{ color: colors.muted, fontSize: 16 }}>{open ? '▲' : '▾'}</Text>
              </TouchableOpacity>

              {open && (
                <View style={{ paddingTop: SP.sm }}>
                  {/* Agpeya hours */}
                  <Text style={s.subLabel}>Agpeya hours</Text>
                  {isDayLocked('agpeya_hours', i) ? (
                    <>
                      <View style={[s.chipRow, { flexWrap: 'wrap' }]}>
                        {effRule.days[i].hours.length === 0
                          ? <Text style={s.mutedSmall}>None</Text>
                          : AGPEYA_HOURS.filter(h => effRule.days[i].hours.includes(h.key)).map(h => (
                              <View key={h.key} style={s.roChip}><Text style={s.roChipText}>{h.name}</Text></View>
                            ))}
                      </View>
                      <LockNote />
                    </>
                  ) : (
                    <View style={[s.chipRow, { flexWrap: 'wrap' }]}>
                      {AGPEYA_HOURS.map(h => (
                        <Chip key={h.key} label={h.name} on={d.hours.includes(h.key)} onPress={() => setDay(i, { hours: toggleIn(d.hours, h.key) })} />
                      ))}
                    </View>
                  )}

                  {/* Church services — only when committed by specific days;
                      in "times per week" mode they live in the card above. */}
                  <Text style={[s.subLabel, { marginTop: SP.sm }]}>Church services</Text>
                  {effRule.servicesMode === 'counts' ? (
                    <Text style={s.mutedSmall}>Set as times per week above.</Text>
                  ) : isDayLocked('services', i) ? (
                    <>
                      <View style={[s.chipRow, { flexWrap: 'wrap' }]}>
                        {effRule.days[i].services.length === 0
                          ? <Text style={s.mutedSmall}>None</Text>
                          : SERVICES.filter(sv => effRule.days[i].services.includes(sv.key)).map(sv => (
                              <View key={sv.key} style={s.roChip}><Text style={s.roChipText}>{sv.name}</Text></View>
                            ))}
                      </View>
                      <LockNote />
                    </>
                  ) : (
                    <View style={[s.chipRow, { flexWrap: 'wrap' }]}>
                      {SERVICES.map(sv => (
                        <Chip key={sv.key} label={sv.name} on={d.services.includes(sv.key)} onPress={() => setDay(i, { services: toggleIn(d.services, sv.key) })} />
                      ))}
                    </View>
                  )}

                  {/* Heart of Service */}
                  {isDayLocked('heart_of_service', i) ? (
                    <>
                      <Text style={[s.subLabel, { marginTop: SP.sm }]}>Heart of Service</Text>
                      {effRule.days[i].serving.filter(x => x.text.trim()).length === 0
                        ? <Text style={s.mutedSmall}>None</Text>
                        : effRule.days[i].serving.filter(x => x.text.trim()).map((sv, j) => (
                            <View key={j} style={s.roChip}><Text style={s.roChipText}>{sv.text}{sv.freq ? ` · ${sv.freq}` : ''}</Text></View>
                          ))}
                      <LockNote />
                    </>
                  ) : (
                    <>
                      <View style={s.serveHead}>
                        <Text style={[s.subLabel, { marginBottom: 0 }]}>Heart of Service</Text>
                        <TouchableOpacity onPress={() => setDay(i, { serving: [...d.serving, { text: '', freq: 'Weekly' }] })} hitSlop={8}>
                          <Text style={{ color: colors.gold, fontSize: 12, fontFamily: fonts.latoBold }}>+ Add</Text>
                        </TouchableOpacity>
                      </View>
                      {d.serving.map((sv, j) => (
                        <View key={j} style={s.serveEntry}>
                          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                            <TextInput
                              style={[s.input, { flex: 1 }]}
                              placeholder="Your service (e.g. Sunday school, visiting the sick)"
                              placeholderTextColor={colors.muted}
                              value={sv.text}
                              onChangeText={t => patchServing(i, j, { text: t })}
                            />
                            <TouchableOpacity onPress={() => setDay(i, { serving: d.serving.filter((_, idx) => idx !== j) })} hitSlop={8}>
                              <Text style={{ color: colors.red, fontSize: 12, fontFamily: fonts.lato, marginLeft: SP.sm }}>Remove</Text>
                            </TouchableOpacity>
                          </View>
                          <View style={[s.chipRow, { flexWrap: 'wrap', marginTop: SP.sm }]}>
                            {SERVICE_FREQUENCY_OPTIONS.map(opt => (
                              <Chip key={opt} label={opt} on={sv.freq === opt} onPress={() => patchServing(i, j, { freq: opt })} />
                            ))}
                          </View>
                        </View>
                      ))}
                      {d.serving.length > 0 && (
                        <Text style={[s.fieldNote, { marginTop: 2, marginBottom: 0 }]}>
                          A service appears each {name} until checked off, then rests for its
                          frequency (a monthly service returns about a month after it's done).
                        </Text>
                      )}
                    </>
                  )}

                  {autoFast && (
                    <Text style={[s.fieldNote, { marginTop: SP.sm }]}>
                      ✦ Automatically a fasting day (except during the Holy Fifty).
                    </Text>
                  )}
                </View>
              )}
            </View>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = lazyThemed(() => StyleSheet.create({
  safe:   { flex: 1, backgroundColor: colors.navy },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: SP.lg, paddingVertical: SP.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  headerBack: { fontFamily: fonts.lato, fontSize: 14, color: colors.gold, width: 54 },
  headerTitle: { fontFamily: fonts.cormorantMedium, fontSize: 20, color: colors.cream },

  note:          { fontFamily: fonts.latoLight, fontSize: 12, lineHeight: 18, fontStyle: 'italic', marginBottom: SP.lg, color: colors.textSecond },
  sectionLabel:  { fontFamily: fonts.latoBold, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: SP.sm, color: colors.textSecond },
  subLabel:      { fontFamily: fonts.latoBold, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 6, color: colors.textSecond },

  fieldRow:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderColor: colors.border, borderRadius: R.lg, padding: SP.md, marginBottom: SP.sm, backgroundColor: colors.panel },
  fieldLabel:    { fontFamily: fonts.lato, fontSize: 14, flex: 1, color: colors.cream },
  fieldNote:     { fontFamily: fonts.latoLight, fontSize: 11, lineHeight: 16, marginBottom: SP.sm, marginTop: -2, color: colors.muted },

  stepperRow:    { flexDirection: 'row', alignItems: 'center', gap: SP.sm },
  stepBtn:       { width: 34, height: 34, borderRadius: R.md, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  stepBtnText:   { fontSize: 20, fontFamily: fonts.latoBold, color: colors.gold },
  stepValue:     { fontFamily: fonts.latoBold, fontSize: 15, minWidth: 56, textAlign: 'center', color: colors.cream },

  card:          { borderWidth: 1, borderColor: colors.border, borderRadius: R.lg, padding: SP.md, marginBottom: SP.sm, backgroundColor: colors.panel },
  cardHead:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cardTitle:     { fontFamily: fonts.latoBold, fontSize: 14, marginBottom: SP.sm, color: colors.cream },
  chipRow:       { flexDirection: 'row', alignItems: 'center', gap: SP.xs },
  chip:          { borderWidth: 1, borderRadius: R.full, paddingHorizontal: 12, paddingVertical: 6, marginRight: 6, marginBottom: 6 },
  input:         { borderWidth: 1, borderColor: colors.border, borderRadius: R.md, padding: SP.sm, fontSize: 14, color: colors.cream, fontFamily: fonts.lato, backgroundColor: colors.panel },

  dayCard:       { borderWidth: 1, borderRadius: R.lg, padding: SP.md, marginBottom: SP.sm, backgroundColor: colors.panel },
  serveHead:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: SP.sm, marginBottom: 6 },
  serveEntry:    { borderWidth: 1, borderColor: colors.border, borderRadius: R.md, padding: SP.sm, marginBottom: 6 },
  dayHead:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  dayName:       { fontFamily: fonts.latoBold, fontSize: 14, color: colors.cream },
  daySummary:    { fontFamily: fonts.latoLight, fontSize: 12, marginTop: 2, color: colors.muted },

  banner:        { borderWidth: 1, borderColor: colors.gold + '55', backgroundColor: colors.goldDim, borderRadius: R.md, padding: SP.md, marginBottom: SP.md },
  bannerText:    { fontFamily: fonts.lato, fontSize: 12, lineHeight: 18, color: colors.goldLight },
  lockNote:      { marginTop: 4, marginBottom: SP.sm },
  lockNoteText:  { fontFamily: fonts.latoLight, fontSize: 11, lineHeight: 16, color: colors.muted, fontStyle: 'italic' },
  lockedPill:    { alignSelf: 'flex-end', backgroundColor: colors.goldDim, borderWidth: 1, borderColor: colors.gold + '55', borderRadius: R.full, paddingHorizontal: 12, paddingVertical: 6 },
  lockedPillText:{ fontFamily: fonts.latoBold, fontSize: 13, color: colors.goldLight },
  roChip:        { borderWidth: 1, borderColor: colors.gold + '55', backgroundColor: colors.goldDim, borderRadius: R.full, paddingHorizontal: 12, paddingVertical: 6, marginRight: 6, marginBottom: 6 },
  roChipText:    { fontFamily: fonts.latoBold, fontSize: 12, color: colors.goldLight },
  mutedSmall:    { fontFamily: fonts.latoLight, fontSize: 12, color: colors.muted, marginBottom: 6 },
  helpText:      { fontFamily: fonts.latoLight, fontSize: 11, color: colors.muted, lineHeight: 16, marginTop: 4 },

}));
