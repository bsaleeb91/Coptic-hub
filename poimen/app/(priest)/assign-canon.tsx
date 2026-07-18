// app/(priest)/assign-canon.tsx
// The Father of Confession builds a member's *personal rule* from here. Each
// category has an "Assign" toggle: turning it on writes that part of the canon
// to the member (locked, read-only for them until their next confession or
// until the priest changes/removes it); leaving it off never touches what the
// member already set for that category. A free-text custom component can be
// added alongside, without disturbing the rest of the canon.

import React, { useState, useEffect, useCallback } from 'react';
import { ScrollView, View, Text, StyleSheet, TouchableOpacity, TextInput, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { colors, fonts, lazyThemed } from '@/lib/theme';
import { PencilIcon } from '@/components/ui/TabIcons';
import { useSession } from '@/lib/auth';
import { useDemoMode } from '@/lib/demo';
import ScrollPicker from '@/components/ui/ScrollPicker';
import {
  RuleConfig, DEFAULT_RULE, ReadMode,
  AGPEYA_HOURS, SERVICES, CONFESSION_OPTIONS, SERVICE_FREQUENCY_OPTIONS,
  FAST_UNTIL_OPTIONS, WEEKDAYS,
} from '@/lib/canon/rule-store';
import {
  AssignedCategory, CATEGORY_LABEL, STRUCTURED_CATEGORIES,
  AssignedCanon, applyCategoryToRule, loadAssignedForPriest,
  assignCategory, removeAssignment,
} from '@/lib/canon/assigned';

const SP = { xs: 6, sm: 10, md: 14, lg: 20 };
const R = { md: 10, lg: 12, full: 999 };

// ─── Small controls ───────────────────────────────────────────────────────────

function Stepper({ value, onChange, min = 0, max = 999, step = 1, unit }: {
  value: number; onChange: (n: number) => void; min?: number; max?: number; step?: number; unit?: string;
}) {
  return (
    <View style={s.stepperRow}>
      <TouchableOpacity style={s.stepBtn} onPress={() => onChange(Math.max(min, value - step))}><Text style={s.stepBtnText}>−</Text></TouchableOpacity>
      <Text style={s.stepValue}>{value}{unit ? ` ${unit}` : ''}</Text>
      <TouchableOpacity style={s.stepBtn} onPress={() => onChange(Math.min(max, value + step))}><Text style={s.stepBtnText}>+</Text></TouchableOpacity>
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

// A category card with an Assign toggle; children only editable when assigned.
function CatCard({ category, assigned, onToggle, summary, icon, children }: {
  category: AssignedCategory; assigned: boolean; onToggle: (on: boolean) => void;
  summary?: string; icon?: React.ReactNode; children?: React.ReactNode;
}) {
  return (
    <View style={[s.card, assigned && { borderColor: colors.gold }]}>
      <TouchableOpacity style={s.cardHead} onPress={() => onToggle(!assigned)} activeOpacity={0.7}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
          {icon}
          <View style={{ flex: 1 }}>
            <Text style={s.cardTitle}>{CATEGORY_LABEL[category]}</Text>
            {!assigned && summary ? <Text style={s.cardSummary}>{summary}</Text> : null}
          </View>
        </View>
        <View style={[s.toggle, assigned && s.toggleOn]}>
          <View style={[s.toggleKnob, assigned && s.toggleKnobOn]} />
        </View>
      </TouchableOpacity>
      {assigned && <View style={{ marginTop: SP.sm }}>{children}</View>}
    </View>
  );
}

const DAY_ABBR = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

export default function AssignCanonScreen() {
  const router = useRouter();
  const { memberId, memberName } = useLocalSearchParams<{ memberId: string; memberName: string }>();
  const { user } = useSession();
  const { demoMode } = useDemoMode();
  const displayName = memberName ?? 'Member';

  const [work, setWork] = useState<RuleConfig | null>(null);
  const [enabled, setEnabled] = useState<Set<AssignedCategory>>(new Set());
  const [orig, setOrig] = useState<Set<AssignedCategory>>(new Set());
  const [origPayloads, setOrigPayloads] = useState<Record<string, string>>({}); // category -> serialized loaded payload
  const [customList, setCustomList] = useState<{ id?: string; text: string; freq: string }[]>([]);
  const [origCustomIds, setOrigCustomIds] = useState<string[]>([]);
  const [newCustom, setNewCustom] = useState('');
  const [expandDay, setExpandDay] = useState<AssignedCategory | null>(null);
  const [expandDayIdx, setExpandDayIdx] = useState(0);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState('');

  const load = useCallback(async () => {
    const assigned = await loadAssignedForPriest(memberId ?? '', user?.id ?? '', demoMode);
    const w: RuleConfig = JSON.parse(JSON.stringify(DEFAULT_RULE));
    const en = new Set<AssignedCategory>();
    const custom: { id?: string; text: string; freq: string }[] = [];
    for (const a of assigned) {
      if (a.category === 'custom') { custom.push({ id: a.id, text: a.component, freq: a.frequency }); continue; }
      applyCategoryToRule(w, a);
      en.add(a.category);
    }
    // Snapshot each loaded category's payload (serialized the same way we write
    // it) so Save only re-assigns categories the priest actually changed.
    const op: Record<string, string> = {};
    en.forEach(cat => { op[cat] = JSON.stringify(buildPayload(cat, w)); });
    setWork(w); setEnabled(en); setOrig(new Set(en)); setOrigPayloads(op);
    setCustomList(custom); setOrigCustomIds(custom.map(c => c.id!).filter(Boolean));
  }, [memberId, demoMode, user?.id]);

  useEffect(() => { load(); }, [load]);

  const toggle = (cat: AssignedCategory, on: boolean) => {
    setEnabled(prev => { const n = new Set(prev); on ? n.add(cat) : n.delete(cat); return n; });
  };
  const patch = (p: Partial<RuleConfig>) => setWork(w => (w ? { ...w, ...p } : w));
  const setDay = (i: number, dp: Partial<{ hours: string[]; services: string[] }>) =>
    setWork(w => w ? { ...w, days: w.days.map((d, idx) => idx === i ? { ...d, ...dp } : d) } : w);
  const toggleIn = (arr: string[], k: string) => arr.includes(k) ? arr.filter(x => x !== k) : [...arr, k];

  function buildPayload(cat: AssignedCategory, w: RuleConfig): any {
    switch (cat) {
      case 'prostrations':     return { count: w.prostrations };
      case 'quiet':            return { minutes: w.quietMinutes };
      case 'fasting':          return { until: w.fastUntil };
      case 'bible':            return { mode: w.bible.mode, amount: w.bible.amount };
      case 'book':             return w.book ? { title: w.book.title, mode: w.book.mode, amount: w.book.amount } : null;
      case 'confession':       return { frequency: w.confession };
      case 'agpeya_hours':     return { days: Object.fromEntries(w.days.map((d, i) => [i, d.hours])) };
      case 'services':         return { days: Object.fromEntries(w.days.map((d, i) => [i, d.services])) };
      case 'heart_of_service': return { days: Object.fromEntries(w.days.map((d, i) => [i, d.serving])) };
      default:                 return null;
    }
  }

  function summarize(cat: AssignedCategory, w: RuleConfig): string {
    switch (cat) {
      case 'prostrations':     return `${w.prostrations} metanias`;
      case 'quiet':            return `${w.quietMinutes} min`;
      case 'fasting':          return `until ${w.fastUntil}`;
      case 'bible':            return `${w.bible.amount} ${w.bible.mode}`;
      case 'book':             return w.book?.title || 'a spiritual book';
      case 'confession':       return w.confession;
      case 'agpeya_hours':     return `${w.days.reduce((n, d) => n + d.hours.length, 0)} hour-days`;
      case 'services':         return `${w.days.reduce((n, d) => n + d.services.length, 0)} service-days`;
      case 'heart_of_service': return `${w.days.reduce((n, d) => n + d.serving.filter(x => x.text.trim()).length, 0)} commitments`;
      default:                 return '';
    }
  }

  async function handleSave() {
    if (!work || saving) return;
    setSaving(true); setSaveError('');
    try {
      for (const cat of STRUCTURED_CATEGORIES) {
        if (enabled.has(cat)) {
          // Only (re)assign if this category actually changed — re-writing an
          // untouched category would mint a new created_at and needlessly re-lock
          // it, clobbering any value the member edited after a prior fold.
          const payload = buildPayload(cat, work);
          const changed = !orig.has(cat) || JSON.stringify(payload) !== origPayloads[cat];
          if (changed) {
            await assignCategory({
              memberId: memberId ?? '', priestId: user?.id ?? '', demoMode,
              category: cat, component: `${CATEGORY_LABEL[cat]} — ${summarize(cat, work)}`, payload,
            });
          }
        } else if (orig.has(cat)) {
          await removeAssignment({ memberId: memberId ?? '', priestId: user?.id ?? '', demoMode, category: cat });
        }
      }
      // Custom components: add new (no id), remove any originally present but now gone.
      for (const c of customList) {
        if (!c.id && c.text.trim()) {
          await assignCategory({
            memberId: memberId ?? '', priestId: user?.id ?? '', demoMode,
            category: 'custom', component: c.text.trim(), payload: null, frequency: c.freq,
          });
        }
      }
      const keptIds = new Set(customList.map(c => c.id).filter(Boolean) as string[]);
      for (const id of origCustomIds) {
        if (!keptIds.has(id)) {
          await removeAssignment({ memberId: memberId ?? '', priestId: user?.id ?? '', demoMode, category: 'custom', id });
        }
      }
      setSaved(true);
      setTimeout(() => router.back(), 1100);
    } catch {
      setSaving(false);
      setSaveError('Could not save the canon — please try again.');
    }
  }

  if (!work) {
    return <SafeAreaView style={s.safe}><View style={s.center}><ActivityIndicator color={colors.gold} /></View></SafeAreaView>;
  }

  return (
    <SafeAreaView style={s.safe}>
      <ScrollView style={s.scroll} contentContainerStyle={s.content}>
        <TouchableOpacity style={s.backRow} onPress={() => router.back()}>
          <Text style={s.backArrow}>‹</Text><Text style={s.backText}>{displayName}</Text>
        </TouchableOpacity>
        <Text style={s.pageTitle}>Build {displayName.split(' ')[0]}'s Canon</Text>
        <Text style={s.pageSub}>
          Turn on a category to assign it. Assigned parts are locked for the member until their next
          confession, or until you change or remove them. Untouched categories stay as the member set them.
        </Text>

        {/* Every day */}
        <CatCard category="prostrations" assigned={enabled.has('prostrations')} onToggle={o => toggle('prostrations', o)} summary={summarize('prostrations', work)}>
          <Stepper value={work.prostrations} onChange={n => patch({ prostrations: n })} max={500} unit="metanias" />
        </CatCard>

        <CatCard category="quiet" assigned={enabled.has('quiet')} onToggle={o => toggle('quiet', o)} summary={summarize('quiet', work)}>
          <Stepper value={work.quietMinutes} onChange={n => patch({ quietMinutes: n })} step={5} max={180} unit="min" />
        </CatCard>

        <CatCard category="fasting" assigned={enabled.has('fasting')} onToggle={o => toggle('fasting', o)} summary={summarize('fasting', work)}>
          <Text style={[s.subLabel, { textAlign: 'right', color: colors.goldLight }]}>{work.fastUntil}</Text>
          <ScrollPicker options={FAST_UNTIL_OPTIONS} value={work.fastUntil} onChange={v => patch({ fastUntil: v })} />
        </CatCard>

        <CatCard category="bible" assigned={enabled.has('bible')} onToggle={o => toggle('bible', o)} summary={summarize('bible', work)}>
          <View style={s.chipRow}>
            <Chip label="Chapters" on={work.bible.mode === 'chapters'} onPress={() => patch({ bible: { ...work.bible, mode: 'chapters' as ReadMode } })} />
            <Chip label="Minutes" on={work.bible.mode === 'minutes'} onPress={() => patch({ bible: { ...work.bible, mode: 'minutes' as ReadMode } })} />
            <View style={{ flex: 1 }} />
            <Stepper value={work.bible.amount} onChange={n => patch({ bible: { ...work.bible, amount: n } })} step={work.bible.mode === 'minutes' ? 5 : 1} max={180} />
          </View>
        </CatCard>

        <CatCard category="book" assigned={enabled.has('book')} onToggle={o => { toggle('book', o); if (o && !work.book) patch({ book: { title: '', mode: 'chapters', amount: 1 } }); }} summary={summarize('book', work)}>
          <TextInput style={s.input} placeholder="Book title (e.g. The Spiritual Ladder)" placeholderTextColor={colors.muted}
            value={work.book?.title ?? ''} onChangeText={t => patch({ book: { title: t, mode: work.book?.mode ?? 'chapters', amount: work.book?.amount ?? 1 } })} />
          <View style={[s.chipRow, { marginTop: SP.sm }]}>
            <Chip label="Chapters" on={work.book?.mode === 'chapters'} onPress={() => patch({ book: { title: work.book?.title ?? '', mode: 'chapters', amount: work.book?.amount ?? 1 } })} />
            <Chip label="Minutes" on={work.book?.mode === 'minutes'} onPress={() => patch({ book: { title: work.book?.title ?? '', mode: 'minutes', amount: work.book?.amount ?? 1 } })} />
            <View style={{ flex: 1 }} />
            <Stepper value={work.book?.amount ?? 1} onChange={n => patch({ book: { title: work.book?.title ?? '', mode: work.book?.mode ?? 'chapters', amount: n } })} step={work.book?.mode === 'minutes' ? 5 : 1} max={180} />
          </View>
        </CatCard>

        <CatCard category="confession" assigned={enabled.has('confession')} onToggle={o => toggle('confession', o)} summary={summarize('confession', work)}>
          <View style={[s.chipRow, { flexWrap: 'wrap' }]}>
            {CONFESSION_OPTIONS.map(opt => <Chip key={opt} label={opt} on={work.confession === opt} onPress={() => patch({ confession: opt })} />)}
          </View>
        </CatCard>

        {/* Day-based categories */}
        {(['agpeya_hours', 'services', 'heart_of_service'] as AssignedCategory[]).map(cat => (
          <CatCard key={cat} category={cat} assigned={enabled.has(cat)} onToggle={o => toggle(cat, o)} summary={summarize(cat, work)}>
            <Text style={s.fieldNote}>Set what's prayed/served on each weekday. Tap a day to edit it.</Text>
            {WEEKDAYS.map((name, i) => {
              const d = work.days[i];
              const open = expandDay === cat && expandDayIdx === i;
              const count = cat === 'agpeya_hours' ? d.hours.length : cat === 'services' ? d.services.length : d.serving.filter(x => x.text.trim()).length;
              return (
                <View key={i} style={s.dayRow}>
                  <TouchableOpacity style={s.dayHead} onPress={() => setExpand(cat, i)}>
                    <Text style={s.dayName}>{name}</Text>
                    <Text style={s.daySummary}>{count ? `${count} set` : 'none'}  {open ? '▲' : '▾'}</Text>
                  </TouchableOpacity>
                  {open && cat === 'agpeya_hours' && (
                    <View style={[s.chipRow, { flexWrap: 'wrap', marginTop: SP.xs }]}>
                      {AGPEYA_HOURS.map(h => <Chip key={h.key} label={h.name} on={d.hours.includes(h.key)} onPress={() => setDay(i, { hours: toggleIn(d.hours, h.key) })} />)}
                    </View>
                  )}
                  {open && cat === 'services' && (
                    <View style={[s.chipRow, { flexWrap: 'wrap', marginTop: SP.xs }]}>
                      {SERVICES.map(sv => <Chip key={sv.key} label={sv.name} on={d.services.includes(sv.key)} onPress={() => setDay(i, { services: toggleIn(d.services, sv.key) })} />)}
                    </View>
                  )}
                  {open && cat === 'heart_of_service' && (
                    <View style={{ marginTop: SP.xs }}>
                      {d.serving.map((sv, j) => (
                        <View key={j} style={s.serveEntry}>
                          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                            <TextInput style={[s.input, { flex: 1 }]} placeholder="Service (e.g. visiting the sick)" placeholderTextColor={colors.muted}
                              value={sv.text} onChangeText={t => setServing(i, j, { text: t })} />
                            <TouchableOpacity onPress={() => setServingList(i, d.serving.filter((_, idx) => idx !== j))} hitSlop={8}>
                              <Text style={{ color: colors.red, fontSize: 12, marginLeft: SP.sm }}>Remove</Text>
                            </TouchableOpacity>
                          </View>
                          <View style={[s.chipRow, { flexWrap: 'wrap', marginTop: SP.xs }]}>
                            {SERVICE_FREQUENCY_OPTIONS.map(opt => <Chip key={opt} label={opt} on={sv.freq === opt} onPress={() => setServing(i, j, { freq: opt })} />)}
                          </View>
                        </View>
                      ))}
                      <TouchableOpacity onPress={() => setServingList(i, [...d.serving, { text: '', freq: 'Weekly' }])} hitSlop={8}>
                        <Text style={{ color: colors.gold, fontSize: 12, fontFamily: fonts.latoBold, marginTop: 4 }}>+ Add commitment</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              );
            })}
          </CatCard>
        ))}

        {/* Custom free-text */}
        <View style={s.card}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: SP.sm }}>
            <PencilIcon size={16} color={colors.gold} />
            <Text style={s.cardTitle}>Custom components</Text>
          </View>
          <Text style={s.fieldNote}>Free-text additions to the member's canon. Read-only for them; you manage these.</Text>
          {customList.map((c, i) => (
            <View key={c.id ?? `new-${i}`} style={s.customRow}>
              <Text style={s.customText}>{c.text}{c.freq ? ` · ${c.freq}` : ''}</Text>
              <TouchableOpacity onPress={() => setCustomList(list => list.filter((_, idx) => idx !== i))} hitSlop={8}>
                <Text style={{ color: colors.red, fontSize: 12 }}>Remove</Text>
              </TouchableOpacity>
            </View>
          ))}
          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: SP.sm }}>
            <TextInput style={[s.input, { flex: 1 }]} placeholder="e.g. Read the Sayings of the Desert Fathers" placeholderTextColor={colors.muted}
              value={newCustom} onChangeText={setNewCustom} />
            <TouchableOpacity
              onPress={() => { if (newCustom.trim()) { setCustomList(list => [...list, { text: newCustom.trim(), freq: 'Daily' }]); setNewCustom(''); } }}
              hitSlop={8}
            >
              <Text style={{ color: colors.gold, fontSize: 13, fontFamily: fonts.latoBold, marginLeft: SP.sm }}>Add</Text>
            </TouchableOpacity>
          </View>
        </View>

        {saveError ? <Text style={s.errorText}>{saveError}</Text> : null}
        <TouchableOpacity style={[s.saveBtn, saving && { opacity: 0.5 }]} onPress={handleSave} disabled={saving}>
          {saving
            ? <ActivityIndicator color={colors.navy} />
            : <Text style={s.saveBtnText}>{saved ? `✓ SAVED TO ${displayName.split(' ')[0].toUpperCase()}` : `SAVE ${displayName.split(' ')[0].toUpperCase()}'S CANON`}</Text>}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );

  // ── day-expander helpers (need component state) ──
  function setExpand(cat: AssignedCategory, i: number) {
    if (expandDay === cat && expandDayIdx === i) { setExpandDay(null); return; }
    setExpandDay(cat); setExpandDayIdx(i);
  }
  function setServing(i: number, j: number, p: Partial<{ text: string; freq: string }>) {
    setWork(w => w ? { ...w, days: w.days.map((d, idx) => idx === i ? { ...d, serving: d.serving.map((e, k) => k === j ? { ...e, ...p } : e) } : d) } : w);
  }
  function setServingList(i: number, list: { text: string; freq: string }[]) {
    setWork(w => w ? { ...w, days: w.days.map((d, idx) => idx === i ? { ...d, serving: list } : d) } : w);
  }
}

const s = lazyThemed(() => StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.navy },
  scroll: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { padding: SP.lg, paddingBottom: 48 },

  backRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 16 },
  backArrow: { fontFamily: fonts.cormorant, fontSize: 22, color: colors.gold },
  backText: { fontFamily: fonts.latoLight, fontSize: 13, color: colors.muted },
  pageTitle: { fontFamily: fonts.cormorantMedium, fontSize: 26, color: colors.cream, marginBottom: 6 },
  pageSub: { fontFamily: fonts.latoLight, fontSize: 12, lineHeight: 18, color: colors.textSecond, marginBottom: SP.lg },

  card: { borderWidth: 1, borderColor: colors.border, borderRadius: R.lg, padding: SP.md, marginBottom: SP.sm, backgroundColor: colors.panel },
  cardHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cardTitle: { fontFamily: fonts.latoBold, fontSize: 14, color: colors.cream },
  cardSummary: { fontFamily: fonts.latoLight, fontSize: 11, color: colors.muted, marginTop: 2 },
  subLabel: { fontFamily: fonts.latoBold, fontSize: 11, color: colors.textSecond, marginBottom: 4 },
  fieldNote: { fontFamily: fonts.latoLight, fontSize: 11, lineHeight: 16, color: colors.muted, marginBottom: SP.sm },

  toggle: { width: 44, height: 26, borderRadius: 13, backgroundColor: colors.creamDim, padding: 3, justifyContent: 'center' },
  toggleOn: { backgroundColor: colors.gold },
  toggleKnob: { width: 20, height: 20, borderRadius: 10, backgroundColor: colors.muted },
  toggleKnobOn: { backgroundColor: colors.navy, alignSelf: 'flex-end' },

  stepperRow: { flexDirection: 'row', alignItems: 'center', gap: SP.sm, justifyContent: 'flex-end' },
  stepBtn: { width: 34, height: 34, borderRadius: R.md, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  stepBtnText: { fontSize: 20, fontFamily: fonts.latoBold, color: colors.gold },
  stepValue: { fontFamily: fonts.latoBold, fontSize: 15, minWidth: 90, textAlign: 'center', color: colors.cream },

  chipRow: { flexDirection: 'row', alignItems: 'center', gap: SP.xs },
  chip: { borderWidth: 1, borderRadius: R.full, paddingHorizontal: 12, paddingVertical: 6, marginRight: 6, marginBottom: 6 },
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: R.md, padding: SP.sm, fontSize: 14, color: colors.cream, fontFamily: fonts.lato, backgroundColor: colors.panel },

  dayRow: { borderTopWidth: 1, borderTopColor: colors.border, paddingVertical: SP.xs },
  dayHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 4 },
  dayName: { fontFamily: fonts.lato, fontSize: 13, color: colors.cream },
  daySummary: { fontFamily: fonts.latoLight, fontSize: 11, color: colors.muted },
  serveEntry: { borderWidth: 1, borderColor: colors.border, borderRadius: R.md, padding: SP.sm, marginBottom: 6 },

  customRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 8, borderTopWidth: 1, borderTopColor: colors.border },
  customText: { fontFamily: fonts.lato, fontSize: 13, color: colors.cream, flex: 1, marginRight: SP.sm },

  errorText: { fontFamily: fonts.latoLight, fontSize: 12, color: colors.red, marginBottom: 8 },
  saveBtn: { backgroundColor: colors.gold, borderRadius: 10, paddingVertical: 14, alignItems: 'center', marginTop: SP.sm },
  saveBtnText: { fontFamily: fonts.latoBold, fontSize: 13, color: colors.navy, letterSpacing: 1 },
}));
