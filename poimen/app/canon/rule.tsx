// app/canon/rule.tsx
// The congregant's *personal* prayer rule (Canon), set with their father of
// confession. Ported from Nepsis and re-skinned to Poimen. "Today" shows the
// items due today (built from the rule for this weekday); "Edit" configures the
// rule per day of the week. Distinct from the priest-assigned canon on the tab.

import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, TextInput,
  StyleSheet, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { colors, fonts } from '@/lib/theme';
import { useSession } from '@/lib/auth';
import { useDemoMode } from '@/lib/demo';
import {
  RuleConfig, DayPlan, ServiceCommitment, loadRule, saveRule,
  AGPEYA_HOURS, SERVICES, CONFESSION_OPTIONS, SERVICE_FREQUENCY_OPTIONS,
  FAST_UNTIL_OPTIONS, WEEKDAYS,
} from '@/lib/canon/rule-store';
import { hydrateRuleFromCloud, pushRuleToCloud } from '@/lib/canon/rule-sync';
import ScrollPicker from '@/components/ui/ScrollPicker';

const SP = { xs: 6, sm: 10, md: 14, lg: 20, xl: 28 };
const R = { md: 10, lg: 12, full: 999 };
const SECOND = 'rgba(245,240,232,0.75)';
const CARD_BG = 'rgba(10,16,30,0.5)';

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
      <Text style={{ color: on ? colors.navy : SECOND, fontSize: 12, fontFamily: fonts.latoBold }}>{label}</Text>
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

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function RuleScreen() {
  const router = useRouter();
  const { user } = useSession();
  const { demoMode } = useDemoMode();
  const canSync = !!user && !demoMode;

  const [rule, setRule] = useState<RuleConfig | null>(null);
  const [expandedDay, setExpandedDay] = useState<number | null>(null);

  useEffect(() => {
    (async () => {
      if (canSync && user) await hydrateRuleFromCloud(user.id);
      setRule(await loadRule());
    })();
  }, [canSync, user]);

  const update = useCallback((next: RuleConfig) => {
    setRule(next);
    saveRule(next).then(() => { if (canSync && user) pushRuleToCloud(user.id, next); });
  }, [canSync, user]);

  if (!rule) {
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
        <TouchableOpacity onPress={() => router.back()} hitSlop={8}>
          <Text style={s.headerBack}>‹ Canon</Text>
        </TouchableOpacity>
        <Text style={s.headerTitle}>Edit Rule</Text>
        <View style={{ width: 54 }} />
      </View>
      <ScrollView contentContainerStyle={{ padding: SP.lg, paddingBottom: 40 }}>
        <Text style={s.note}>
          Set your rule together with your father of confession. Add only what you can keep faithfully.
        </Text>

        {/* Daily */}
        <Text style={s.sectionLabel}>Every day</Text>
        <FieldRow label="Prostrations (metanias)">
          <Stepper value={rule.prostrations} onChange={n => update({ ...rule, prostrations: n })} max={500} />
        </FieldRow>
        <Text style={s.fieldNote}>Not done on Saturdays, Sundays, or during the Holy Fifty.</Text>
        <FieldRow label="Quiet time">
          <Stepper value={rule.quietMinutes} onChange={n => update({ ...rule, quietMinutes: n })} step={5} max={180} unit="min" />
        </FieldRow>

        {/* Fasting */}
        <View style={s.card}>
          <View style={s.cardHead}>
            <Text style={s.cardTitle}>Fast until (on fasting days)</Text>
            <Text style={[s.cardTitle, { color: colors.goldLight }]}>{rule.fastUntil}</Text>
          </View>
          <ScrollPicker options={FAST_UNTIL_OPTIONS} value={rule.fastUntil} onChange={v => update({ ...rule, fastUntil: v })} />
          <Text style={[s.fieldNote, { marginTop: 4 }]}>
            Wednesdays, Fridays, and the Church's fasting seasons are fasting days automatically, except during the Holy Fifty.
          </Text>
        </View>

        {/* Bible reading */}
        <View style={s.card}>
          <Text style={s.cardTitle}>Bible reading</Text>
          <View style={s.chipRow}>
            <Chip label="Chapters" on={rule.bible.mode === 'chapters'} onPress={() => update({ ...rule, bible: { ...rule.bible, mode: 'chapters' } })} />
            <Chip label="Minutes"  on={rule.bible.mode === 'minutes'}  onPress={() => update({ ...rule, bible: { ...rule.bible, mode: 'minutes' } })} />
            <View style={{ flex: 1 }} />
            <Stepper value={rule.bible.amount} onChange={n => update({ ...rule, bible: { ...rule.bible, amount: n } })} step={rule.bible.mode === 'minutes' ? 5 : 1} max={180} />
          </View>
        </View>

        {/* Spiritual book */}
        <View style={s.card}>
          <View style={s.cardHead}>
            <Text style={s.cardTitle}>Spiritual book</Text>
            {rule.book ? (
              <TouchableOpacity onPress={() => update({ ...rule, book: null })}><Text style={{ color: colors.red, fontSize: 12, fontFamily: fonts.lato }}>Remove</Text></TouchableOpacity>
            ) : (
              <TouchableOpacity onPress={() => update({ ...rule, book: { title: '', mode: 'chapters', amount: 1 } })}><Text style={{ color: colors.gold, fontSize: 12, fontFamily: fonts.latoBold }}>+ Add</Text></TouchableOpacity>
            )}
          </View>
          {rule.book && (
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
          <View style={[s.chipRow, { flexWrap: 'wrap' }]}>
            {CONFESSION_OPTIONS.map(opt => (
              <Chip key={opt} label={opt} on={rule.confession === opt} onPress={() => update({ ...rule, confession: opt })} />
            ))}
          </View>
        </View>

        {/* By day of week */}
        <Text style={[s.sectionLabel, { marginTop: SP.lg }]}>For each day of the week</Text>
        {WEEKDAYS.map((name, i) => {
          const d = rule.days[i];
          const open = expandedDay === i;
          const autoFast = i === 3 || i === 5;
          const summary = [
            d.hours.length ? `${d.hours.length} hours` : null,
            d.services.length ? `${d.services.length} services` : null,
            d.serving.length ? `${d.serving.length} serving` : null,
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
                  <Text style={s.subLabel}>Agpeya hours</Text>
                  <View style={[s.chipRow, { flexWrap: 'wrap' }]}>
                    {AGPEYA_HOURS.map(h => (
                      <Chip key={h.key} label={h.name} on={d.hours.includes(h.key)} onPress={() => setDay(i, { hours: toggleIn(d.hours, h.key) })} />
                    ))}
                  </View>
                  <Text style={[s.subLabel, { marginTop: SP.sm }]}>Church services</Text>
                  <View style={[s.chipRow, { flexWrap: 'wrap' }]}>
                    {SERVICES.map(sv => (
                      <Chip key={sv.key} label={sv.name} on={d.services.includes(sv.key)} onPress={() => setDay(i, { services: toggleIn(d.services, sv.key) })} />
                    ))}
                  </View>
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

const s = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: colors.navy },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: SP.lg, paddingVertical: SP.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  headerBack: { fontFamily: fonts.lato, fontSize: 14, color: colors.gold, width: 54 },
  headerTitle: { fontFamily: fonts.cormorantMedium, fontSize: 20, color: colors.cream },

  note:          { fontFamily: fonts.latoLight, fontSize: 12, lineHeight: 18, fontStyle: 'italic', marginBottom: SP.lg, color: SECOND },
  sectionLabel:  { fontFamily: fonts.latoBold, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: SP.sm, color: SECOND },
  subLabel:      { fontFamily: fonts.latoBold, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 6, color: SECOND },

  fieldRow:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderColor: colors.border, borderRadius: R.lg, padding: SP.md, marginBottom: SP.sm, backgroundColor: CARD_BG },
  fieldLabel:    { fontFamily: fonts.lato, fontSize: 14, flex: 1, color: colors.cream },
  fieldNote:     { fontFamily: fonts.latoLight, fontSize: 11, lineHeight: 16, marginBottom: SP.sm, marginTop: -2, color: colors.muted },

  stepperRow:    { flexDirection: 'row', alignItems: 'center', gap: SP.sm },
  stepBtn:       { width: 34, height: 34, borderRadius: R.md, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  stepBtnText:   { fontSize: 20, fontFamily: fonts.latoBold, color: colors.gold },
  stepValue:     { fontFamily: fonts.latoBold, fontSize: 15, minWidth: 56, textAlign: 'center', color: colors.cream },

  card:          { borderWidth: 1, borderColor: colors.border, borderRadius: R.lg, padding: SP.md, marginBottom: SP.sm, backgroundColor: CARD_BG },
  cardHead:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cardTitle:     { fontFamily: fonts.latoBold, fontSize: 14, marginBottom: SP.sm, color: colors.cream },
  chipRow:       { flexDirection: 'row', alignItems: 'center', gap: SP.xs },
  chip:          { borderWidth: 1, borderRadius: R.full, paddingHorizontal: 12, paddingVertical: 6, marginRight: 6, marginBottom: 6 },
  input:         { borderWidth: 1, borderColor: colors.border, borderRadius: R.md, padding: SP.sm, fontSize: 14, color: colors.cream, fontFamily: fonts.lato, backgroundColor: 'rgba(10,16,30,0.7)' },

  dayCard:       { borderWidth: 1, borderRadius: R.lg, padding: SP.md, marginBottom: SP.sm, backgroundColor: CARD_BG },
  serveHead:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: SP.sm, marginBottom: 6 },
  serveEntry:    { borderWidth: 1, borderColor: colors.border, borderRadius: R.md, padding: SP.sm, marginBottom: 6 },
  dayHead:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  dayName:       { fontFamily: fonts.latoBold, fontSize: 14, color: colors.cream },
  daySummary:    { fontFamily: fonts.latoLight, fontSize: 12, marginTop: 2, color: colors.muted },

});
