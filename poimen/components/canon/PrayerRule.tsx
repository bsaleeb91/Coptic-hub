// The personal prayer rule — the private, self-kept structure of daily prayer,
// ideally set with one's father of confession. Lives on-device (AsyncStorage),
// separate from priest-assigned canons. Today view is generated from the rule
// for the current weekday, with fasting and prostration rules applied
// automatically (Wed/Fri fasts, none during the Holy Fifty; no prostrations
// Sat/Sun/Holy Fifty). Ported from Nepsis; restyled for Poimen.
import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, TextInput,
  StyleSheet, ActivityIndicator, Modal,
} from 'react-native';
import { colors, fonts } from '@/lib/theme';
import * as H from '@/lib/haptics';
import { Card } from '@/components/ui/Card';
import { ScrollPicker } from '@/components/ui/ScrollPicker';
import {
  RuleConfig, DayPlan, ReadMode, loadRule, saveRule, ruleIsEmpty,
  loadTodayDone, saveTodayDone,
  AGPEYA_HOURS, SERVICES, CONFESSION_OPTIONS, FAST_UNTIL_OPTIONS, WEEKDAYS,
} from '@/lib/liturgical/ruleStore';
import { isFastDay, prostrationsAllowed, isHolyFifty } from '@/lib/liturgical/fasting';

const hourName = (k: string) => AGPEYA_HOURS.find(h => h.key === k)?.name ?? k;
const serviceName = (k: string) => SERVICES.find(s => s.key === k)?.name ?? k;
const readLabel = (mode: ReadMode, n: number) => `${n} ${mode === 'chapters' ? (n === 1 ? 'chapter' : 'chapters') : 'min'}`;

interface Item { key: string; label: string; }

function todayItems(rule: RuleConfig, date: Date): Item[] {
  const d = rule.days[date.getDay()];
  const items: Item[] = [];
  for (const h of d.hours) items.push({ key: `hour_${h}`, label: `Pray the ${hourName(h)}` });
  for (const sv of d.services) items.push({ key: `svc_${sv}`, label: `Attend ${serviceName(sv)}` });
  if (isFastDay(date)) items.push({ key: 'fast', label: `Fast — abstain from food until ${rule.fastUntil}` });
  if (rule.prostrations > 0 && prostrationsAllowed(date)) items.push({ key: 'prostrations', label: `${rule.prostrations} prostrations (metanias)` });
  if (rule.quietMinutes > 0) items.push({ key: 'quiet', label: `${rule.quietMinutes} min of quiet time` });
  if (rule.bible.amount > 0) items.push({ key: 'bible', label: `Bible reading — ${readLabel(rule.bible.mode, rule.bible.amount)}` });
  if (rule.book && rule.book.amount > 0) items.push({ key: 'book', label: `${rule.book.title || 'Spiritual book'} — ${readLabel(rule.book.mode, rule.book.amount)}` });
  return items;
}

// ─── Small controls ───────────────────────────────────────────

function Stepper({ value, onChange, min = 0, max = 999, step = 1, unit }: {
  value: number; onChange: (n: number) => void; min?: number; max?: number; step?: number; unit?: string;
}) {
  return (
    <View style={s.stepperRow}>
      <TouchableOpacity style={s.stepBtn} onPress={() => { H.tap(); onChange(Math.max(min, value - step)); }}>
        <Text style={s.stepBtnText}>−</Text>
      </TouchableOpacity>
      <Text style={s.stepValue}>{value}{unit ? ` ${unit}` : ''}</Text>
      <TouchableOpacity style={s.stepBtn} onPress={() => { H.tap(); onChange(Math.min(max, value + step)); }}>
        <Text style={s.stepBtnText}>+</Text>
      </TouchableOpacity>
    </View>
  );
}

function Chip({ label, on, onPress }: { label: string; on: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity
      style={[s.chip, on ? s.chipOn : s.chipOff]}
      onPress={() => { H.tap(); onPress(); }}
    >
      <Text style={[s.chipText, { color: on ? colors.navy : colors.muted }]}>{label}</Text>
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

// ─── Editor (full-screen modal) ───────────────────────────────

function RuleEditor({ rule, update, onClose }: {
  rule: RuleConfig; update: (r: RuleConfig) => void; onClose: () => void;
}) {
  const [expandedDay, setExpandedDay] = useState<number | null>(null);
  const today = new Date().getDay();

  const setDay = (i: number, patch: Partial<DayPlan>) => {
    const days = rule.days.map((d, idx) => (idx === i ? { ...d, ...patch } : d));
    update({ ...rule, days });
  };
  const toggleIn = (arr: string[], k: string) => (arr.includes(k) ? arr.filter(x => x !== k) : [...arr, k]);

  return (
    <Modal visible animationType="slide">
      <View style={s.editorSafe}>
        <ScrollView style={{ flex: 1 }} contentContainerStyle={s.editorContent}>
          <TouchableOpacity onPress={onClose} style={{ marginBottom: 14 }}>
            <Text style={s.backLink}>‹ Done</Text>
          </TouchableOpacity>
          <Text style={s.editorTitle}>My Prayer Rule</Text>
          <Text style={s.note}>
            Set your rule together with your Father of Confession. Add only what you can keep faithfully.
          </Text>

          {/* Daily */}
          <Text style={s.sectionLabel}>EVERY DAY</Text>
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
              <Text style={[s.cardTitle, { color: colors.gold }]}>{rule.fastUntil}</Text>
            </View>
            <ScrollPicker options={FAST_UNTIL_OPTIONS} value={rule.fastUntil} onChange={v => update({ ...rule, fastUntil: v })} />
            <Text style={[s.fieldNote, { marginTop: 4, marginBottom: 0 }]}>
              Wednesdays and Fridays are fasting days automatically, except during the Holy Fifty.
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
                <TouchableOpacity onPress={() => update({ ...rule, book: null })}><Text style={{ color: colors.red, fontSize: 12, fontFamily: fonts.latoBold }}>Remove</Text></TouchableOpacity>
              ) : (
                <TouchableOpacity onPress={() => update({ ...rule, book: { title: '', mode: 'chapters', amount: 1 } })}><Text style={{ color: colors.gold, fontSize: 12, fontFamily: fonts.latoBold }}>+ Add</Text></TouchableOpacity>
              )}
            </View>
            {rule.book && (
              <>
                <TextInput
                  style={s.input}
                  placeholder="Book title (e.g. The Spiritual Ladder)"
                  placeholderTextColor="rgba(245,240,232,0.22)"
                  value={rule.book.title}
                  onChangeText={t => update({ ...rule, book: { ...rule.book!, title: t } })}
                />
                <View style={[s.chipRow, { marginTop: 10 }]}>
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
          <Text style={[s.sectionLabel, { marginTop: 22 }]}>FOR EACH DAY OF THE WEEK</Text>
          {WEEKDAYS.map((name, i) => {
            const d = rule.days[i];
            const open = expandedDay === i;
            const autoFast = i === 3 || i === 5;
            const summary = [
              d.hours.length ? `${d.hours.length} hour${d.hours.length > 1 ? 's' : ''}` : null,
              d.services.length ? `${d.services.length} service${d.services.length > 1 ? 's' : ''}` : null,
              autoFast ? 'fast day' : null,
            ].filter(Boolean).join(' · ') || 'Nothing set';
            return (
              <View key={i} style={[s.dayCard, open && { borderColor: colors.gold + '66' }]}>
                <TouchableOpacity style={s.dayHead} onPress={() => setExpandedDay(open ? null : i)}>
                  <View>
                    <Text style={s.dayName}>{name}{i === today ? '  · today' : ''}</Text>
                    <Text style={s.daySummary}>{summary}</Text>
                  </View>
                  <Text style={{ color: colors.muted, fontSize: 16 }}>{open ? '▲' : '▾'}</Text>
                </TouchableOpacity>

                {open && (
                  <View style={{ paddingTop: 10 }}>
                    <Text style={s.subLabel}>AGPEYA HOURS</Text>
                    <View style={[s.chipRow, { flexWrap: 'wrap' }]}>
                      {AGPEYA_HOURS.map(h => (
                        <Chip key={h.key} label={h.name} on={d.hours.includes(h.key)} onPress={() => setDay(i, { hours: toggleIn(d.hours, h.key) })} />
                      ))}
                    </View>
                    <Text style={[s.subLabel, { marginTop: 10 }]}>CHURCH SERVICES</Text>
                    <View style={[s.chipRow, { flexWrap: 'wrap' }]}>
                      {SERVICES.map(sv => (
                        <Chip key={sv.key} label={sv.name} on={d.services.includes(sv.key)} onPress={() => setDay(i, { services: toggleIn(d.services, sv.key) })} />
                      ))}
                    </View>
                    {autoFast && (
                      <Text style={[s.fieldNote, { marginTop: 10, marginBottom: 0 }]}>
                        ✦ Automatically a fasting day (except during the Holy Fifty).
                      </Text>
                    )}
                  </View>
                )}
              </View>
            );
          })}
        </ScrollView>
      </View>
    </Modal>
  );
}

// ─── Card (today view) ────────────────────────────────────────

export function PrayerRuleCard() {
  const [rule, setRule] = useState<RuleConfig | null>(null);
  const [done, setDone] = useState<Set<string>>(new Set());
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    loadRule().then(setRule);
    loadTodayDone().then(setDone);
  }, []);

  const update = useCallback((next: RuleConfig) => {
    setRule(next);
    saveRule(next);
  }, []);

  const toggle = (k: string) => {
    setDone(prev => {
      const n = new Set(prev);
      if (n.has(k)) { n.delete(k); H.tap(); } else { n.add(k); H.done(); }
      saveTodayDone(n);
      return n;
    });
  };

  const now = new Date();
  const items = rule ? todayItems(rule, now) : [];
  const doneCount = items.filter(it => done.has(it.key)).length;
  const allDone = items.length > 0 && doneCount === items.length;
  const fastingToday = isFastDay(now);

  return (
    <Card
      title="My Prayer Rule"
      flat
      action={
        <TouchableOpacity onPress={() => setEditing(true)}>
          <Text style={s.editLink}>{rule && !ruleIsEmpty(rule) ? 'Edit rule' : 'Set up'}</Text>
        </TouchableOpacity>
      }
    >
      {!rule ? (
        <ActivityIndicator color={colors.gold} style={{ paddingVertical: 16 }} />
      ) : ruleIsEmpty(rule) ? (
        <View style={s.empty}>
          <Text style={s.emptyText}>
            Your personal rule of prayer — Agpeya hours, prostrations, fasting, and reading, set per day of the week with your Father of Confession. Kept privately on this device.
          </Text>
          <TouchableOpacity style={s.setupBtn} onPress={() => setEditing(true)}>
            <Text style={s.setupBtnText}>SET YOUR PRAYER RULE</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          <View style={s.todayHead}>
            <Text style={s.todayLabel}>
              {WEEKDAYS[now.getDay()]}
              {fastingToday ? '  ·  fasting day' : isHolyFifty(now) ? '  ·  Holy Fifty (fast-free)' : ''}
            </Text>
            <Text style={[s.todayCount, { color: allDone ? colors.green : colors.muted }]}>
              {allDone ? '✦ Complete — glory to God' : `${doneCount}/${items.length} done`}
            </Text>
          </View>
          {items.length === 0 ? (
            <Text style={s.emptyText}>Nothing set for {WEEKDAYS[now.getDay()]} — edit the rule to add hours or services.</Text>
          ) : (
            items.map(it => {
              const isDone = done.has(it.key);
              return (
                <TouchableOpacity key={it.key} style={[s.itemRow, isDone && { borderColor: colors.green + '55' }]} onPress={() => toggle(it.key)} activeOpacity={0.8}>
                  <Text style={[s.itemLabel, isDone && s.itemDone]}>{it.label}</Text>
                  <View style={[s.check, isDone && s.checkOn]}>
                    {isDone && <Text style={{ color: colors.navy, fontSize: 11, fontFamily: fonts.latoBold }}>✓</Text>}
                  </View>
                </TouchableOpacity>
              );
            })
          )}
          <Text style={s.confLine}>Confession — {rule.confession.toLowerCase()}</Text>
        </>
      )}

      {editing && rule && (
        <RuleEditor rule={rule} update={update} onClose={() => setEditing(false)} />
      )}
    </Card>
  );
}

const s = StyleSheet.create({
  editLink: { fontFamily: fonts.latoBold, fontSize: 12, color: colors.gold },
  backLink: { fontFamily: fonts.latoBold, fontSize: 13, color: colors.gold },
  note: { fontFamily: fonts.latoLight, fontSize: 12, lineHeight: 18, color: colors.muted, fontStyle: 'italic', marginBottom: 20 },
  sectionLabel: { fontFamily: fonts.latoBold, fontSize: 10, letterSpacing: 1.5, color: colors.gold, opacity: 0.8, marginBottom: 10 },
  subLabel: { fontFamily: fonts.latoBold, fontSize: 9, letterSpacing: 1.2, color: colors.gold, opacity: 0.8, marginBottom: 6 },

  editorSafe: { flex: 1, backgroundColor: colors.navy },
  editorContent: { padding: 20, paddingTop: 56, paddingBottom: 40 },
  editorTitle: { fontFamily: fonts.cormorantMedium, fontSize: 26, color: colors.cream, marginBottom: 6 },

  fieldRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: colors.cardBg, borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 14, marginBottom: 10 },
  fieldLabel: { fontFamily: fonts.latoLight, fontSize: 14, color: colors.cream, flex: 1 },
  fieldNote: { fontFamily: fonts.latoLight, fontSize: 11, lineHeight: 16, color: colors.muted, marginBottom: 10, marginTop: -2 },

  stepperRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  stepBtn: { width: 34, height: 34, borderRadius: 10, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  stepBtnText: { fontSize: 20, color: colors.gold },
  stepValue: { fontFamily: fonts.latoBold, fontSize: 14, color: colors.cream, minWidth: 56, textAlign: 'center' },

  card: { backgroundColor: colors.cardBg, borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 14, marginBottom: 10 },
  cardHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cardTitle: { fontFamily: fonts.latoBold, fontSize: 13, color: colors.cream, marginBottom: 10 },
  chipRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  chip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6, marginRight: 6, marginBottom: 6 },
  chipOn: { backgroundColor: colors.gold, borderColor: colors.gold },
  chipOff: { backgroundColor: 'transparent', borderColor: colors.border },
  chipText: { fontFamily: fonts.latoBold, fontSize: 11 },
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: 8, padding: 10, fontSize: 13, fontFamily: fonts.latoLight, color: colors.cream, backgroundColor: 'rgba(10,16,30,0.7)' },

  dayCard: { backgroundColor: colors.cardBg, borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 14, marginBottom: 8 },
  dayHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  dayName: { fontFamily: fonts.latoBold, fontSize: 13, color: colors.cream },
  daySummary: { fontFamily: fonts.latoLight, fontSize: 11, color: colors.muted, marginTop: 2 },

  todayHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 10, marginBottom: 10 },
  todayLabel: { fontFamily: fonts.latoBold, fontSize: 11, letterSpacing: 0.8, color: colors.goldLight, textTransform: 'uppercase' },
  todayCount: { fontFamily: fonts.latoBold, fontSize: 11 },

  itemRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: colors.navyMid, borderWidth: 1, borderColor: colors.border, borderRadius: 10, padding: 13, marginBottom: 6 },
  itemLabel: { fontFamily: fonts.latoLight, fontSize: 13, color: colors.cream, flex: 1, marginRight: 10 },
  itemDone: { textDecorationLine: 'line-through', color: colors.muted },
  check: { width: 22, height: 22, borderRadius: 6, borderWidth: 1.5, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  checkOn: { backgroundColor: colors.green, borderColor: colors.green },

  confLine: { fontFamily: fonts.latoLight, fontSize: 11, color: colors.muted, marginTop: 8, fontStyle: 'italic' },

  empty: { paddingVertical: 12 },
  emptyText: { fontFamily: fonts.latoLight, fontSize: 12, lineHeight: 19, color: colors.muted, paddingVertical: 4 },
  setupBtn: { backgroundColor: colors.gold, borderRadius: 8, paddingVertical: 12, alignItems: 'center', marginTop: 12 },
  setupBtnText: { fontFamily: fonts.latoBold, fontSize: 11, color: colors.navy, letterSpacing: 0.8 },
});
